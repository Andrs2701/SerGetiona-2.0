<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliverableResource;
use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\FlowTemplate;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\ResourceAccess;
use Illuminate\Http\Request;

class DeliverableController extends Controller
{
    private const OPERATIONAL_ROLES = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
    private const ALL_ROLES         = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    // ─── GET /deliverables ────────────────────────────────────────────────────

    public function index(Request $request)
    {
        $user  = $request->user();
        $query = Deliverable::with([
            'subject.academicProgram.project',
            'roleActivities.responsible',
            'complexityLevel',
        ]);

        if (in_array($user->role, self::OPERATIONAL_ROLES)) {
            $query->whereHas('roleActivities', fn($q) => $q->where('responsible_id', $user->id));
        }

        if ($request->filled('subject_id'))  $query->where('subject_id', $request->subject_id);
        if ($request->filled('project_id'))  {
            $query->whereHas('subject.academicProgram', fn($q) => $q->where('project_id', $request->project_id));
        }
        if ($request->filled('global_status')) $query->byStatus($request->global_status);

        return response()->json($query->get()->map(fn($d) => $this->formatRow($d)));
    }

    // ─── POST /deliverables ───────────────────────────────────────────────────

    public function store(Request $request)
    {
        $data = $request->validate([
            'subject_id'                    => 'nullable|exists:subjects,id',
            'project_id'                    => 'nullable|exists:projects,id',
            'program_name'                  => 'nullable|string|max:255',
            'subject_name'                  => 'nullable|string|max:255',
            'name'                          => 'required|string|max:255',
            'type'                          => 'nullable|in:creation,update',
            'start_date'                    => 'nullable|date',
            'notes'                         => 'nullable|string',
            'activities'                    => 'nullable|array',
            'activities.*.role'             => 'required|in:expert,pedagogy,design,audiovisual,engineering,qa',
            'activities.*.responsible_id'   => 'nullable|exists:users,id',
            'activities.*.commitment_date'  => 'nullable|date',
        ]);

        $userId = $request->user()->id;

        $subjectId = $data['subject_id'] ?? null;

        if (!$subjectId) {
            if (empty($data['project_id']) || empty($data['program_name']) || empty($data['subject_name'])) {
                return response()->json(['message' => 'Indica subject_id o (project_id + program_name + subject_name).'], 422);
            }

            $program   = AcademicProgram::firstOrCreate(
                ['name' => $data['program_name'], 'project_id' => (int) $data['project_id']],
                ['created_by' => $userId]
            );
            $subject   = Subject::firstOrCreate(
                ['name' => $data['subject_name'], 'academic_program_id' => $program->id],
                ['created_by' => $userId]
            );
            $subjectId = $subject->id;
        }

        $deliverable = Deliverable::create([
            'subject_id'    => $subjectId,
            'name'          => $data['name'],
            'type'          => $data['type'] ?? 'creation',
            'global_status' => 'unpublished',
            'start_date'    => $data['start_date'] ?? null,
            'notes'         => $data['notes'] ?? null,
            'created_by'    => $userId,
        ]);

        foreach (($data['activities'] ?? []) as $act) {
            $created = RoleActivity::create([
                'deliverable_id'  => $deliverable->id,
                'role'            => $act['role'],
                'responsible_id'  => $act['responsible_id'] ?? null,
                'commitment_date' => $act['commitment_date'] ?? null,
                'status'          => 'not_started',
                'checklist'       => RoleActivity::defaultChecklist($act['role']),
            ]);

            if (!empty($act['responsible_id'])) {
                $responsible = User::find($act['responsible_id']);
                if ($responsible) {
                    \App\Services\NotificationService::notifyTaskAssigned($created, $responsible);
                }
            }
        }

        return response()->json(
            $this->formatRow($deliverable->fresh(['subject.academicProgram.project', 'roleActivities.responsible']))
        );
    }

    // ─── GET /deliverables/{id} ───────────────────────────────────────────────

    public function show(Request $request, Deliverable $deliverable)
    {
        $deliverable->loadMissing('subject.academicProgram.project');
        abort_unless(ResourceAccess::canAccessDeliverable($request->user(), $deliverable), 403);

        $deliverable->load(['subject.academicProgram.project', 'creator', 'roleActivities.responsible', 'roleActivities.assignedBy']);

        return new DeliverableResource($deliverable);
    }

    // ─── PUT /deliverables/{id} ───────────────────────────────────────────────

    public function update(Request $request, Deliverable $deliverable)
    {
        $data = $request->validate([
            'name'                          => 'sometimes|string|max:255',
            'type'                          => 'nullable|in:creation,update',
            'global_status'                 => 'nullable|in:unpublished,pending_start,in_progress,in_review,with_observations,finished,cancelled,not_applicable',
            'start_date'                    => 'nullable|date',
            'notes'                         => 'nullable|string',
            'program_name'                  => 'nullable|string|max:255',
            'subject_name'                  => 'nullable|string|max:255',
            'complexity_level_id'           => 'nullable|exists:complexity_levels,id',
            'activities'                    => 'nullable|array',
            'activities.*.role'             => 'required|in:expert,pedagogy,design,audiovisual,engineering,qa',
            'activities.*.responsible_id'   => 'nullable|integer',
            'activities.*.commitment_date'  => 'nullable|date',
        ]);

        $userId = $request->user()->id;

        // ── Move to different program / subject ───────────────────────────────
        if (!empty($data['program_name']) || !empty($data['subject_name'])) {
            $currentSubject = $deliverable->subject()->with('academicProgram')->first();
            $currentProgram = $currentSubject?->academicProgram;

            $newProgramName = $data['program_name'] ?? $currentProgram?->name;
            $newSubjectName = $data['subject_name'] ?? $currentSubject?->name;

            if ($currentProgram && $newProgramName !== $currentProgram->name) {
                $newProgram = AcademicProgram::firstOrCreate(
                    ['name' => $newProgramName, 'project_id' => $currentProgram->project_id],
                    ['created_by' => $userId]
                );
            } else {
                $newProgram = $currentProgram;
            }

            if ($newProgram && ($newSubjectName !== $currentSubject?->name || $newProgram->id !== $currentProgram?->id)) {
                $newSubject = Subject::firstOrCreate(
                    ['name' => $newSubjectName, 'academic_program_id' => $newProgram->id],
                    ['created_by' => $userId]
                );
                $deliverable->update(['subject_id' => $newSubject->id]);
            }
        }

        // ── Update deliverable fields ─────────────────────────────────────────
        $fields = [];
        foreach (['name', 'type', 'global_status', 'start_date', 'notes', 'complexity_level_id'] as $f) {
            if (array_key_exists($f, $data)) $fields[$f] = $data[$f];
        }
        if (!empty($fields)) $deliverable->update($fields);

        // ── Update role activities ────────────────────────────────────────────
        if (isset($data['activities'])) {
            foreach ($data['activities'] as $act) {
                $activity = $deliverable->roleActivities()->where('role', $act['role'])->first();

                if ($activity) {
                    $upd = [];
                    $oldResponsibleId = $activity->responsible_id;
                    if (array_key_exists('responsible_id', $act))  $upd['responsible_id']  = $act['responsible_id'] ?: null;
                    if (array_key_exists('commitment_date', $act))  $upd['commitment_date'] = $act['commitment_date'] ?: null;
                    if (!empty($upd)) {
                        $activity->update($upd);

                        // Notify when responsible changes
                        $newId = $upd['responsible_id'] ?? null;
                        if ($newId && $newId !== $oldResponsibleId) {
                            $responsible = User::find($newId);
                            if ($responsible) {
                                \App\Services\NotificationService::notifyTaskAssigned($activity, $responsible);
                            }
                        }
                    }
                } else {
                    $created = $deliverable->roleActivities()->create([
                        'role'            => $act['role'],
                        'responsible_id'  => $act['responsible_id'] ?? null,
                        'commitment_date' => $act['commitment_date'] ?? null,
                        'status'          => 'not_started',
                        'checklist'       => RoleActivity::defaultChecklist($act['role']),
                    ]);

                    if (!empty($act['responsible_id'])) {
                        $responsible = User::find($act['responsible_id']);
                        if ($responsible) {
                            \App\Services\NotificationService::notifyTaskAssigned($created, $responsible);
                        }
                    }
                }
            }
        }

        return response()->json(
            $this->formatRow($deliverable->fresh(['subject.academicProgram.project', 'roleActivities.responsible']))
        );
    }

    // ─── DELETE /deliverables/{id} ────────────────────────────────────────────

    public function destroy(Deliverable $deliverable)
    {
        $deliverable->delete();
        return response()->json(['message' => 'Entregable eliminado correctamente.']);
    }

    // ─── GET /deliverables/{id}/flow ──────────────────────────────────────────

    public function flow(Request $request, Deliverable $deliverable)
    {
        $deliverable->loadMissing('subject.academicProgram.project');
        abort_unless(ResourceAccess::canAccessDeliverable($request->user(), $deliverable), 403);

        $deliverable->load([
            'roleActivities.responsible',
            'roleActivities.evidenceLinks.user',
            'roleActivities.productionLogs.resourceType',
            'roleActivities.productionLogs.producer',
        ]);

        $roleOrder  = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
        $activities = $deliverable->roleActivities->keyBy('role');
        $roles      = [];

        foreach ($roleOrder as $role) {
            $act = $activities[$role] ?? null;
            if (!$act) {
                continue;
            }

            // Group production logs by resource type
            $productionByType = [];
            foreach ($act->productionLogs as $log) {
                $typeName = $log->resourceType?->name ?? 'Sin tipo';
                if (!isset($productionByType[$typeName])) {
                    $productionByType[$typeName] = ['resource_type' => $typeName, 'total' => 0, 'logs' => []];
                }
                $productionByType[$typeName]['total'] += $log->quantity;
                $productionByType[$typeName]['logs'][] = [
                    'quantity'    => $log->quantity,
                    'produced_at' => $log->produced_at?->toDateString(),
                    'producer'    => $log->producer?->name,
                ];
            }

            $roles[] = [
                'role'                 => $act->role,
                'activity_id'          => $act->id,
                'status'               => $act->status,
                'notes'                => $act->notes,
                'commitment_date'      => $act->commitment_date?->toDateString(),
                'actual_delivery_date' => $act->actual_delivery_date?->toDateString(),
                'responsible'          => $act->responsible ? ['id' => $act->responsible->id, 'name' => $act->responsible->name] : null,
                'production'           => array_values($productionByType),
                'links'                => $act->evidenceLinks->map(fn($link) => [
                    'id'         => $link->id,
                    'type'       => $link->type,
                    'title'      => $link->title,
                    'url'        => $link->url,
                    'user'       => $link->user ? ['name' => $link->user->name] : null,
                    'created_at' => $link->created_at?->toIso8601String(),
                ])->values()->all(),
            ];
        }

        return response()->json([
            'deliverable' => [
                'id'   => $deliverable->id,
                'name' => $deliverable->name,
                'type' => $deliverable->type,
            ],
            'roles' => $roles,
        ]);
    }

    // ─── POST /deliverables/{id}/apply-template ───────────────────────────────

    public function applyFlowTemplate(Request $request, Deliverable $deliverable)
    {
        $request->validate(['template_id' => 'nullable|exists:flow_templates,id', 'base_date' => 'required|date']);

        $template = $request->filled('template_id')
            ? FlowTemplate::findOrFail($request->template_id)
            : FlowTemplate::where('is_default', true)->first();

        if (!$template) return response()->json(['message' => 'No hay plantilla disponible.'], 404);

        $baseDate = \Carbon\Carbon::parse($request->base_date);
        foreach ($template->offsets as $role => $weeks) {
            $activity = $deliverable->roleActivities()->where('role', $role)->first();
            if ($activity) $activity->update(['commitment_date' => $baseDate->copy()->addWeeks($weeks)->toDateString()]);
        }

        return new DeliverableResource($deliverable->load('roleActivities.responsible'));
    }

    // ─── Private helpers ──────────────────────────────────────────────────────

    private function formatRow(Deliverable $d): array
    {
        $subject    = $d->subject;
        $program    = $subject?->academicProgram;
        $project    = $program?->project;
        $activities  = $d->roleActivities;
        $applicable  = $activities->where('status', '!=', 'not_applicable');
        $total       = $applicable->count();
        $approved    = $applicable->where('status', 'approved')->count();
        $compliance  = $total > 0 ? (int) round(($approved / $total) * 100) : 0;

        return [
            'id'                    => $d->id,
            'subject_id'            => $d->subject_id,
            'name'                  => $d->name,
            'type'                  => $d->type,
            'global_status'         => $d->global_status,
            'start_date'            => $d->start_date,
            'notes'                 => $d->notes,
            'subject_name'          => $subject?->name,
            'program_id'            => $program?->id,
            'program_name'          => $program?->name,
            'project_id'            => $project?->id,
            'project_name'          => $project?->name,
            'compliance_percentage' => $compliance,
            'complexity_level_id'   => $d->complexity_level_id,
            'complexity'            => $d->complexityLevel ? [
                'id' => $d->complexityLevel->id, 'name' => $d->complexityLevel->name, 'points' => $d->complexityLevel->points,
            ] : null,
            'role_activities' => $activities->map(fn($a) => [
                'id'                   => $a->id,
                'role'                 => $a->role,
                'status'               => $a->status,
                'commitment_date'      => $a->commitment_date?->toDateString(),
                'actual_start_date'    => $a->actual_start_date?->toDateString(),
                'actual_delivery_date' => $a->actual_delivery_date?->toDateString(),
                'notes'                => $a->notes,
                'responsible'          => $a->responsible ? [
                    'id' => $a->responsible->id, 'name' => $a->responsible->name, 'role' => $a->responsible->role,
                ] : null,
            ])->values(),
        ];
    }
}
