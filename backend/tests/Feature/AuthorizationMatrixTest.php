<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthorizationMatrixTest extends TestCase
{
    use RefreshDatabase;

    private function actingAsRole(string $role): static
    {
        $user = User::factory()->create(['role' => $role, 'is_active' => true]);
        return $this->actingAs($user, 'sanctum');
    }

    public function test_operational_roles_cannot_access_capacity(): void
    {
        foreach (['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'] as $role) {
            $this->actingAsRole($role)
                ->getJson('/api/capacity')
                ->assertStatus(403);
        }
    }

    public function test_managers_can_access_capacity(): void
    {
        foreach (['admin', 'coordinator'] as $role) {
            $this->actingAsRole($role)
                ->getJson('/api/capacity')
                ->assertStatus(200);
        }
    }

    public function test_operational_roles_cannot_create_decisions(): void
    {
        foreach (['expert', 'pedagogy', 'design'] as $role) {
            $this->actingAsRole($role)
                ->postJson('/api/decisions', [
                    'decision_date' => '2026-06-11',
                    'description'   => 'test',
                ])
                ->assertStatus(403);
        }
    }

    public function test_non_admin_cannot_manage_complexity_levels(): void
    {
        $this->actingAsRole('coordinator')
            ->postJson('/api/complexity-levels', ['name' => 'X', 'points' => 1])
            ->assertStatus(403);
    }

    public function test_admin_can_manage_complexity_levels(): void
    {
        $this->actingAsRole('admin')
            ->postJson('/api/complexity-levels', ['name' => 'Test', 'points' => 2, 'sort_order' => 99])
            ->assertStatus(201);
    }

    public function test_unauthenticated_cannot_access_protected_routes(): void
    {
        $this->getJson('/api/capacity')->assertStatus(401);
        $this->getJson('/api/projects')->assertStatus(401);
        $this->getJson('/api/decisions')->assertStatus(401);
    }
}
