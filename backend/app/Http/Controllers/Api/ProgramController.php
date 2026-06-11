<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicProgram;
use Illuminate\Http\Request;

class ProgramController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = AcademicProgram::with('project', 'creator')
            ->withCount('subjects');

        if (!in_array($user->role, ['admin', 'coordinator'], true)) {
            $query->whereHas(
                'subjects.deliverables.roleActivities',
                fn ($q) => $q->where('responsible_id', $user->id)
            );
        }

        if ($request->filled('project_id')) {
            $query->where('project_id', $request->project_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'project_id' => 'required|exists:projects,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ]);

        $data['created_by'] = $request->user()->id;

        $program = AcademicProgram::create($data);

        return response()->json($program->load('project', 'creator'), 201);
    }

    public function show(Request $request, AcademicProgram $program)
    {
        abort_unless(
            in_array($request->user()->role, ['admin', 'coordinator'], true)
            || $program->subjects()
                ->whereHas('deliverables.roleActivities', fn ($q) => $q->where('responsible_id', $request->user()->id))
                ->exists(),
            403
        );

        $program->load([
            'project',
            'creator',
            'subjects' => function ($q) {
                $q->withCount('deliverables');
            }
        ]);

        return response()->json($program);
    }

    public function update(Request $request, AcademicProgram $program)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
        ]);

        $program->update($data);

        return response()->json($program->load('project', 'creator'));
    }

    public function destroy(AcademicProgram $program)
    {
        $program->delete();

        return response()->json(['message' => 'Programa eliminado correctamente.']);
    }
}
