<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\Deliverable;
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
            'content' => 'required|string',
            'parent_id' => 'nullable|exists:comments,id',
        ]);

        $comment = $deliverable->comments()->create([
            'user_id' => $request->user()->id,
            'parent_id' => $data['parent_id'] ?? null,
            'content' => $data['content'],
            'created_at' => now(),
        ]);

        return response()->json($comment->load('user'), 201);
    }
}
