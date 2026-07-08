<?php

namespace Tests\Feature;

use App\Models\StateTransition;
use App\Models\SystemPermission;
use App\Models\SystemRole;
use App\Models\SystemStatus;
use App\Models\User;
use App\Models\VisibilityRule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SystemConfigurationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $coordinator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin       = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $this->coordinator = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);
    }

    public function test_non_admin_cannot_access_config_endpoints(): void
    {
        $this->actingAs($this->coordinator, 'sanctum')
            ->getJson('/api/config/roles')
            ->assertStatus(403);

        $this->actingAs($this->coordinator, 'sanctum')
            ->putJson('/api/config/permissions', ['permissions' => []])
            ->assertStatus(403);
    }

    public function test_admin_can_manage_roles(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/roles', [
                'slug' => 'editor',
                'name' => 'Editor de Estilo',
                'description' => 'Corrección de estilo.',
            ])
            ->assertStatus(201)
            ->assertJsonPath('slug', 'editor');

        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/config/roles/editor', ['is_active' => false, 'name' => 'Editor'])
            ->assertStatus(200)
            ->assertJsonPath('is_active', false);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/config/roles')
            ->assertStatus(200)
            ->assertJsonFragment(['slug' => 'editor']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/config/roles/editor')
            ->assertStatus(200);

        $this->assertDatabaseMissing('system_roles', ['slug' => 'editor']);
    }

    public function test_cannot_delete_role_in_use_or_admin_role(): void
    {
        SystemRole::create(['slug' => 'admin', 'name' => 'Administrador']);
        SystemRole::create(['slug' => 'coordinator', 'name' => 'Coordinador']);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/config/roles/admin')
            ->assertStatus(409);

        // coordinator role is used by $this->coordinator
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson('/api/config/roles/coordinator')
            ->assertStatus(409);
    }

    public function test_admin_can_update_permission_matrix(): void
    {
        $perm = SystemPermission::create([
            'module' => 'reportes',
            'action' => 'view',
            'allowed_roles' => ['admin', 'coordinator'],
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/config/permissions', [
                'permissions' => [
                    ['id' => $perm->id, 'allowed_roles' => ['admin', 'coordinator', 'qa']],
                ],
            ])
            ->assertStatus(200);

        $this->assertEquals(
            ['admin', 'coordinator', 'qa'],
            $perm->fresh()->allowed_roles
        );
    }

    public function test_admin_can_manage_statuses(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/statuses', [
                'type' => 'task',
                'slug' => 'on_hold',
                'label' => 'En Pausa',
                'color' => 'bg-yellow-300',
            ])
            ->assertStatus(201)
            ->assertJsonPath('slug', 'on_hold');

        // Duplicate type+slug rejected
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/statuses', [
                'type' => 'task',
                'slug' => 'on_hold',
                'label' => 'Duplicado',
            ])
            ->assertStatus(422);

        $status = SystemStatus::where('slug', 'on_hold')->first();

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/config/statuses/{$status->id}", ['label' => 'Pausada'])
            ->assertStatus(200)
            ->assertJsonPath('label', 'Pausada');

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/config/statuses/{$status->id}")
            ->assertStatus(200);
    }

    public function test_cannot_delete_status_in_use(): void
    {
        $status = SystemStatus::create([
            'type' => 'task',
            'slug' => 'in_progress',
            'label' => 'En Progreso',
        ]);

        $user = User::factory()->create();
        \App\Models\RoleActivity::factory()->create([
            'deliverable_id' => \App\Models\Deliverable::factory(),
            'responsible_id' => $user->id,
            'status' => 'in_progress',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/config/statuses/{$status->id}")
            ->assertStatus(409);
    }

    public function test_admin_can_manage_transitions(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/transitions', [
                'type' => 'task',
                'from_status' => 'in_progress',
                'to_status' => 'delivered',
                'allowed_roles' => ['expert'],
            ])
            ->assertStatus(201);

        // Re-posting the same pair updates allowed_roles instead of duplicating
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/transitions', [
                'type' => 'task',
                'from_status' => 'in_progress',
                'to_status' => 'delivered',
                'allowed_roles' => ['expert', 'qa'],
            ])
            ->assertStatus(201);

        $this->assertEquals(1, StateTransition::count());
        $this->assertEquals(['expert', 'qa'], StateTransition::first()->allowed_roles);

        $transition = StateTransition::first();
        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/config/transitions/{$transition->id}")
            ->assertStatus(200);

        $this->assertEquals(0, StateTransition::count());
    }

    public function test_admin_can_update_visibility_rules(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->putJson('/api/config/visibility-rules', [
                'rules' => [
                    ['role_slug' => 'expert', 'scope' => 'all'],
                ],
            ])
            ->assertStatus(200);

        $this->assertEquals('all', VisibilityRule::where('role_slug', 'expert')->first()->scope);
    }

    public function test_deactivated_role_is_rejected_by_middleware(): void
    {
        SystemRole::create(['slug' => 'coordinator', 'name' => 'Coordinador', 'is_active' => false]);

        $this->actingAs($this->coordinator, 'sanctum')
            ->getJson('/api/capacity')
            ->assertStatus(403)
            ->assertJsonPath('message', 'Tu rol ha sido desactivado por el administrador.');
    }

    public function test_visibility_rule_drives_project_scope(): void
    {
        // With scope=all, an expert can see any project
        VisibilityRule::create(['role_slug' => 'expert', 'scope' => 'all']);
        $expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $deliverable = \App\Models\Deliverable::factory()->create();
        $projectId = $deliverable->subject->academicProgram->project_id;

        $this->actingAs($expert, 'sanctum')
            ->getJson("/api/projects/{$projectId}")
            ->assertOk();

        // Switch to assigned_only: same unassigned project becomes forbidden
        VisibilityRule::where('role_slug', 'expert')->update(['scope' => 'assigned_only']);

        $this->actingAs($expert, 'sanctum')
            ->getJson("/api/projects/{$projectId}")
            ->assertStatus(403);
    }

    public function test_admin_can_manage_role_statuses(): void
    {
        $status = SystemStatus::create([
            'type' => 'task',
            'slug' => 'custom_status',
            'label' => 'Estado Personalizado',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/config/role-statuses')
            ->assertStatus(200);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/role-statuses', [
                'role' => 'design',
                'status_slug' => 'custom_status',
            ])
            ->assertStatus(201);

        $roleStatusId = $res->json('id');

        $this->assertDatabaseHas('role_statuses', [
            'role' => 'design',
            'status_slug' => 'custom_status',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/config/role-statuses/{$roleStatusId}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('role_statuses', [
            'role' => 'design',
            'status_slug' => 'custom_status',
        ]);
    }

    public function test_any_authenticated_role_can_read_role_statuses_but_not_write(): void
    {
        // Mi Espacio y la página de proyecto necesitan leer esto para CUALQUIER
        // rol operativo, no solo admin — de lo contrario el selector de estado
        // cae en la lista completa de estados de todos los roles mezclados.
        $expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $this->actingAs($expert, 'sanctum')
            ->getJson('/api/config/role-statuses')
            ->assertStatus(200);

        $this->actingAs($expert, 'sanctum')
            ->postJson('/api/config/role-statuses', ['role' => 'expert', 'status_slug' => 'not_started'])
            ->assertStatus(403);

        $this->actingAs($expert, 'sanctum')
            ->deleteJson('/api/config/role-statuses/1')
            ->assertStatus(403);
    }

    public function test_admin_can_reorder_role_statuses(): void
    {
        $status1 = SystemStatus::create(['type' => 'task', 'slug' => 'st1', 'label' => 'S1']);
        $status2 = SystemStatus::create(['type' => 'task', 'slug' => 'st2', 'label' => 'S2']);

        $rs1 = \App\Models\RoleStatus::create(['role' => 'expert', 'status_slug' => 'st1', 'sort_order' => 0]);
        $rs2 = \App\Models\RoleStatus::create(['role' => 'expert', 'status_slug' => 'st2', 'sort_order' => 1]);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/config/role-statuses/reorder', [
                'ids' => [$rs2->id, $rs1->id]
            ])
            ->assertStatus(200);

        $this->assertEquals(1, $rs1->fresh()->sort_order);
        $this->assertEquals(0, $rs2->fresh()->sort_order);
    }
}
