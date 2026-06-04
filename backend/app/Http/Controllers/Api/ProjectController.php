<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProjectResource;
use App\Http\Resources\ProjectCollection;
use App\Models\Deliverable;
use App\Models\Project;
use Illuminate\Http\Request;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $projects = Project::withCount(['academicPrograms as programs_count'])
            ->with('responsible', 'creator')
            ->get()
            ->map(function ($project) {
                $deliverableIds = Deliverable::whereHas('subject.academicProgram', function ($q) use ($project) {
                    $q->where('project_id', $project->id);
                })->pluck('id');

                $total = $deliverableIds->count();
                $finished = Deliverable::whereIn('id', $deliverableIds)
                    ->where('global_status', 'finished')
                    ->count();

                $project->deliverables_count = $total;
                $project->compliance_percentage = $total > 0 ? round(($finished / $total) * 100, 2) : 0;

                return $project;
            });

        return ProjectCollection::make($projects);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,pending_params,parameterized,in_progress,suspended,finished,cancelled',
            'responsible_id' => 'nullable|exists:users,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $data['created_by'] = $request->user()->id;

        $project = Project::create($data);

        return new ProjectResource($project->load('responsible', 'creator'));
    }

    public function show(Project $project)
    {
        $project->load([
            'responsible',
            'creator',
            'academicPrograms' => function ($q) {
                $q->with([
                    'subjects' => function ($q2) {
                        $q2->with(['deliverables' => function ($q3) {
                            $q3->with('roleActivities.responsible');
                        }]);
                    }
                ]);
            }
        ]);

        return new ProjectResource($project);
    }

    public function update(Request $request, Project $project)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status' => 'nullable|in:draft,pending_params,parameterized,in_progress,suspended,finished,cancelled',
            'responsible_id' => 'nullable|exists:users,id',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date',
        ]);

        $project->update($data);

        return new ProjectResource($project->load('responsible', 'creator'));
    }

    public function destroy(Project $project)
    {
        $project->delete();

        return response()->json(['message' => 'Proyecto eliminado correctamente.']);
    }
}
