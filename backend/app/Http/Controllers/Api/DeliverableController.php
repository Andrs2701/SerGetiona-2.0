<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliverableResource;
use App\Models\Deliverable;
use App\Models\FlowTemplate;
use App\Models\RoleActivity;
use App\Models\Subject;
use Illuminate\Http\Request;

class DeliverableController extends Controller
{
    private const OPERATIONAL_ROLES = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Deliverable::with('subject.academicProgram', 'creator')
            ->withCount('roleActivities');

        // Operational roles only see deliverables where they have an assigned activity
        if (in_array($user->role, self::OPERATIONAL_ROLES)) {
            $query->whereHas('roleActivities', function ($q) use ($user) {
                $q->where('responsible_id', $user->id);
            });
        }

        if ($request->filled('subject_id')) {
            $query->where('subject_id', $request->subject_id);
        }

        if ($request->filled('project_id')) {
            $query->whereHas('subject.academicProgram', function ($q) use ($request) {
                $q->where('project_id', $request->project_id);
            });
        }

        if ($request->filled('global_status')) {
            $query->byStatus($request->global_status);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'subject_id' => 'required|exists:subjects,id',
            'name' => 'required|string|max:255',
            'type' => 'nullable|in:creation,update',
            'global_status' => 'nullable|in:unpublished,pending_start,in_progress,in_review,with_observations,finished,cancelled,not_applicable',
            'start_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $data['created_by'] = $request->user()->id;

        $deliverable = Deliverable::create($data);

        return new DeliverableResource($deliverable->load('subject', 'creator', 'roleActivities.responsible'));
    }

    public function show(Deliverable $deliverable)
    {
        $deliverable->load(['subject.academicProgram.project', 'creator', 'roleActivities.responsible', 'roleActivities.assignedBy']);

        return new DeliverableResource($deliverable);
    }

    public function update(Request $request, Deliverable $deliverable)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'type' => 'nullable|in:creation,update',
            'global_status' => 'nullable|in:unpublished,pending_start,in_progress,in_review,with_observations,finished,cancelled,not_applicable',
            'start_date' => 'nullable|date',
            'notes' => 'nullable|string',
        ]);

        $deliverable->update($data);

        return new DeliverableResource($deliverable->load('subject', 'creator', 'roleActivities.responsible'));
    }

    public function destroy(Deliverable $deliverable)
    {
        $deliverable->delete();

        return response()->json(['message' => 'Entregable eliminado correctamente.']);
    }

    public function flow(Deliverable $deliverable)
    {
        $deliverable->load('roleActivities.responsible');

        $roleLabels = [
            'expert'      => 'Experto',
            'pedagogy'    => 'Pedagogía',
            'design'      => 'Diseño',
            'audiovisual' => 'Audiovisual',
            'engineering' => 'Ingeniería',
            'qa'          => 'Calidad',
        ];

        $completedStatuses = ['approved', 'delivered', 'not_applicable'];

        $activities   = $deliverable->roleActivities->keyBy('role');
        $steps        = [];
        $currentRole  = null;
        $activeFound  = false;

        foreach ($roleLabels as $role => $label) {
            $act       = $activities[$role] ?? null;
            $status    = $act?->status ?? 'not_started';
            $completed = in_array($status, $completedStatuses);

            $step = [
                'role'        => $role,
                'label'       => $label,
                'status'      => $status,
                'responsible' => $act?->responsible?->name,
                'completed'   => $completed,
            ];

            // El primer rol no completado es el activo
            if (!$completed && !$activeFound) {
                $step['active'] = true;
                $currentRole    = $role;
                $activeFound    = true;
            }

            $steps[] = $step;
        }

        return response()->json([
            'current_role' => $currentRole,
            'steps'        => $steps,
        ]);
    }

    public function applyFlowTemplate(Request $request, Deliverable $deliverable)
    {
        $request->validate([
            'template_id' => 'nullable|exists:flow_templates,id',
            'base_date' => 'required|date',
        ]);

        $template = $request->filled('template_id')
            ? FlowTemplate::findOrFail($request->template_id)
            : FlowTemplate::where('is_default', true)->first();

        if (!$template) {
            return response()->json(['message' => 'No hay plantilla disponible.'], 404);
        }

        $baseDate = \Carbon\Carbon::parse($request->base_date);
        $offsets = $template->offsets;

        foreach ($offsets as $role => $weeks) {
            $activity = $deliverable->roleActivities()->where('role', $role)->first();
            if ($activity) {
                $activity->update([
                    'commitment_date' => $baseDate->copy()->addWeeks($weeks)->toDateString(),
                ]);
            }
        }

        return new DeliverableResource($deliverable->load('roleActivities.responsible'));
    }
}
