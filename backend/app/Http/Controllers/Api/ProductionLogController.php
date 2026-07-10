<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProductionLog;
use App\Models\ResourceType;
use App\Models\RoleActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ProductionLogController extends Controller
{
    public function byActivity(Request $request, RoleActivity $activity)
    {
        abort_unless(
            \App\Support\ResourceAccess::canAccessActivity($request->user(), $activity),
            403,
            'No tienes permiso para ver los registros de producción de esta actividad.'
        );

        $logs = $activity->productionLogs()
            ->with(['resourceType', 'producer', 'logger'])
            ->orderBy('produced_at', 'desc')
            ->get();

        return response()->json(['data' => $logs]);
    }

    public function store(Request $request, RoleActivity $activity)
    {
        $user = $request->user();

        $isManager = in_array($user->role, ['admin', 'coordinator'], true);
        $isOwner   = (int) $activity->responsible_id === (int) $user->id;

        if (!$isManager && !$isOwner) {
            return response()->json(['message' => 'No tienes permiso para registrar producción en esta actividad.'], 403);
        }

        abort_if(
            !$isManager && in_array($activity->status, ['delivered', 'approved'], true),
            403,
            'No se puede registrar producción en una actividad ya entregada o aprobada.'
        );

        $data = $request->validate([
            'resource_type_id' => 'required|exists:resource_types,id',
            'quantity'         => 'required|integer|min:1',
            'description'      => 'nullable|string|max:500',
            'produced_at'      => 'required|date',
        ]);

        $resourceType = ResourceType::find($data['resource_type_id']);
        if ($resourceType->role !== $activity->role) {
            return response()->json([
                'message' => 'El tipo de recurso no corresponde al rol de esta actividad.'
            ], 422);
        }

        $log = ProductionLog::create([
            'role_activity_id' => $activity->id,
            'resource_type_id' => $data['resource_type_id'],
            'quantity'         => $data['quantity'],
            'description'      => $data['description'] ?? null,
            'produced_by'      => $user->id,
            'logged_by'        => $user->id,
            'produced_at'      => $data['produced_at'],
        ]);

        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'production_logged',
            'entity_type'  => 'RoleActivity',
            'entity_id'    => $activity->id,
            'field_changed' => 'production_log',
            'old_value'    => null,
            'new_value'    => "{$resourceType->name} x{$data['quantity']}",
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        return response()->json($log->load(['resourceType', 'producer']), 201);
    }

    public function destroy(Request $request, ProductionLog $productionLog)
    {
        $user = $request->user();
        $isManager = in_array($user->role, ['admin', 'coordinator'], true);
        $activity = $productionLog->roleActivity;

        if (!$isManager 
            && (int) $productionLog->logged_by !== (int) $user->id
            && (!$activity || (int) $activity->responsible_id !== (int) $user->id)
        ) {
            return response()->json(['message' => 'No tienes permiso para eliminar este registro.'], 403);
        }
        if (!$isManager && $activity && in_array($activity->status, ['delivered', 'approved'], true)) {
            return response()->json([
                'message' => 'No se puede eliminar un registro de producción de una actividad ya entregada o aprobada.'
            ], 403);
        }

        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'production_deleted',
            'entity_type'  => 'RoleActivity',
            'entity_id'    => $productionLog->role_activity_id,
            'field_changed' => 'production_log',
            'old_value'    => "{$productionLog->resourceType?->name} x{$productionLog->quantity}",
            'new_value'    => null,
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        $productionLog->delete();

        return response()->json(null, 204);
    }

    public function summary(Request $request)
    {
        $query = ProductionLog::query()
            ->join('resource_types', 'production_logs.resource_type_id', '=', 'resource_types.id')
            ->join('role_activities', 'production_logs.role_activity_id', '=', 'role_activities.id')
            ->join('deliverables', 'role_activities.deliverable_id', '=', 'deliverables.id')
            ->join('subjects', 'deliverables.subject_id', '=', 'subjects.id')
            ->join('academic_programs', 'subjects.academic_program_id', '=', 'academic_programs.id')
            ->join('projects', 'academic_programs.project_id', '=', 'projects.id')
            ->join('users', 'production_logs.produced_by', '=', 'users.id');

        if ($request->has('project_id')) {
            $query->where('projects.id', $request->input('project_id'));
        }
        if ($request->has('role')) {
            $query->where('resource_types.role', $request->input('role'));
        }
        if ($request->has('produced_by')) {
            $query->where('production_logs.produced_by', $request->input('produced_by'));
        }
        if ($request->has('from')) {
            $query->where('production_logs.produced_at', '>=', $request->input('from'));
        }
        if ($request->has('to')) {
            $query->where('production_logs.produced_at', '<=', $request->input('to'));
        }

        $byType = (clone $query)
            ->selectRaw('resource_types.name as resource_type, resource_types.role, SUM(production_logs.quantity) as total')
            ->groupBy('resource_types.id', 'resource_types.name', 'resource_types.role')
            ->orderByDesc('total')
            ->get();

        $byRole = (clone $query)
            ->selectRaw('resource_types.role, COUNT(DISTINCT production_logs.id) as records, SUM(production_logs.quantity) as total')
            ->groupBy('resource_types.role')
            ->get();

        $byUser = (clone $query)
            ->selectRaw('users.id as user_id, users.name as user_name, users.role as user_role, SUM(production_logs.quantity) as total, COUNT(DISTINCT production_logs.id) as records')
            ->groupBy('users.id', 'users.name', 'users.role')
            ->orderByDesc('total')
            ->get();

        $byProject = (clone $query)
            ->selectRaw('projects.id as project_id, projects.name as project_name, SUM(production_logs.quantity) as total, COUNT(DISTINCT production_logs.id) as records')
            ->groupBy('projects.id', 'projects.name')
            ->orderByDesc('total')
            ->get();

        $totals = (clone $query)
            ->selectRaw('COUNT(DISTINCT production_logs.id) as total_records, SUM(production_logs.quantity) as total_quantity, COUNT(DISTINCT production_logs.produced_by) as unique_producers')
            ->first();

        return response()->json([
            'totals'     => $totals,
            'by_type'    => $byType,
            'by_role'    => $byRole,
            'by_user'    => $byUser,
            'by_project' => $byProject,
        ]);
    }

    public function export(Request $request)
    {
        $query = ProductionLog::query()
            ->with(['resourceType', 'producer', 'roleActivity.deliverable.subject.academicProgram.project'])
            ->orderBy('produced_at', 'desc');

        if ($request->has('project_id')) {
            $query->whereHas('roleActivity.deliverable.subject.academicProgram.project', function ($q) use ($request) {
                $q->where('id', $request->input('project_id'));
            });
        }
        if ($request->has('role')) {
            $query->whereHas('resourceType', function ($q) use ($request) {
                $q->where('role', $request->input('role'));
            });
        }
        if ($request->has('from')) {
            $query->where('produced_at', '>=', $request->input('from'));
        }
        if ($request->has('to')) {
            $query->where('produced_at', '<=', $request->input('to'));
        }

        $logs = $query->get();

        $csv = "Proyecto,Programa,Asignatura,Entregable,Rol,Tipo de Recurso,Cantidad,Descripción,Producido por,Fecha\n";

        foreach ($logs as $log) {
            $del     = $log->roleActivity?->deliverable;
            $subject = $del?->subject;
            $program = $subject?->academicProgram;
            $project = $program?->project;

            $csv .= implode(',', [
                '"' . str_replace('"', '""', $project?->name ?? '') . '"',
                '"' . str_replace('"', '""', $program?->name ?? '') . '"',
                '"' . str_replace('"', '""', $subject?->name ?? '') . '"',
                '"' . str_replace('"', '""', $del?->name ?? '') . '"',
                '"' . ($log->resourceType?->role ?? '') . '"',
                '"' . str_replace('"', '""', $log->resourceType?->name ?? '') . '"',
                $log->quantity,
                '"' . str_replace('"', '""', $log->description ?? '') . '"',
                '"' . str_replace('"', '""', $log->producer?->name ?? '') . '"',
                $log->produced_at?->toDateString() ?? '',
            ]) . "\n";
        }

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="produccion_' . now()->format('Y-m-d') . '.csv"',
        ]);
    }
}
