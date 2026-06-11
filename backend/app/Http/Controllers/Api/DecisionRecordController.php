<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DecisionRecord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Registro de decisiones — solo admin/coordinator (middleware role en rutas).
 * Cada cambio queda en AuditLog para trazabilidad.
 */
class DecisionRecordController extends Controller
{
    private const VALIDATION = [
        'decision_date'       => 'required|date',
        'project_id'          => 'nullable|exists:projects,id',
        'academic_program_id' => 'nullable|exists:academic_programs,id',
        'description'         => 'required|string',
        'responsible_id'      => 'nullable|exists:users,id',
        'status'              => 'nullable|in:pending,in_progress,implemented,cancelled',
        'impact'              => 'nullable|in:low,medium,high',
        'observations'        => 'nullable|string',
    ];

    public function index(Request $request)
    {
        $query = DecisionRecord::with(['project:id,name', 'program:id,name', 'responsible:id,name,role'])
            ->orderByDesc('decision_date')
            ->orderByDesc('id');

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json(['decisions' => $query->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate(self::VALIDATION);
        $data['created_by'] = $request->user()->id;

        $decision = DecisionRecord::create($data);

        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'created',
            'entity_type'  => 'DecisionRecord',
            'entity_id'    => $decision->id,
            'field_changed'=> null,
            'old_value'    => null,
            'new_value'    => mb_substr($decision->description, 0, 200),
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        return response()->json(
            $decision->load(['project:id,name', 'program:id,name', 'responsible:id,name,role']),
            201
        );
    }

    public function show(DecisionRecord $decision)
    {
        return response()->json(
            $decision->load(['project:id,name', 'program:id,name', 'responsible:id,name,role', 'creator:id,name'])
        );
    }

    public function update(Request $request, DecisionRecord $decision)
    {
        $rules = self::VALIDATION;
        $rules['decision_date'] = 'sometimes|date';
        $rules['description']   = 'sometimes|string';

        $data = $request->validate($rules);

        $original = $decision->getOriginal();
        $decision->update($data);

        foreach ($decision->getChanges() as $field => $newValue) {
            if ($field === 'updated_at') continue;
            AuditLog::create([
                'user_id'      => Auth::id(),
                'action'       => 'updated',
                'entity_type'  => 'DecisionRecord',
                'entity_id'    => $decision->id,
                'field_changed'=> $field,
                'old_value'    => is_scalar($original[$field] ?? null) ? (string) $original[$field] : null,
                'new_value'    => is_scalar($newValue) ? (string) $newValue : null,
                'ip_address'   => $request->ip(),
                'created_at'   => now(),
            ]);
        }

        return response()->json(
            $decision->load(['project:id,name', 'program:id,name', 'responsible:id,name,role'])
        );
    }

    public function destroy(Request $request, DecisionRecord $decision)
    {
        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'deleted',
            'entity_type'  => 'DecisionRecord',
            'entity_id'    => $decision->id,
            'field_changed'=> null,
            'old_value'    => mb_substr($decision->description, 0, 200),
            'new_value'    => null,
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        $decision->delete();

        return response()->json(['message' => 'Decisión eliminada.']);
    }
}
