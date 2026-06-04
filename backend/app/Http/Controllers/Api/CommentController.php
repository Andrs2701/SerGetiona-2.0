<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Deliverable;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Request $request, Deliverable $deliverable)
    {
        $comments = $deliverable->comments()
            ->with('user', 'replies.user')
            ->whereNull('parent_id')
            ->orderBy('created_at')
            ->get();

        return response()->json($comments);
    }

    public function store(Request $request, Deliverable $deliverable)
    {
        $data = $request->validate([
            'content'   => 'required|string',
            'parent_id' => 'nullable|exists:comments,id',
        ]);

        $comment = $deliverable->comments()->create([
            'user_id'    => $request->user()->id,
            'parent_id'  => $data['parent_id'] ?? null,
            'content'    => $data['content'],
            'created_at' => now(),
        ]);

        // Notify the responsible of the deliverable (expert role activity)
        $expertActivity = $deliverable->roleActivities()
            ->where('role', 'expert')
            ->whereNotNull('responsible_id')
            ->first();

        if ($expertActivity && $expertActivity->responsible_id !== $request->user()->id) {
            $responsible = User::find($expertActivity->responsible_id);
            if ($responsible) {
                NotificationService::notify(
                    $responsible,
                    'comment_added',
                    'Nuevo comentario en entregable',
                    "Se agregó un comentario en el entregable '{$deliverable->name}'.",
                    [
                        'entity_type'      => 'Deliverable',
                        'entity_id'        => $deliverable->id,
                        'deliverable_name' => $deliverable->name,
                    ]
                );
            }
        }

        return response()->json($comment->load('user'), 201);
    }
}
