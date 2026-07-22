<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\RoleCoverage;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Cobertura temporal de rol: permite que un usuario cubra actividades de un
 * rol operativo distinto al propio durante una ventana de tiempo (vacaciones,
 * incapacidades). No reemplaza `users.role` — se suma a él mientras esté
 * vigente. Solo admin/coordinador la administran (ver routes/api.php).
 */
class RoleCoverageController extends Controller
{
    /**
     * GET /users/{user}/role-coverages
     * Historial completo (activas y pasadas) de coberturas de un usuario.
     */
    public function index(User $user)
    {
        $coverages = $user->roleCoverages()
            ->with('creator:id,name')
            ->orderByDesc('starts_at')
            ->get();

        return response()->json(['coverages' => $coverages]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id'       => 'required|exists:users,id',
            'covering_role' => 'required|in:expert,pedagogy,design,audiovisual,engineering,qa',
            'starts_at'     => 'required|date',
            'ends_at'       => 'nullable|date|after_or_equal:starts_at',
            'reason'        => 'nullable|string|max:255',
        ]);

        $data['created_by'] = $request->user()->id;

        $coverage = RoleCoverage::create($data);
        $coverage->load('creator:id,name');

        AuditLog::create([
            'user_id'       => Auth::id(),
            'action'        => 'created',
            'entity_type'   => 'RoleCoverage',
            'entity_id'     => $coverage->id,
            'field_changed' => null,
            'old_value'     => null,
            'new_value'     => "{$coverage->covering_role} ({$data['starts_at']} - " . ($data['ends_at'] ?? 'indefinida') . ')',
            'ip_address'    => $request->ip(),
            'created_at'    => now(),
        ]);

        return response()->json($coverage, 201);
    }

    /**
     * DELETE /role-coverages/{roleCoverage}
     * Termina la cobertura (borrado directo: es un registro operativo de
     * ventana de tiempo, no un dato histórico que deba preservarse como los
     * niveles de complejidad).
     */
    public function destroy(Request $request, RoleCoverage $roleCoverage)
    {
        AuditLog::create([
            'user_id'       => Auth::id(),
            'action'        => 'deleted',
            'entity_type'   => 'RoleCoverage',
            'entity_id'     => $roleCoverage->id,
            'field_changed' => null,
            'old_value'     => "{$roleCoverage->covering_role} (user_id={$roleCoverage->user_id})",
            'new_value'     => null,
            'ip_address'    => $request->ip(),
            'created_at'    => now(),
        ]);

        $roleCoverage->delete();

        return response()->json(['message' => 'Cobertura de rol terminada.']);
    }
}
