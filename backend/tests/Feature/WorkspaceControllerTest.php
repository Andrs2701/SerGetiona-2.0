<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use App\Services\CapacityService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\SystemConfigSeeder::class);
    }

    public function test_admin_without_assigned_activities_gets_admin_workspace(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        $response = $this->actingAs($admin)
            ->getJson('/api/my-workspace');

        $response->assertStatus(200)
            ->assertJsonPath('view', 'admin')
            ->assertJsonStructure([
                'view',
                'stats' => [
                    'active_projects',
                    'total_deliverables',
                    'weekly_compliance',
                    'resources_total',
                ],
            ]);
        
        $this->assertNull($response->json('stats.weekly_compliance'));
    }

    public function test_admin_with_assigned_activities_gets_operational_workspace(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $subject = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'engineering',
            'status'          => 'in_progress',
            'responsible_id'  => $admin->id,
            'commitment_date' => now()->addDays(2)->toDateString(),
        ]);

        $response = $this->actingAs($admin)
            ->getJson('/api/my-workspace');

        $response->assertStatus(200)
            ->assertJsonPath('view', 'operational')
            ->assertJsonCount(1, 'activities')
            ->assertJsonPath('activities.0.id', $activity->id);
    }

    public function test_coordinator_with_assigned_activities_gets_operational_workspace(): void
    {
        $coord = User::factory()->create(['role' => 'coordinator']);
        $subject = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'design',
            'status'          => 'in_progress',
            'responsible_id'  => $coord->id,
            'commitment_date' => now()->addDays(3)->toDateString(),
        ]);

        $response = $this->actingAs($coord)
            ->getJson('/api/my-workspace');

        $response->assertStatus(200)
            ->assertJsonPath('view', 'operational')
            ->assertJsonCount(1, 'activities');
    }

    public function test_admin_with_soft_deleted_deliverable_activity_reverts_to_admin_workspace(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        $subject = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'engineering',
            'status'          => 'in_progress',
            'responsible_id'  => $admin->id,
            'commitment_date' => now()->addDays(2)->toDateString(),
        ]);

        // Soft-delete deliverable
        $deliverable->delete();

        $response = $this->actingAs($admin)
            ->getJson('/api/my-workspace');

        $response->assertStatus(200)
            ->assertJsonPath('view', 'admin');
    }

    public function test_operational_user_without_activities_retains_operational_workspace(): void
    {
        $expert = User::factory()->create(['role' => 'expert']);

        $response = $this->actingAs($expert)
            ->getJson('/api/my-workspace');

        $response->assertStatus(200)
            ->assertJsonPath('view', 'operational')
            ->assertJsonCount(0, 'activities');
    }

    public function test_capacity_service_all_users_includes_covering_manager(): void
    {
        $adminNoWork = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $adminCovering = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $subject = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'engineering',
            'status'          => 'in_progress',
            'responsible_id'  => $adminCovering->id,
            'commitment_date' => now()->addDays(2)->toDateString(),
        ]);

        $all = CapacityService::allUsers();
        $userIds = array_column($all, 'user_id');

        $this->assertContains($expert->id, $userIds);
        $this->assertContains($adminCovering->id, $userIds);
        $this->assertNotContains($adminNoWork->id, $userIds);
    }
}
