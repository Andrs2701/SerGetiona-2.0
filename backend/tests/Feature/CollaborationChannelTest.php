<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CollaborationChannelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $expert;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin  = User::factory()->create(['role' => 'admin',  'is_active' => true]);
        $this->expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);
    }

    public function test_any_authenticated_user_can_list_channels(): void
    {
        Channel::create(['name' => 'general', 'type' => 'general', 'is_archived' => false]);

        $this->actingAs($this->expert, 'sanctum')
            ->getJson('/api/channels')
            ->assertStatus(200)
            ->assertJsonStructure(['channels']);
    }

    public function test_admin_can_create_channel(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/channels', ['name' => 'diseño-qa', 'type' => 'general'])
            ->assertStatus(201)
            ->assertJsonPath('name', 'diseño-qa');
    }

    public function test_expert_cannot_create_channel(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->postJson('/api/channels', ['name' => 'test-channel'])
            ->assertStatus(403);
    }

    public function test_user_can_post_message_to_channel(): void
    {
        $channel = Channel::create(['name' => 'general', 'type' => 'general', 'is_archived' => false]);

        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/channels/{$channel->id}/messages", ['content' => 'Hola equipo!'])
            ->assertStatus(201)
            ->assertJsonPath('content', 'Hola equipo!');
    }

    public function test_messages_are_listed_for_channel(): void
    {
        $channel = Channel::create(['name' => 'general', 'type' => 'general', 'is_archived' => false]);

        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/channels/{$channel->id}/messages", ['content' => 'Msg 1']);
        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/channels/{$channel->id}/messages", ['content' => 'Msg 2']);

        $res = $this->actingAs($this->expert, 'sanctum')
            ->getJson("/api/channels/{$channel->id}/messages")
            ->assertStatus(200);

        $this->assertCount(2, $res->json('messages'));
    }

    public function test_mention_in_message_creates_notification(): void
    {
        $channel = Channel::create(['name' => 'general', 'type' => 'general', 'is_archived' => false]);
        $mentioned = User::factory()->create(['name' => 'carloslopez', 'role' => 'pedagogy', 'is_active' => true]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson("/api/channels/{$channel->id}/messages", [
                'content' => "@carloslopez revisa el entregable.",
            ])
            ->assertStatus(201);

        $this->assertDatabaseHas('mentions', ['mentioned_user_id' => $mentioned->id]);
    }
}
