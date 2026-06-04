<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\RoleActivity;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RoleActivityController extends Controller
{
    public function update(Request $request, RoleActivity $activity)
    {
        $data = $request->validate([
            'responsible_id' => 'nullable|exists:users,id',
            'assigned_at' => 'nullable|date',
            'commitment_date' => 'nullable|date',
            'actual_start_date' => 'nullable|date',
            'actual_delivery_date' => 'nullable|date',
            'status' => 'nullable|string|max:100',
            'notes' => 'nullable|string',
        ]);

        $original = $activity->getOriginal();
        $activity->update($data);
        $dirty = $activity->getChanges();

        foreach ($dirty as $field => $newValue) {
            if ($field === 'updated_at') continue;
            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => 'updated',
                'entity_type' => 'RoleActivity',
                'entity_id' => $activity->id,
                'field_changed' => $field,
                'old_value' => $original[$field] ?? null,
                'new_value' => $newValue,
                'ip_address' => $request->ip(),
                'created_at' => now(),
            ]);
        }

        return response()->json($activity->load('responsible', 'assignedBy'));
    }
}
