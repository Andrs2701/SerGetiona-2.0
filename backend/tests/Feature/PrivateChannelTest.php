<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PrivateChannelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $coordinator;
    private User $expert;
    private User $designer;
    private Channel $private;
    private Channel $public;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin       = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $this->coordinator = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);
        $this->expert      = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $this->designer    = User::factory()->create(['role' => 'design', 'is_active' => true]);

        $this->public  = Channel::create(['name' => 'general', 'type' => 'general']);
        $this->private = Channel::create(['name' => 'privado-direccion', 'type' => 'general', 'is_private' => true]);
        $this->private->members()->attach($this->expert->id);
    }

    public function test_private_channel_hidden_from_non_members(): void
    {
        $res = $this->actingAs($this->designer, 'sanctum')
            ->getJson('/api/channels')
            ->assertOk();

        $names = collect($res->json('channels'))->pluck('name');
        $this->assertTrue($names->contains('general'));
        $this->assertFalse($names->contains('privado-direccion'));
    }

    public function test_private_channel_visible_to_members_and_managers(): void
    {
        $res = $this->actingAs($this->expert, 'sanctum')
            ->getJson('/api/channels')
            ->assertOk();
        $this->assertTrue(collect($res->json('channels'))->pluck('name')->contains('privado-direccion'));

        $res = $this->actingAs($this->coordinator, 'sanctum')
            ->getJson('/api/channels')
            ->assertOk();
        $this->assertTrue(collect($res->json('channels'))->pluck('name')->contains('privado-direccion'));
    }

    public function test_non_member_cannot_read_or_post_in_private_channel(): void
    {
        $this->actingAs($this->designer, 'sanctum')
            ->getJson("/api/channels/{$this->private->id}/messages")
            ->assertStatus(403);

        $this->actingAs($this->designer, 'sanctum')
            ->postJson("/api/channels/{$this->private->id}/messages", ['content' => 'hola'])
            ->assertStatus(403);

        $this->actingAs($this->designer, 'sanctum')
            ->postJson("/api/channels/{$this->private->id}/join")
            ->assertStatus(403);
    }

    public function test_member_can_read_and_post_in_private_channel(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/channels/{$this->private->id}/messages", ['content' => 'hola equipo'])
            ->assertStatus(201);

        $this->actingAs($this->expert, 'sanctum')
            ->getJson("/api/channels/{$this->private->id}/messages")
            ->assertOk();
    }

    public function test_only_managers_can_create_private_channels_with_members(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->postJson('/api/channels', ['name' => 'intento', 'is_private' => true])
            ->assertStatus(403);

        $res = $this->actingAs($this->coordinator, 'sanctum')
            ->postJson('/api/channels', [
                'name'       => 'equipo-diseno',
                'is_private' => true,
                'member_ids' => [$this->designer->id],
            ])
            ->assertStatus(201);

        $channel = Channel::find($res->json('id'));
        $this->assertTrue($channel->is_private);
        $this->assertTrue($channel->members()->where('user_id', $this->designer->id)->exists());

        // El usuario agregado recibe notificación
        $this->assertTrue(
            Notification::where('user_id', $this->designer->id)
                ->where('type', 'channel_added')
                ->exists()
        );
    }

    public function test_managers_can_add_and_remove_members(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/channels/{$this->private->id}/members", ['user_id' => $this->designer->id])
            ->assertStatus(201);

        $this->assertTrue($this->private->members()->where('user_id', $this->designer->id)->exists());

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/channels/{$this->private->id}/members/{$this->designer->id}")
            ->assertOk();

        $this->assertFalse($this->private->members()->where('user_id', $this->designer->id)->exists());
    }

    public function test_operational_role_cannot_manage_members(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/channels/{$this->private->id}/members", ['user_id' => $this->designer->id])
            ->assertStatus(403);

        $this->actingAs($this->expert, 'sanctum')
            ->deleteJson("/api/channels/{$this->private->id}/members/{$this->expert->id}")
            ->assertStatus(403);
    }

    public function test_members_endpoint_lists_channel_members(): void
    {
        $res = $this->actingAs($this->expert, 'sanctum')
            ->getJson("/api/channels/{$this->private->id}/members")
            ->assertOk();

        $this->assertCount(1, $res->json('members'));
        $this->assertEquals($this->expert->id, $res->json('members.0.id'));
    }

    public function test_mention_with_autocomplete_handle_resolves_user(): void
    {
        $mentioned = User::factory()->create([
            'name' => 'Carlos Ramírez', 'role' => 'pedagogy', 'is_active' => true,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/channels/{$this->public->id}/messages", [
                'content' => '@carlos.ramirez revisa el entregable por favor',
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('mentions', ['mentioned_user_id' => $mentioned->id]);

        $notif = Notification::where('user_id', $mentioned->id)->where('type', 'mention')->first();
        $this->assertNotNull($notif);
        $this->assertStringContainsString('general', $notif->message);
        $this->assertEquals($this->public->id, $notif->data['channel_id'] ?? null);
    }

    public function test_mention_does_not_notify_self_or_private_non_members(): void
    {
        // Auto-mención: no genera notificación
        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/channels/{$this->public->id}/messages", [
                'content' => 'recordatorio para @' . MentionHandle::of($this->expert->name),
            ])
            ->assertStatus(201);

        $this->assertFalse(
            Notification::where('user_id', $this->expert->id)->where('type', 'mention')->exists()
        );

        // Mención a no-miembro dentro de canal privado: no se notifica
        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/channels/{$this->private->id}/messages", [
                'content' => 'oye @' . MentionHandle::of($this->designer->name),
            ])
            ->assertStatus(201);

        $this->assertFalse(
            Notification::where('user_id', $this->designer->id)->where('type', 'mention')->exists()
        );
    }
}

/** Helper local para construir handles como lo hace el frontend. */
final class MentionHandle
{
    public static function of(string $name): string
    {
        return \App\Services\MentionParser::toHandle($name);
    }
}
