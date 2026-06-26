<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Deliverable;
use App\Models\EvidenceLink;
use App\Models\RoleActivity;
use App\Support\ResourceAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class EvidenceLinkController extends Controller
{
    /**
     * GET /deliverables/{deliverable}/evidence
     * Retorna todos los evidence_links de todas las role_activities del entregable,
     * agrupados por rol.
     */
    public function byDeliverable(Request $request, Deliverable $deliverable)
    {
        $deliverable->loadMissing('subject.academicProgram.project');
        abort_unless(ResourceAccess::canAccessDeliverable($request->user(), $deliverable), 403);

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
        abort_unless(
            ResourceAccess::isManager($request->user())
            || $activity->responsible_id === $request->user()->id,
            403
        );

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

        AuditLog::create([
            'user_id'       => Auth::id(),
            'action'        => 'updated',
            'entity_type'   => 'RoleActivity',
            'entity_id'     => $activity->id,
            'field_changed' => 'evidence_link',
            'new_value'     => $link->title ?: $link->url,
            'created_at'    => now(),
        ]);

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
     * GET /role-activities/{activity}/evidence
     * Retorna los evidence_links de una role_activity específica.
     */
    public function byActivity(Request $request, RoleActivity $activity)
    {
        abort_unless(ResourceAccess::canAccessActivity($request->user(), $activity), 403);

        $links = $activity->evidenceLinks()->with('user')->orderBy('created_at', 'asc')->get();
        return response()->json($links->map(function ($link) {
            return [
                'id'         => $link->id,
                'type'       => $link->type,
                'title'      => $link->title,
                'url'        => $link->url,
                'user'       => $link->user ? ['id' => $link->user->id, 'name' => $link->user->name] : null,
                'created_at' => $link->created_at?->toIso8601String(),
            ];
        })->values());
    }

    /**
     * DELETE /evidence/{link}
     * Solo admin/coordinator, el autor del link o el responsable de la actividad.
     */
    public function destroy(Request $request, EvidenceLink $link)
    {
        $user = $request->user();
        $canDelete = in_array($user->role, ['admin', 'coordinator'])
            || $link->user_id === $user->id
            || $link->roleActivity?->responsible_id === $user->id;

        if (!$canDelete) {
            return response()->json(['message' => 'No tienes permiso para realizar esta acción.'], 403);
        }

        AuditLog::create([
            'user_id'       => $user->id,
            'action'        => 'updated',
            'entity_type'   => 'RoleActivity',
            'entity_id'     => $link->role_activity_id,
            'field_changed' => 'evidence_link_removed',
            'old_value'     => $link->title ?: $link->url,
            'created_at'    => now(),
        ]);

        $link->delete();

        return response()->json(['message' => 'Evidencia eliminada.']);
    }
}
