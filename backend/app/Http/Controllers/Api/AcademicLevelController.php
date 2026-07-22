<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicLevel;
use App\Models\AuditLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AcademicLevelController extends Controller
{
    /**
     * GET /academic-levels
     * Abierto a autenticados (los formularios de entregable lo usan).
     * ?all=1 incluye los inactivos (UI de administración).
     */
    public function index(Request $request)
    {
        $query = AcademicLevel::orderBy('sort_order')->orderBy('name');

        if (!$request->boolean('all')) {
            $query->active();
        }

        return response()->json(['levels' => $query->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'       => 'required|string|max:100|unique:academic_levels,name',
            'is_active'  => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $level = AcademicLevel::create($data);

        AuditLog::create([
            'user_id'     => Auth::id(),
            'action'      => 'created',
            'entity_type' => 'AcademicLevel',
            'entity_id'   => $level->id,
            'field_changed' => null,
            'old_value'   => null,
            'new_value'   => $level->name,
            'ip_address'  => $request->ip(),
            'created_at'  => now(),
        ]);

        return response()->json($level, 201);
    }

    public function update(Request $request, AcademicLevel $level)
    {
        $data = $request->validate([
            'name'       => 'sometimes|string|max:100|unique:academic_levels,name,' . $level->id,
            'is_active'  => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $original = $level->getOriginal();
        $level->update($data);

        foreach ($level->getChanges() as $field => $newValue) {
            if ($field === 'updated_at') continue;
            AuditLog::create([
                'user_id'      => Auth::id(),
                'action'       => 'updated',
                'entity_type'  => 'AcademicLevel',
                'entity_id'    => $level->id,
                'field_changed'=> $field,
                'old_value'    => $original[$field] ?? null,
                'new_value'    => $newValue,
                'ip_address'   => $request->ip(),
                'created_at'   => now(),
            ]);
        }

        return response()->json($level);
    }

    /**
     * DELETE /academic-levels/{level}
     * Si el nivel está asignado a entregables se rechaza (409): desactivarlo
     * en su lugar para preservar la trazabilidad histórica.
     */
    public function destroy(Request $request, AcademicLevel $level)
    {
        if ($level->deliverables()->exists()) {
            return response()->json([
                'message' => 'El nivel está asignado a entregables. Desactívalo en lugar de eliminarlo.',
            ], 409);
        }

        AuditLog::create([
            'user_id'     => Auth::id(),
            'action'      => 'deleted',
            'entity_type' => 'AcademicLevel',
            'entity_id'   => $level->id,
            'field_changed' => null,
            'old_value'   => $level->name,
            'new_value'   => null,
            'ip_address'  => $request->ip(),
            'created_at'  => now(),
        ]);

        $level->delete();

        return response()->json(['message' => 'Nivel académico eliminado.']);
    }
}
