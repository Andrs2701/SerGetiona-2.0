<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SystemRole;
use App\Models\SystemPermission;
use App\Models\SystemStatus;
use App\Models\StateTransition;
use App\Models\VisibilityRule;
use App\Models\AuditLog;
use App\Models\RoleStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SystemConfigurationController extends Controller
{
    // --- Roles ---
    public function getRoles()
    {
        return response()->json(['roles' => SystemRole::orderBy('name')->get()]);
    }

    public function storeRole(Request $request)
    {
        $data = $request->validate([
            'slug' => 'required|string|max:50|unique:system_roles,slug',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        $role = SystemRole::create($data);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'entity_type' => 'SystemRole',
            'entity_id' => 0, // Using 0 or helper since primary key is string slug
            'field_changed' => 'all',
            'new_value' => json_encode($role),
            'ip_address' => $request->ip(),
        ]);

        return response()->json($role, 201);
    }

    public function updateRole(Request $request, string $slug)
    {
        $role = SystemRole::findOrFail($slug);

        $data = $request->validate([
            'name' => 'sometimes|required|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|required|boolean',
        ]);

        $old = json_encode($role);
        $role->update($data);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'updated',
            'entity_type' => 'SystemRole',
            'entity_id' => 0,
            'field_changed' => 'all',
            'old_value' => $old,
            'new_value' => json_encode($role),
            'ip_address' => $request->ip(),
        ]);

        return response()->json($role);
    }

    public function destroyRole(Request $request, string $slug)
    {
        $role = SystemRole::findOrFail($slug);

        if ($slug === 'admin') {
            return response()->json(['message' => 'El rol administrador no puede eliminarse.'], 409);
        }

        if (\App\Models\User::where('role', $slug)->exists()) {
            return response()->json(['message' => 'No se puede eliminar: hay usuarios con este rol. Desactívalo en su lugar.'], 409);
        }

        $old = json_encode($role);
        $role->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'deleted',
            'entity_type' => 'SystemRole',
            'entity_id' => 0,
            'field_changed' => 'all',
            'old_value' => $old,
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'Rol eliminado correctamente.']);
    }

    // --- Permissions ---
    public function getPermissions()
    {
        return response()->json(['permissions' => SystemPermission::orderBy('module')->orderBy('action')->get()]);
    }

    public function updatePermissions(Request $request)
    {
        $data = $request->validate([
            'permissions' => 'required|array',
            'permissions.*.id' => 'required|exists:system_permissions,id',
            'permissions.*.allowed_roles' => 'required|array',
        ]);

        $updated = [];
        foreach ($data['permissions'] as $pData) {
            $permission = SystemPermission::findOrFail($pData['id']);
            $old = json_encode($permission);
            $permission->update(['allowed_roles' => $pData['allowed_roles']]);

            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => 'updated',
                'entity_type' => 'SystemPermission',
                'entity_id' => $permission->id,
                'field_changed' => 'allowed_roles',
                'old_value' => $old,
                'new_value' => json_encode($permission),
                'ip_address' => $request->ip(),
            ]);

            $updated[] = $permission;
        }

        return response()->json(['permissions' => $updated]);
    }

    // --- Statuses ---
    public function getStatuses()
    {
        return response()->json([
            'deliverable_statuses' => SystemStatus::where('type', 'deliverable')->orderBy('label')->get(),
            'task_statuses' => SystemStatus::where('type', 'task')->orderBy('label')->get(),
        ]);
    }

    public function storeStatus(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|in:deliverable,task',
            'slug' => 'required|string|max:50',
            'label' => 'required|string|max:100',
            'color' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
            'allowed_roles' => 'nullable|array',
            'is_manager_only' => 'nullable|boolean',
        ]);

        // Unique combination check
        $exists = SystemStatus::where('type', $data['type'])->where('slug', $data['slug'])->exists();
        if ($exists) {
            return response()->json(['message' => 'El slug para este tipo de estado ya existe.'], 422);
        }

        $status = SystemStatus::create($data);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'entity_type' => 'SystemStatus',
            'entity_id' => $status->id,
            'field_changed' => 'all',
            'new_value' => json_encode($status),
            'ip_address' => $request->ip(),
        ]);

        return response()->json($status, 201);
    }

    public function updateStatus(Request $request, int $id)
    {
        $status = SystemStatus::findOrFail($id);

        $data = $request->validate([
            'label' => 'sometimes|required|string|max:100',
            'color' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'is_active' => 'sometimes|required|boolean',
            'allowed_roles' => 'nullable|array',
            'is_manager_only' => 'nullable|boolean',
        ]);

        $old = json_encode($status);
        $status->update($data);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'updated',
            'entity_type' => 'SystemStatus',
            'entity_id' => $status->id,
            'field_changed' => 'all',
            'old_value' => $old,
            'new_value' => json_encode($status),
            'ip_address' => $request->ip(),
        ]);

        return response()->json($status);
    }

    public function destroyStatus(Request $request, int $id)
    {
        $status = SystemStatus::findOrFail($id);

        $inUse = $status->type === 'deliverable'
            ? \App\Models\Deliverable::where('global_status', $status->slug)->exists()
            : \App\Models\RoleActivity::where('status', $status->slug)->exists();

        if ($inUse) {
            return response()->json(['message' => 'No se puede eliminar: hay registros usando este estado. Desactívalo en su lugar.'], 409);
        }

        $old = json_encode($status);
        $status->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'deleted',
            'entity_type' => 'SystemStatus',
            'entity_id' => $id,
            'field_changed' => 'all',
            'old_value' => $old,
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'Estado eliminado correctamente.']);
    }

    public function getTaskStatusesForRole(Request $request)
    {
        $role = $request->input('role');
        $isManager = in_array($request->user()->role, ['admin', 'coordinator'], true);

        $query = SystemStatus::where('type', 'task')->where('is_active', true);

        $statuses = $query->get()->filter(function ($status) use ($role, $isManager) {
            if ($role && !$status->isAvailableForRole($role)) {
                return false;
            }
            if ($status->is_manager_only && !$isManager) {
                return false;
            }
            return true;
        })->values();

        return response()->json($statuses);
    }

    // --- Transitions ---
    public function getTransitions()
    {
        return response()->json(['transitions' => StateTransition::all()]);
    }

    public function storeTransition(Request $request)
    {
        $data = $request->validate([
            'type' => 'required|in:deliverable,task',
            'from_status' => 'required|string|max:50',
            'to_status' => 'required|string|max:50',
            'allowed_roles' => 'required|array',
        ]);

        $exists = StateTransition::where('type', $data['type'])
            ->where('from_status', $data['from_status'])
            ->where('to_status', $data['to_status'])
            ->first();

        if ($exists) {
            $old = json_encode($exists);
            $exists->update(['allowed_roles' => $data['allowed_roles']]);
            $transition = $exists;
            $action = 'updated';
        } else {
            $transition = StateTransition::create($data);
            $old = null;
            $action = 'created';
        }

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => $action,
            'entity_type' => 'StateTransition',
            'entity_id' => $transition->id,
            'field_changed' => 'all',
            'old_value' => $old,
            'new_value' => json_encode($transition),
            'ip_address' => $request->ip(),
        ]);

        return response()->json($transition, 201);
    }

    public function destroyTransition(Request $request, int $id)
    {
        $transition = StateTransition::findOrFail($id);
        $old = json_encode($transition);
        $transition->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'deleted',
            'entity_type' => 'StateTransition',
            'entity_id' => $id,
            'field_changed' => 'all',
            'old_value' => $old,
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'Transición eliminada correctamente.']);
    }

    // --- Visibility Rules ---
    public function getVisibilityRules()
    {
        return response()->json(['visibility_rules' => VisibilityRule::all()]);
    }

    public function updateVisibilityRules(Request $request)
    {
        $data = $request->validate([
            'rules' => 'required|array',
            'rules.*.role_slug' => 'required|string',
            'rules.*.scope' => 'required|in:all,assigned_only',
        ]);

        $updated = [];
        foreach ($data['rules'] as $ruleData) {
            $rule = VisibilityRule::updateOrCreate(
                ['role_slug' => $ruleData['role_slug']],
                ['scope' => $ruleData['scope']]
            );
            $updated[] = $rule;
        }

        return response()->json(['visibility_rules' => $updated]);
    }

    // --- Role Statuses ---
    public function getRoleStatuses()
    {
        return response()->json(['role_statuses' => RoleStatus::orderBy('role')->orderBy('sort_order')->get()]);
    }

    public function storeRoleStatus(Request $request)
    {
        $data = $request->validate([
            'role' => 'required|string|max:50',
            'status_slug' => 'required|string|max:50',
        ]);

        $statusExists = SystemStatus::where('type', 'task')->where('slug', $data['status_slug'])->exists();
        if (!$statusExists) {
            return response()->json(['message' => 'El estado de tarea provisto no existe o no es de tipo tarea.'], 422);
        }

        $exists = RoleStatus::where('role', $data['role'])->where('status_slug', $data['status_slug'])->exists();
        if ($exists) {
            return response()->json(['message' => 'Este estado ya está asociado al rol.'], 422);
        }

        $maxOrder = RoleStatus::where('role', $data['role'])->max('sort_order') ?? -1;
        $data['sort_order'] = $maxOrder + 1;

        $roleStatus = RoleStatus::create($data);

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'created',
            'entity_type' => 'RoleStatus',
            'entity_id' => $roleStatus->id,
            'field_changed' => 'all',
            'new_value' => json_encode($roleStatus),
            'ip_address' => $request->ip(),
        ]);

        return response()->json($roleStatus, 201);
    }

    public function destroyRoleStatus(Request $request, int $id)
    {
        $roleStatus = RoleStatus::findOrFail($id);
        $old = json_encode($roleStatus);
        $roleStatus->delete();

        AuditLog::create([
            'user_id' => Auth::id(),
            'action' => 'deleted',
            'entity_type' => 'RoleStatus',
            'entity_id' => $id,
            'field_changed' => 'all',
            'old_value' => $old,
            'ip_address' => $request->ip(),
        ]);

        return response()->json(['message' => 'Estado del rol desasociado correctamente.']);
    }

    public function reorderRoleStatuses(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'required|integer|exists:role_statuses,id',
        ]);

        foreach ($data['ids'] as $index => $id) {
            RoleStatus::where('id', $id)->update(['sort_order' => $index]);
        }

        return response()->json(['message' => 'Orden actualizado correctamente.']);
    }
}
