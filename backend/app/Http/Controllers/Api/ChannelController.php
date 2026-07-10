<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Channel;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Http\Request;

class ChannelController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $isManager = in_array($user->role, ['admin', 'coordinator'], true);

        // Antes hacía 2-3 consultas extra POR canal dentro de un map() (N+1):
        // la membresía propia, el conteo de mensajes no leídos, y el conteo
        // de miembros. Ahora: member_count viene de withCount() en la consulta
        // base; la membresía propia se precarga con el resto de canales
        // (with(members) filtrado al usuario actual, sin query por canal); y
        // los no leídos se calculan en una sola consulta agregada, agrupada
        // por canal, en vez de una por canal.
        $channels = Channel::with(['project:id,name', 'program:id,name'])
            ->withCount('members')
            ->with(['members' => fn ($q) => $q->where('user_id', $user->id)])
            ->where('is_archived', false)
            // Canales privados: visibles solo para miembros (los gerenciales ven todos)
            ->when(!$isManager, fn ($q) => $q->where(fn ($q2) => $q2
                ->where('is_private', false)
                ->orWhereHas('members', fn ($m) => $m->where('user_id', $user->id))))
            ->orderByDesc('last_message_at')
            ->get();

        $unreadByChannel = \Illuminate\Support\Facades\DB::table('channel_messages as cm')
            ->join('channel_members as cmem', function ($join) use ($user) {
                $join->on('cmem.channel_id', '=', 'cm.channel_id')
                    ->where('cmem.user_id', $user->id);
            })
            ->where(function ($q) {
                $q->whereNull('cmem.last_read_at')
                    ->orWhereColumn('cm.created_at', '>', 'cmem.last_read_at');
            })
            ->select('cm.channel_id', \Illuminate\Support\Facades\DB::raw('count(*) as unread'))
            ->groupBy('cm.channel_id')
            ->pluck('unread', 'channel_id');

        $channels = $channels->map(function (Channel $ch) use ($unreadByChannel) {
            $isMember = $ch->members->isNotEmpty();

            // members solo se precargó para detectar membresía propia sin
            // consulta por canal — no debe filtrarse a la respuesta.
            $data = \Illuminate\Support\Arr::except($ch->toArray(), ['members']);

            return array_merge($data, [
                'unread_count' => $isMember ? (int) ($unreadByChannel->get($ch->id) ?? 0) : 0,
                'member_count' => $ch->members_count,
            ]);
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
            'is_private'         => 'nullable|boolean',
            'member_ids'         => 'nullable|array',
            'member_ids.*'       => 'exists:users,id',
        ]);
        $data['type'] = $data['type'] ?? 'general';
        $memberIds = $data['member_ids'] ?? [];
        unset($data['member_ids']);

        $channel = Channel::create($data);
        $channel->members()->attach($request->user()->id, ['last_read_at' => now()]);

        foreach ($memberIds as $id) {
            if ((int) $id !== (int) $request->user()->id) {
                $channel->members()->syncWithoutDetaching([$id => ['last_read_at' => null]]);
                $this->notifyAddedToChannel($channel, (int) $id);
            }
        }

        return response()->json($channel->load(['project:id,name', 'program:id,name']), 201);
    }

    public function show(Request $request, Channel $channel)
    {
        abort_unless($channel->isVisibleTo($request->user()), 403, 'No tienes acceso a este canal.');

        return response()->json($channel->load(['project:id,name', 'program:id,name']));
    }

    public function update(Request $request, Channel $channel)
    {
        $data = $request->validate([
            'name'        => 'sometimes|required|string|max:100',
            'is_private'  => 'sometimes|required|boolean',
            'is_archived' => 'sometimes|required|boolean',
        ]);

        $channel->update($data);

        return response()->json($channel->load(['project:id,name', 'program:id,name']));
    }

    public function destroy(Channel $channel)
    {
        $channel->delete();

        return response()->json(['message' => 'Canal eliminado correctamente.']);
    }

    public function join(Request $request, Channel $channel)
    {
        // A un canal privado solo te agrega un administrador/coordinador
        abort_if(
            $channel->is_private && !$channel->isVisibleTo($request->user()),
            403,
            'Este canal es privado; solo un administrador puede agregarte.'
        );

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

    // ── Gestión de miembros (solo admin/coordinator vía middleware de ruta) ──

    public function members(Request $request, Channel $channel)
    {
        abort_unless($channel->isVisibleTo($request->user()), 403, 'No tienes acceso a este canal.');

        return response()->json([
            'members' => $channel->members()
                ->select('users.id', 'users.name', 'users.email', 'users.role', 'users.photo_path')
                ->orderBy('users.name')
                ->get(),
        ]);
    }

    public function addMember(Request $request, Channel $channel)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $channel->members()->syncWithoutDetaching([
            $data['user_id'] => ['last_read_at' => null],
        ]);

        $this->notifyAddedToChannel($channel, (int) $data['user_id'], $request->user()->name);

        return response()->json(['message' => 'Usuario agregado al canal.'], 201);
    }

    public function removeMember(Request $request, Channel $channel, User $user)
    {
        $channel->members()->detach($user->id);

        return response()->json(['message' => 'Usuario removido del canal.']);
    }

    private function notifyAddedToChannel(Channel $channel, int $userId, ?string $actorName = null): void
    {
        $who = $actorName ? "{$actorName} te agregó" : 'Fuiste agregado';
        NotificationService::notify(
            $userId,
            'channel_added',
            'Nuevo canal de colaboración',
            "{$who} al canal '{$channel->name}'.",
            ['entity_type' => 'Channel', 'entity_id' => $channel->id]
        );
    }
}
