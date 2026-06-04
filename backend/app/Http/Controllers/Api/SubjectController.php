<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Subject;
use Illuminate\Http\Request;

class SubjectController extends Controller
{
    public function index(Request $request)
    {
        $query = Subject::with('academicProgram', 'creator')
            ->withCount('deliverables');

        if ($request->filled('academic_program_id')) {
            $query->where('academic_program_id', $request->academic_program_id);
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'academic_program_id' => 'required|exists:academic_programs,id',
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'credits' => 'nullable|integer|min:0',
        ]);

        $data['created_by'] = $request->user()->id;

        $subject = Subject::create($data);

        return response()->json($subject->load('academicProgram', 'creator'), 201);
    }

    public function show(Subject $subject)
    {
        $subject->load([
            'academicProgram',
            'creator',
            'deliverables' => function ($q) {
                $q->with('roleActivities.responsible');
            }
        ]);

        return response()->json($subject);
    }

    public function update(Request $request, Subject $subject)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'code' => 'nullable|string|max:50',
            'credits' => 'nullable|integer|min:0',
        ]);

        $subject->update($data);

        return response()->json($subject->load('academicProgram', 'creator'));
    }

    public function destroy(Subject $subject)
    {
        $subject->delete();

        return response()->json(['message' => 'Asignatura eliminada correctamente.']);
    }
}
