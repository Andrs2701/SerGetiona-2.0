<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\ChannelMessage;
use App\Services\MentionParser;
use Illuminate\Http\Request;

class ChannelMessageController extends Controller
{
    public function index(Channel $channel)
    {
        $messages = $channel->messages()
            ->with(['user:id,name,role', 'replies.user:id,name,role'])
            ->whereNull('parent_id')
            ->orderBy('created_at')
            ->get();

        return response()->json(['messages' => $messages]);
    }

    public function store(Request $request, Channel $channel)
    {
        $data = $request->validate([
            'content'   => 'required|string',
            'parent_id' => 'nullable|exists:channel_messages,id',
        ]);

        $msg = ChannelMessage::create([
            'channel_id' => $channel->id,
            'user_id'    => $request->user()->id,
            'parent_id'  => $data['parent_id'] ?? null,
            'content'    => $data['content'],
        ]);

        $channel->update(['last_message_at' => now()]);
        MentionParser::record($msg->content, $msg->id, null);

        // Auto-join sender
        $channel->members()->syncWithoutDetaching([
            $request->user()->id => ['last_read_at' => now()],
        ]);

        return response()->json($msg->load('user:id,name,role'), 201);
    }

    public function destroy(Request $request, Channel $channel, ChannelMessage $message)
    {
        if ($message->user_id !== $request->user()->id && !in_array($request->user()->role, ['admin', 'coordinator'])) {
            return response()->json(['message' => 'Sin permiso.'], 403);
        }

        $message->delete();
        return response()->json(['message' => 'Mensaje eliminado.']);
    }
}
