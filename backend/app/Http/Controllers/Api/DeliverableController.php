<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliverableResource;
use App\Models\AcademicProgram;
use App\Models\AuditLog;
use App\Models\Deliverable;
use App\Models\FlowTemplate;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\ResourceAccess;
use Carbon\Carbon;
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
        if ($request->filled('program_id')) {
            $query->whereHas('subject', fn($q) => $q->where('academic_program_id', $request->program_id));
        }
        if ($request->filled('global_status')) $query->byStatus($request->global_status);
        if ($request->filled('role')) {
            $query->whereHas('roleActivities', fn($q) => $q->where('role', $request->role));
        }
        if ($request->filled('responsible_id')) {
            $query->whereHas('roleActivities', fn($q) => $q->where('responsible_id', $request->responsible_id));
        }
        if ($request->filled('year')) {
            $query->whereHas('roleActivities', fn($q) => $q->whereYear('commitment_date', $request->year));
        }
        if ($request->filled('month')) {
            $query->whereHas('roleActivities', fn($q) => $q->whereMonth('commitment_date', $request->month));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->type);
        }

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
            'semestre'                      => 'nullable|in:I,II,III,IV,V,VI,VII,VIII,IX,X,NA',
            'ciclo'                         => 'nullable|in:0,1,2,3,4,NA',
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
            'semestre'      => $data['semestre'] ?? null,
            'ciclo'         => $data['ciclo'] ?? null,
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
            'semestre'                      => 'nullable|in:I,II,III,IV,V,VI,VII,VIII,IX,X,NA',
            'ciclo'                         => 'nullable|in:0,1,2,3,4,NA',
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
        foreach (['name', 'type', 'global_status', 'start_date', 'notes', 'complexity_level_id', 'semestre', 'ciclo'] as $f) {
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
            'roleActivities.observations.user',
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
                'observations'         => $act->observations->map(fn($obs) => [
                    'id'         => $obs->id,
                    'observation'=> $obs->observation,
                    'user'       => $obs->user ? ['name' => $obs->user->name] : null,
                    'created_at' => $obs->created_at?->toIso8601String(),
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

    // ─── GET /deliverables/{id}/timeline ─────────────────────────────────────

    public function timeline(Request $request, Deliverable $deliverable)
    {
        $deliverable->loadMissing('subject.academicProgram.project');
        abort_unless(ResourceAccess::canAccessDeliverable($request->user(), $deliverable), 403);

        $deliverable->load(['roleActivities.responsible']);

        $roleOrder = self::ALL_ROLES;
        $roleLabels = [
            'expert' => 'Experto', 'pedagogy' => 'Pedagogía', 'design' => 'Diseño',
            'audiovisual' => 'Audiovisual', 'engineering' => 'Ingeniería', 'qa' => 'QA',
        ];

        $activities  = $deliverable->roleActivities->keyBy('role');
        $activityIds = $activities->pluck('id')->all();

        // Load all audit logs for all activities in one query
        $auditLogs = AuditLog::whereIn('entity_id', $activityIds)
            ->where('entity_type', 'RoleActivity')
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->get()
            ->groupBy('entity_id');

        $allEvents = [];

        foreach ($roleOrder as $role) {
            $activity = $activities[$role] ?? null;
            if (!$activity || $activity->status === 'not_applicable') {
                continue;
            }

            $roleLabel = $roleLabels[$role] ?? $role;

            $allEvents[] = [
                'type'       => 'created',
                'label'      => "Actividad creada — {$roleLabel}",
                'user'       => null,
                'date'       => $activity->created_at?->toIso8601String(),
                'role'       => $role,
                'role_label' => $roleLabel,
            ];

            if ($activity->responsible_id && $activity->assigned_at) {
                $allEvents[] = [
                    'type'       => 'assigned',
                    'label'      => "Asignada a {$activity->responsible?->name} — {$roleLabel}",
                    'user'       => null,
                    'date'       => Carbon::parse($activity->assigned_at)->toIso8601String(),
                    'role'       => $role,
                    'role_label' => $roleLabel,
                ];
            }

            foreach ($auditLogs->get($activity->id, collect()) as $log) {
                if ($log->field_changed === 'status' && $log->new_value) {
                    $oldLabel = RoleActivityController::translateStatus($log->old_value ?? '');
                    $newLabel = RoleActivityController::translateStatus($log->new_value);
                    $allEvents[] = [
                        'type'       => 'status',
                        'label'      => "{$roleLabel}: {$oldLabel} → {$newLabel}",
                        'user'       => $log->user?->name,
                        'date'       => $log->created_at?->toIso8601String(),
                        'role'       => $role,
                        'role_label' => $roleLabel,
                    ];
                } elseif ($log->field_changed === 'actual_delivery_date' && $log->new_value) {
                    $allEvents[] = [
                        'type'       => 'delivered',
                        'label'      => "Entrega registrada — {$roleLabel}",
                        'user'       => $log->user?->name,
                        'date'       => $log->created_at?->toIso8601String(),
                        'role'       => $role,
                        'role_label' => $roleLabel,
                    ];
                } elseif ($log->field_changed === 'commitment_date' && $log->new_value) {
                    $allEvents[] = [
                        'type'       => 'date_changed',
                        'label'      => "{$roleLabel}: Fecha límite → {$log->new_value}",
                        'user'       => $log->user?->name,
                        'date'       => $log->created_at?->toIso8601String(),
                        'role'       => $role,
                        'role_label' => $roleLabel,
                    ];
                } elseif ($log->field_changed === 'notes' && $log->new_value) {
                    $allEvents[] = [
                        'type'       => 'note',
                        'label'      => "Observación actualizada — {$roleLabel}",
                        'user'       => $log->user?->name,
                        'date'       => $log->created_at?->toIso8601String(),
                        'role'       => $role,
                        'role_label' => $roleLabel,
                    ];
                } elseif ($log->field_changed === 'evidence_link' && $log->new_value) {
                    $allEvents[] = [
                        'type'       => 'delivered',
                        'label'      => "Evidencia agregada: {$log->new_value} — {$roleLabel}",
                        'user'       => $log->user?->name,
                        'date'       => $log->created_at?->toIso8601String(),
                        'role'       => $role,
                        'role_label' => $roleLabel,
                    ];
                }
            }

            if ($activity->status === 'approved' && $activity->actual_delivery_date) {
                $onTime = $activity->commitment_date
                    && $activity->actual_delivery_date->lte(Carbon::parse($activity->commitment_date));
                $allEvents[] = [
                    'type'       => 'approved',
                    'label'      => $onTime ? "{$roleLabel}: Aprobada ✓ (a tiempo)" : "{$roleLabel}: Aprobada (fuera de tiempo)",
                    'user'       => null,
                    'date'       => $activity->updated_at?->toIso8601String(),
                    'role'       => $role,
                    'role_label' => $roleLabel,
                ];
            }
        }

        usort($allEvents, fn($a, $b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));

        return response()->json(['events' => $allEvents]);
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
        // Definición canónica de "completado" (antes solo contaba 'approved',
        // divergiendo del resto de la app — ver RoleActivity::COMPLETED_STATUSES).
        $completed   = $applicable->whereIn('status', \App\Models\RoleActivity::COMPLETED_STATUSES)->count();
        $compliance  = $total > 0 ? (int) round(($completed / $total) * 100) : 0;

        return [
            'id'                    => $d->id,
            'subject_id'            => $d->subject_id,
            'name'                  => $d->name,
            'type'                  => $d->type,
            'global_status'         => $d->global_status,
            'start_date'            => $d->start_date ? $d->start_date->toDateString() : null,
            'notes'                 => $d->notes,
            'semestre'              => $d->semestre,
            'ciclo'                 => $d->ciclo,
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
                'updated_at'           => $a->updated_at?->toIso8601String(),
                'notes'                => $a->notes,
                'responsible'          => $a->responsible ? [
                    'id' => $a->responsible->id, 'name' => $a->responsible->name, 'role' => $a->responsible->role,
                ] : null,
            ])->values(),
        ];
    }
}
