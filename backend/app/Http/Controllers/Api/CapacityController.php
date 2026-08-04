<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoleActivity;
use App\Models\User;
use App\Services\CapacityService;
use App\Services\ReassignmentService;
use Illuminate\Http\Request;

/**
 * Capacidad operativa — solo admin/coordinator (middleware role en rutas).
 */
class CapacityController extends Controller
{
    /** GET /capacity — resumen global + detalle por usuario. */
    public function index()
    {
        CapacityService::ensureWeeklySnapshot();

        return response()->json([
            'summary' => CapacityService::global(),
            'users'   => CapacityService::allUsers(),
        ]);
    }

    /** GET /capacity/by-role */
    public function byRole()
    {
        return response()->json(['roles' => CapacityService::byRole()]);
    }

    /** GET /capacity/trends?weeks=8&user_id=&role= */
    public function trends(Request $request)
    {
        $data = $request->validate([
            'weeks'   => 'nullable|integer|min:1|max:52',
            'user_id' => 'nullable|exists:users,id',
            'role'    => 'nullable|string|max:20',
        ]);

        return response()->json([
            'series' => CapacityService::trend(
                (int) ($data['weeks'] ?? 8),
                isset($data['user_id']) ? (int) $data['user_id'] : null,
                $data['role'] ?? null
            ),
        ]);
    }

    /** GET /capacity/users/{user}/activities — actividades que cargan al usuario. */
    public function userActivities(User $user)
    {
        $today = now()->toDateString();

        $activities = RoleActivity::whereHas('deliverable')
            ->with('deliverable.subject.academicProgram', 'deliverable.complexityLevel')
            ->where('responsible_id', $user->id)
            ->whereNotIn('status', CapacityService::EXCLUDED_STATUSES)
            ->whereNotNull('commitment_date')
            ->orderBy('commitment_date')
            ->get()
            ->map(fn ($a) => [
                'id'              => $a->id,
                'role'            => $a->role,
                'status'          => $a->status,
                'commitment_date' => $a->commitment_date?->toDateString(),
                'is_overdue'      => $a->commitment_date
                    && $a->commitment_date->toDateString() < $today
                    && is_null($a->actual_delivery_date),
                'points'          => CapacityService::pointsFor($a),
                'deliverable'     => [
                    'id'   => $a->deliverable?->id,
                    'name' => $a->deliverable?->name,
                ],
                'program_name'    => $a->deliverable?->subject?->academicProgram?->name,
            ])
            ->values();

        return response()->json([
            'user'       => ['id' => $user->id, 'name' => $user->name, 'role' => $user->role],
            'activities' => $activities,
        ]);
    }

    /** GET /activities/{activity}/reassignment-suggestions */
    public function suggestions(RoleActivity $activity)
    {
        $current = $activity->responsible
            ? CapacityService::forUser($activity->responsible)
            : null;

        return response()->json([
            'activity_id' => $activity->id,
            'role'        => $activity->role,
            'current'     => $current ? [
                'user_id'         => $current['user_id'],
                'name'            => $current['user_name'],
                'utilization_pct' => $current['utilization_pct'],
            ] : null,
            'suggestions' => ReassignmentService::suggestionsFor($activity),
        ]);
    }
}
