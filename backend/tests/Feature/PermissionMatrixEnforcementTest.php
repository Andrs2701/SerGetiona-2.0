<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\SystemPermission;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Prueba que la Matriz de Permisos (system_permissions.allowed_roles) ahora
 * tiene efecto real sobre rutas de negocio (entregables, calendario), en vez
 * de ser solo un valor guardado en la tabla de configuración sin consumidor.
 * Regresión: la migración 2026_08_03_120000 siembra "entregables" y
 * "calendario" con los mismos allowed_roles que antes tenía el middleware
 * fijo (admin, coordinator) — admin/coordinator no deben perder acceso.
 */
class PermissionMatrixEnforcementTest extends TestCase
{
    use RefreshDatabase;

    public function test_engineering_cannot_create_deliverable_by_default(): void
    {
        $engineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);
        $subject  = Subject::factory()->create();

        $this->actingAs($engineer, 'sanctum')
            ->postJson('/api/deliverables', ['subject_id' => $subject->id, 'name' => 'Módulo 1'])
            ->assertStatus(403);
    }

    public function test_engineering_can_create_deliverable_once_granted_entregables_manage(): void
    {
        SystemPermission::where('module', 'entregables')->where('action', 'manage')
            ->update(['allowed_roles' => ['admin', 'coordinator', 'engineering']]);

        $engineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);
        $subject  = Subject::factory()->create();

        $this->actingAs($engineer, 'sanctum')
            ->postJson('/api/deliverables', ['subject_id' => $subject->id, 'name' => 'Módulo 1'])
            ->assertStatus(200);

        $this->assertDatabaseHas('deliverables', ['name' => 'Módulo 1']);
    }

    public function test_engineering_can_update_and_delete_deliverable_once_granted(): void
    {
        SystemPermission::where('module', 'entregables')->where('action', 'manage')
            ->update(['allowed_roles' => ['admin', 'coordinator', 'engineering']]);

        $engineer    = User::factory()->create(['role' => 'engineering', 'is_active' => true]);
        $deliverable = Deliverable::factory()->create(['name' => 'Original']);

        $this->actingAs($engineer, 'sanctum')
            ->putJson("/api/deliverables/{$deliverable->id}", ['name' => 'Actualizado'])
            ->assertStatus(200);
        $this->assertDatabaseHas('deliverables', ['id' => $deliverable->id, 'name' => 'Actualizado']);

        $this->actingAs($engineer, 'sanctum')
            ->deleteJson("/api/deliverables/{$deliverable->id}")
            ->assertStatus(200);
        $this->assertSoftDeleted('deliverables', ['id' => $deliverable->id]);
    }

    public function test_admin_and_coordinator_retain_deliverable_management_by_default(): void
    {
        $admin       = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $coordinator = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);
        $subject     = Subject::factory()->create();

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/deliverables', ['subject_id' => $subject->id, 'name' => 'Módulo Admin'])
            ->assertStatus(200);

        $this->actingAs($coordinator, 'sanctum')
            ->postJson('/api/deliverables', ['subject_id' => $subject->id, 'name' => 'Módulo Coordinador'])
            ->assertStatus(200);
    }

    public function test_engineering_cannot_view_all_calendar_activities_by_default(): void
    {
        $engineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);

        $this->actingAs($engineer, 'sanctum')
            ->getJson('/api/calendar/all-activities')
            ->assertStatus(403);
    }

    public function test_engineering_can_view_all_calendar_activities_once_granted(): void
    {
        SystemPermission::where('module', 'calendario')->where('action', 'view_all')
            ->update(['allowed_roles' => ['admin', 'coordinator', 'engineering']]);

        $engineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);

        $this->actingAs($engineer, 'sanctum')
            ->getJson('/api/calendar/all-activities')
            ->assertStatus(200);
    }

    public function test_auth_me_exposes_current_permissions_for_the_users_role(): void
    {
        $engineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);

        $before = $this->actingAs($engineer, 'sanctum')->getJson('/api/auth/me');
        $before->assertOk();
        $this->assertNotContains('entregables.manage', $before->json('data.permissions'));

        SystemPermission::where('module', 'entregables')->where('action', 'manage')
            ->update(['allowed_roles' => ['admin', 'coordinator', 'engineering']]);

        $after = $this->actingAs($engineer, 'sanctum')->getJson('/api/auth/me');
        $after->assertOk();
        $this->assertContains('entregables.manage', $after->json('data.permissions'));
    }
}
