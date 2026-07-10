<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectCollection;
use App\Models\Deliverable;
use App\Models\Project;
use App\Support\ResourceAccess;
use Illuminate\Http\Request;

use Illuminate\Validation\Rule;

class ProjectController extends Controller
{
    private const OPERATIONAL_ROLES = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    public function index(Request $request)
    {
        $user = $request->user();

        $projectQuery = Project::withCount(['academicPrograms as programs_count']);

        if (in_array($user->role, self::OPERATIONAL_ROLES)) {
            $projectQuery->whereHas('academicPrograms.subjects.deliverables.roleActivities', function ($q) use ($user) {
                $q->where('responsible_id', $user->id);
            });
        }

        // Antes hacía 2 consultas por proyecto dentro del map() (N+1). Ahora
        // se trae el total/terminados de todos los entregables agrupados por
        // proyecto en una sola consulta, y el map() solo lee de ahí.
        $deliverableStatsByProject = Deliverable::join('subjects', 'deliverables.subject_id', '=', 'subjects.id')
            ->join('academic_programs', 'subjects.academic_program_id', '=', 'academic_programs.id')
            ->select(
                'academic_programs.project_id',
                \Illuminate\Support\Facades\DB::raw('count(*) as total'),
                \Illuminate\Support\Facades\DB::raw("sum(case when deliverables.global_status = 'finished' then 1 else 0 end) as finished")
            )
            ->groupBy('academic_programs.project_id')
            ->get()
            ->keyBy('project_id');

        $projects = $projectQuery
            ->with('responsible', 'creator')
            ->get()
            ->map(function ($project) use ($deliverableStatsByProject) {
                $stats = $deliverableStatsByProject->get($project->id);
                $total = (int) ($stats->total ?? 0);
                $finished = (int) ($stats->finished ?? 0);

                $project->deliverables_count = $total;
                // % de entregables terminados (distinto de "compliance" por
                // actividades usada en otros reportes — mide una cosa
                // distinta a propósito).
                $project->deliverable_completion_percentage = $total > 0 ? round(($finished / $total) * 100, 2) : 0;
                $project->compliance_percentage = $project->deliverable_completion_percentage;

                return $project;
            });

        return ProjectCollection::make($projects);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('projects', 'name')->whereNull('deleted_at')
            ],
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,pending_params,parameterized,in_progress,suspended,finished,cancelled',
            'responsible_id' => 'nullable|exists:users,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $data['created_by'] = $request->user()->id;

        $project = Project::create($data);

        return new ProjectResource($project->load('responsible', 'creator'));
    }

    public function show(Request $request, Project $project)
    {
        abort_unless(ResourceAccess::canAccessProject($request->user(), $project), 403);

        $project->load([
            'responsible',
            'creator',
            'academicPrograms' => function ($q) {
                $q->with([
                    'subjects' => function ($q2) {
                        $q2->with(['deliverables' => function ($q3) {
                            $q3->with('roleActivities.responsible:id,name,role,photo_path,position,department');
                        }]);
                    }
                ]);
            }
        ]);

        return new ProjectResource($project);
    }

    public function update(Request $request, Project $project)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,pending_params,parameterized,in_progress,suspended,finished,cancelled',
            'responsible_id' => 'nullable|exists:users,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $project->update($data);

        return new ProjectResource($project->load('responsible', 'creator'));
    }

    public function destroy(Project $project)
    {
        $project->delete();

        return response()->json(['message' => 'Proyecto eliminado correctamente.']);
    }

    public function audit(Request $request, Project $project)
    {
        abort_unless(ResourceAccess::canAccessProject($request->user(), $project), 403);

        $programIds = $project->academicPrograms()->pluck('id');
        $subjectIds = \App\Models\Subject::whereIn('academic_program_id', $programIds)->pluck('id');
        $deliverableIds = \App\Models\Deliverable::whereIn('subject_id', $subjectIds)->pluck('id');
        $activityIds = \App\Models\RoleActivity::whereIn('deliverable_id', $deliverableIds)->pluck('id');

        $logs = \App\Models\AuditLog::where(function ($query) use ($activityIds) {
                $query->where('entity_type', 'RoleActivity')
                      ->whereIn('entity_id', $activityIds);
            })
            ->orWhere(function ($query) use ($deliverableIds) {
                $query->where('entity_type', 'Deliverable')
                      ->whereIn('entity_id', $deliverableIds);
            })
            ->orWhere(function ($query) use ($project) {
                $query->where('entity_type', 'Project')
                      ->where('entity_id', $project->id);
            })
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        $formattedLogs = $logs->map(function ($log) {
            $userLabel = $log->user?->name ?? 'Usuario de sistema';
            $date = $log->created_at?->toIso8601String();
            $actionMsg = 'realizó un cambio';

            if ($log->entity_type === 'RoleActivity') {
                $activity = \App\Models\RoleActivity::find($log->entity_id);
                $deliverableName = $activity?->deliverable?->name ?? "entregable #{$activity?->deliverable_id}";
                $roleLabel = \App\Http\Controllers\Api\NotificationService::translateRole($activity?->role ?? '');

                if ($log->field_changed === 'status') {
                    $oldStatusLabel = \App\Http\Controllers\Api\RoleActivityController::translateStatus($log->old_value ?? '');
                    $newStatusLabel = \App\Http\Controllers\Api\RoleActivityController::translateStatus($log->new_value ?? '');
                    $actionMsg = "Cambió el estado de '{$deliverableName}' ({$roleLabel}) de '{$oldStatusLabel}' a '{$newStatusLabel}'";
                } elseif ($log->field_changed === 'responsible_id') {
                    $newResp = $log->new_value ? \App\Models\User::find($log->new_value)?->name : 'Sin asignar';
                    $actionMsg = "Asignó el responsable de {$roleLabel} en '{$deliverableName}' a '{$newResp}'";
                } elseif ($log->field_changed === 'commitment_date') {
                    $actionMsg = "Actualizó la fecha límite del rol {$roleLabel} en '{$deliverableName}' a '{$log->new_value}'";
                }
            } elseif ($log->entity_type === 'Deliverable') {
                $deliverable = \App\Models\Deliverable::find($log->entity_id);
                $delName = $deliverable?->name ?? "entregable #{$log->entity_id}";
                if ($log->field_changed === 'global_status') {
                    $actionMsg = "Cambió el estado global del entregable '{$delName}' a '{$log->new_value}'";
                } else {
                    $actionMsg = "Actualizó el entregable '{$delName}'";
                }
            } elseif ($log->entity_type === 'Project') {
                if ($log->field_changed === 'status') {
                    $actionMsg = "Cambió el estado del proyecto a '{$log->new_value}'";
                } else {
                    $actionMsg = "Modificó datos generales del proyecto";
                }
            }

            return [
                'user' => $userLabel,
                'action' => $actionMsg,
                'time' => $log->created_at ? $log->created_at->diffForHumans() : 'Recientemente',
                'date' => $date
            ];
        });

        return response()->json(['audit_logs' => $formattedLogs]);
    }
}
