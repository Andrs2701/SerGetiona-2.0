<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ResourceType;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class ResourceTypeController extends Controller
{
    public function index(Request $request)
    {
        $query = ResourceType::query()->orderBy('role')->orderBy('sort_order');

        if ($request->has('role')) {
            $query->where('role', $request->input('role'));
        }

        if (!$request->boolean('all')) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'role'        => 'required|in:expert,pedagogy,design,audiovisual,engineering,qa',
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:255',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer|min:0',
        ]);

        $data['slug'] = Str::slug($data['name']);

        $exists = ResourceType::where('role', $data['role'])->where('slug', $data['slug'])->exists();
        if ($exists) {
            return response()->json(['message' => 'Ya existe un tipo de recurso con ese nombre para este rol.'], 422);
        }

        $type = ResourceType::create($data);

        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'created',
            'entity_type'  => 'ResourceType',
            'entity_id'    => $type->id,
            'field_changed' => null,
            'old_value'    => null,
            'new_value'    => $type->name,
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        return response()->json($type, 201);
    }

    public function update(Request $request, ResourceType $resourceType)
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'description' => 'nullable|string|max:255',
            'is_active'   => 'boolean',
            'sort_order'  => 'integer|min:0',
        ]);

        if (isset($data['name'])) {
            $data['slug'] = Str::slug($data['name']);
            $exists = ResourceType::where('role', $resourceType->role)
                ->where('slug', $data['slug'])
                ->where('id', '!=', $resourceType->id)
                ->exists();
            if ($exists) {
                return response()->json(['message' => 'Ya existe un tipo de recurso con ese nombre para este rol.'], 422);
            }
        }

        $original = $resourceType->toArray();
        $resourceType->update($data);

        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'updated',
            'entity_type'  => 'ResourceType',
            'entity_id'    => $resourceType->id,
            'field_changed' => implode(',', array_keys($data)),
            'old_value'    => json_encode(array_intersect_key($original, $data)),
            'new_value'    => json_encode(array_intersect_key($resourceType->toArray(), $data)),
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        return response()->json($resourceType);
    }

    public function destroy(Request $request, ResourceType $resourceType)
    {
        if ($resourceType->productionLogs()->exists()) {
            return response()->json([
                'message' => 'Este tipo de recurso tiene registros de producción. Desactívalo en su lugar.'
            ], 409);
        }

        AuditLog::create([
            'user_id'      => Auth::id(),
            'action'       => 'deleted',
            'entity_type'  => 'ResourceType',
            'entity_id'    => $resourceType->id,
            'field_changed' => null,
            'old_value'    => $resourceType->name,
            'new_value'    => null,
            'ip_address'   => $request->ip(),
            'created_at'   => now(),
        ]);

        $resourceType->delete();

        return response()->json(null, 204);
    }
}
