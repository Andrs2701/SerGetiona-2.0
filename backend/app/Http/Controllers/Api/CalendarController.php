<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CalendarEvent;
use App\Models\RoleActivity;
use App\Services\WorkingDayService;
use Carbon\Carbon;
use Illuminate\Http\Request;

class CalendarController extends Controller
{
    public function index(Request $request)
    {
        $year = $request->integer('year', now()->year);

        $events = CalendarEvent::whereYear('date', $year)
            ->orWhere('is_recurring', true)
            ->orderBy('date')
            ->get();

        return response()->json($events);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'         => 'required|string|max:255',
            'date'         => 'required|date',
            'type'         => 'nullable|in:holiday,non_working,vacation,closure,event',
            'description'  => 'nullable|string',
            'is_recurring' => 'nullable|boolean',
        ]);

        $data['created_by'] = $request->user()->id;

        $event = CalendarEvent::create($data);

        return response()->json($event, 201);
    }

    public function update(Request $request, CalendarEvent $event)
    {
        $data = $request->validate([
            'name'         => 'sometimes|string|max:255',
            'date'         => 'sometimes|date',
            'type'         => 'nullable|in:holiday,non_working,vacation,closure,event',
            'description'  => 'nullable|string',
            'is_recurring' => 'nullable|boolean',
        ]);

        $event->update($data);

        return response()->json($event);
    }

    public function destroy(CalendarEvent $event)
    {
        $event->delete();

        return response()->json(['message' => 'Evento eliminado.']);
    }

    public function suggestDates(Request $request)
    {
        $request->validate([
            'expert_date' => 'required|date',
        ]);

        $expertDate = Carbon::parse($request->expert_date);

        $offsets = [
            'pedagogy'    => 2,
            'design'      => 2,
            'audiovisual' => 2,
            'engineering' => 2,
            'qa'          => 2,
        ];

        $suggested = WorkingDayService::suggestDates($expertDate, $offsets);

        return response()->json(collect($suggested)->map(fn($d) => $d->toDateString()));
    }

    public function myDeliverables(Request $request)
    {
        $user = $request->user();

        $activities = RoleActivity::where('responsible_id', $user->id)
            ->with([
                'deliverable.subject.academicProgram.project',
            ])
            ->get()
            ->map(function ($activity) {
                $deliverable = $activity->deliverable;
                $subject     = $deliverable?->subject;
                $program     = $subject?->academicProgram;
                $project     = $program?->project;

                $dateStatus = 'on_time';
                if ($activity->commitment_date) {
                    $dateStatus = WorkingDayService::getStatus(
                        Carbon::parse($activity->commitment_date),
                        $activity->actual_delivery_date ? Carbon::parse($activity->actual_delivery_date) : null
                    );
                }

                return [
                    'id'                  => $activity->id,
                    'role'                => $activity->role,
                    'status'              => $activity->status,
                    'commitment_date'     => $activity->commitment_date?->toDateString(),
                    'actual_delivery_date'=> $activity->actual_delivery_date?->toDateString(),
                    'date_status'         => $dateStatus,
                    'deliverable'         => $deliverable ? ['id' => $deliverable->id, 'name' => $deliverable->name, 'type' => $deliverable->type] : null,
                    'subject'             => $subject ? ['id' => $subject->id, 'name' => $subject->name] : null,
                    'program'             => $program ? ['id' => $program->id, 'name' => $program->name] : null,
                    'project'             => $project ? ['id' => $project->id, 'name' => $project->name] : null,
                ];
            });

        return response()->json($activities);
    }
}
