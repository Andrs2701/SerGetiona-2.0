<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        $channels = Channel::with(['project:id,name', 'program:id,name'])
            ->where('is_archived', false)
            ->orderByDesc('last_message_at')
            ->get()
            ->map(function (Channel $ch) use ($userId) {
                $member = $ch->members()->where('user_id', $userId)->first();
                $unread = $member
                    ? $ch->messages()
                        ->when($member->pivot->last_read_at, fn ($q) =>
                            $q->where('created_at', '>', $member->pivot->last_read_at))
                        ->count()
                    : 0;

                return array_merge($ch->toArray(), ['unread_count' => $unread]);
            });

        return response()->json(['channels' => $channels]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'               => 'required|string|max:100',
            'type'               => 'nullable|in:general,project,program',
            'project_id'         => 'nullable|exists:projects,id',
            'academic_program_id'=> 'nullable|exists:academic_programs,id',
        ]);
        $data['type'] = $data['type'] ?? 'general';

        $channel = Channel::create($data);
        $channel->members()->attach($request->user()->id, ['last_read_at' => now()]);

        return response()->json($channel->load(['project:id,name', 'program:id,name']), 201);
    }

    public function show(Channel $channel)
    {
        return response()->json($channel->load(['project:id,name', 'program:id,name']));
    }

    public function join(Request $request, Channel $channel)
    {
        $channel->members()->syncWithoutDetaching([
            $request->user()->id => ['last_read_at' => now()],
        ]);
        return response()->json(['joined' => true]);
    }

    public function markRead(Request $request, Channel $channel)
    {
        $channel->members()->updateExistingPivot($request->user()->id, ['last_read_at' => now()]);
        return response()->json(['ok' => true]);
    }
}
