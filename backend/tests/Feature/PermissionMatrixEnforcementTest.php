<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\SystemPermission;
use App\Models\Subject;
use App\Models\User;
use App\Models\VisibilityRule;
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

    /**
     * Regresión: index() tenía su propia lista fija de roles ("operativos ven
     * solo lo asignado") que ignoraba el Alcance de Visibilidad de
     * Configuración — un admin podía marcar "Ve todo" para un rol ahí y el
     * listado de entregables seguía sin mostrarle más que lo suyo.
     */
    public function test_deliverables_index_respects_visibility_rule_scope(): void
    {
        $engineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);
        $otherEngineer = User::factory()->create(['role' => 'engineering', 'is_active' => true]);

        $mine = Deliverable::factory()->create(['name' => 'Mío']);
        RoleActivity::factory()->create([
            'deliverable_id' => $mine->id, 'role' => 'engineering', 'responsible_id' => $engineer->id,
        ]);

        $notMine = Deliverable::factory()->create(['name' => 'De otro']);
        RoleActivity::factory()->create([
            'deliverable_id' => $notMine->id, 'role' => 'engineering', 'responsible_id' => $otherEngineer->id,
        ]);

        // Por defecto (assigned_only): solo ve el suyo.
        $before = $this->actingAs($engineer, 'sanctum')->getJson('/api/deliverables');
        $before->assertOk();
        $namesBefore = collect($before->json())->pluck('name');
        $this->assertTrue($namesBefore->contains('Mío'));
        $this->assertFalse($namesBefore->contains('De otro'));

        // Al cambiar su Alcance de Visibilidad a "all", ve todos.
        VisibilityRule::updateOrCreate(['role_slug' => 'engineering'], ['scope' => 'all']);

        $after = $this->actingAs($engineer, 'sanctum')->getJson('/api/deliverables');
        $after->assertOk();
        $namesAfter = collect($after->json())->pluck('name');
        $this->assertTrue($namesAfter->contains('Mío'));
        $this->assertTrue($namesAfter->contains('De otro'));
    }
}
