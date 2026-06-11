<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\EvidenceLink;
use App\Models\RoleActivity;
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

    public function test_operational_user_cannot_open_an_unassigned_project(): void
    {
        $user = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $deliverable = Deliverable::factory()->create();
        $projectId = $deliverable->subject->academicProgram->project_id;

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/projects/{$projectId}")
            ->assertStatus(403);
    }

    public function test_operational_user_can_open_a_project_where_they_are_assigned(): void
    {
        $user = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $deliverable = Deliverable::factory()->create();
        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role' => 'expert',
            'responsible_id' => $user->id,
        ]);

        $this->actingAs($user, 'sanctum')
            ->getJson("/api/projects/{$deliverable->subject->academicProgram->project_id}")
            ->assertOk();
    }

    public function test_activity_owner_cannot_reassign_or_self_approve(): void
    {
        $owner = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $other = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $activity = RoleActivity::factory()->create([
            'deliverable_id' => Deliverable::factory(),
            'role' => 'expert',
            'responsible_id' => $owner->id,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->putJson("/api/activities/{$activity->id}", ['responsible_id' => $other->id])
            ->assertStatus(403);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/activities/{$activity->id}/quick-action", ['action' => 'approve'])
            ->assertStatus(403);
    }

    public function test_activity_owner_can_deliver_their_activity(): void
    {
        $owner = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $activity = RoleActivity::factory()->create([
            'deliverable_id' => Deliverable::factory(),
            'role' => 'expert',
            'responsible_id' => $owner->id,
        ]);

        $this->actingAs($owner, 'sanctum')
            ->postJson("/api/activities/{$activity->id}/quick-action", ['action' => 'deliver'])
            ->assertOk();

        $this->assertDatabaseHas('role_activities', [
            'id' => $activity->id,
            'status' => 'delivered',
        ]);
    }

    public function test_user_cannot_delete_another_users_evidence(): void
    {
        $owner = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $intruder = User::factory()->create(['role' => 'design', 'is_active' => true]);
        $activity = RoleActivity::factory()->create([
            'deliverable_id' => Deliverable::factory(),
            'role' => 'expert',
            'responsible_id' => $owner->id,
        ]);
        $link = EvidenceLink::create([
            'role_activity_id' => $activity->id,
            'user_id' => $owner->id,
            'type' => 'url',
            'title' => 'Documento',
            'url' => 'https://example.com',
        ]);

        $this->actingAs($intruder, 'sanctum')
            ->deleteJson("/api/evidence/{$link->id}")
            ->assertStatus(403);
    }
}
