<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AccountDeactivationTest extends TestCase
{
    use RefreshDatabase;

    public function test_inactive_user_cannot_log_in(): void
    {
        $user = User::factory()->create(['is_active' => false, 'password' => bcrypt('password')]);

        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'password',
        ])->assertStatus(403)->assertJsonPath('message', 'Usuario inactivo.');
    }

    public function test_active_user_can_log_in(): void
    {
        $user = User::factory()->create(['is_active' => true, 'password' => bcrypt('password')]);

        $this->postJson('/api/auth/login', [
            'email'    => $user->email,
            'password' => 'password',
        ])->assertStatus(200)->assertJsonStructure(['token']);
    }

    public function test_inactive_user_is_blocked_from_every_authenticated_request(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        // Se autentica directamente (simula que ya tenía un token antes de
        // ser desactivado); el middleware global debe bloquear igual.
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/auth/me')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Tu cuenta de usuario ha sido desactivada.');
    }

    public function test_notify_does_not_create_a_record_for_an_inactive_user(): void
    {
        $user = User::factory()->create(['is_active' => false]);

        NotificationService::notify($user, 'task_assigned', 'Título', 'Mensaje');

        $this->assertDatabaseMissing('notifications', ['user_id' => $user->id]);
    }

    public function test_notify_creates_a_record_for_an_active_user(): void
    {
        $user = User::factory()->create(['is_active' => true]);

        NotificationService::notify($user, 'task_assigned', 'Título', 'Mensaje');

        $this->assertDatabaseHas('notifications', ['user_id' => $user->id, 'type' => 'task_assigned']);
    }
}
