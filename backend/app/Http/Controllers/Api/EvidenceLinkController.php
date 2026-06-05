<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\EvidenceLink;
use App\Models\RoleActivity;
use Illuminate\Http\Request;

class EvidenceLinkController extends Controller
{
    /**
     * GET /deliverables/{deliverable}/evidence
     * Retorna todos los evidence_links de todas las role_activities del entregable,
     * agrupados por rol.
     */
    public function byDeliverable(Deliverable $deliverable)
    {
        $activities = $deliverable->roleActivities()->with([
            'evidenceLinks.user',
        ])->get();

        $grouped = [];
        foreach ($activities as $activity) {
            $grouped[$activity->role] = $activity->evidenceLinks->map(function ($link) {
                return [
                    'id'         => $link->id,
                    'type'       => $link->type,
                    'title'      => $link->title,
                    'url'        => $link->url,
                    'filename'   => $link->filename,
                    'user'       => $link->user ? [
                        'id'   => $link->user->id,
                        'name' => $link->user->name,
                        'role' => $link->user->role,
                    ] : null,
                    'created_at' => $link->created_at?->toIso8601String(),
                ];
            })->values();
        }

        return response()->json($grouped);
    }

    /**
     * POST /role-activities/{activity}/evidence
     * Crear un evidence_link asociado a una role_activity.
     */
    public function store(Request $request, RoleActivity $activity)
    {
        $data = $request->validate([
            'type'     => 'required|in:file,url,drive,onedrive,sharepoint,repository',
            'title'    => 'required|string|max:255',
            'url'      => 'nullable|string|max:2048',
            'filename' => 'nullable|string|max:255',
        ]);

        $link = EvidenceLink::create([
            'role_activity_id' => $activity->id,
            'user_id'          => $request->user()->id,
            'type'             => $data['type'],
            'title'            => $data['title'],
            'url'              => $data['url'] ?? null,
            'filename'         => $data['filename'] ?? null,
        ]);

        $link->load('user');

        return response()->json([
            'id'         => $link->id,
            'type'       => $link->type,
            'title'      => $link->title,
            'url'        => $link->url,
            'filename'   => $link->filename,
            'user'       => $link->user ? [
                'id'   => $link->user->id,
                'name' => $link->user->name,
                'role' => $link->user->role,
            ] : null,
            'created_at' => $link->created_at?->toIso8601String(),
        ], 201);
    }

    /**
     * DELETE /evidence/{link}
     */
    public function destroy(EvidenceLink $link)
    {
        $link->delete();

        return response()->json(['message' => 'Evidencia eliminada.']);
    }
}
