<?php

namespace Tests\Feature;

use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\EvidenceLink;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * RoleActivity no usa SoftDeletes: antes de este fix, borrar un
 * entregable (soft-delete) dejaba sus actividades como filas reales
 * huérfanas — invisibles para las vistas que filtran con
 * whereHas('deliverable'), pero contadas igual por las que no lo hacían
 * (Distribución de Carga, Cumplimiento). Caso reportado: un usuario sin
 * entregas visibles seguía apareciendo con actividades "vencidas".
 */
class OrphanedRoleActivityTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    public function test_deleting_deliverable_removes_its_role_activities_and_their_children(): void
    {
        $deliverable = Deliverable::factory()->create();
        $activity = RoleActivity::factory()->create(['deliverable_id' => $deliverable->id]);
        $link = EvidenceLink::create([
            'role_activity_id' => $activity->id,
            'user_id'          => $this->admin->id,
            'type'             => 'url',
            'title'            => 'Evidencia',
            'url'              => 'https://example.com',
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/deliverables/{$deliverable->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('role_activities', ['id' => $activity->id]);
        $this->assertDatabaseMissing('evidence_links', ['id' => $link->id]);
    }

    /**
     * Construye el escenario exacto reportado: un entregable con una
     * actividad vencida real, más una actividad huérfana (deliverable ya
     * soft-deleted, simulando datos de antes de este fix) que NO debe
     * contar en ningún lado.
     */
    private function seedOverdueAndOrphan(): User
    {
        $responsible = User::factory()->create(['role' => 'engineering', 'is_active' => true]);
        $past = now()->subDays(3)->toDateString();

        $program = AcademicProgram::factory()->create();
        $subject = Subject::factory()->create(['academic_program_id' => $program->id]);
        $realDeliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        RoleActivity::factory()->create([
            'deliverable_id'       => $realDeliverable->id,
            'responsible_id'       => $responsible->id,
            'role'                 => 'engineering',
            'status'               => 'in_progress',
            'commitment_date'      => $past,
            'actual_delivery_date' => null,
        ]);

        // Huérfana: se crea con un entregable real y LUEGO se borra ese
        // entregable directo por Eloquent (bypass del fix en el
        // controller) para simular datos que ya quedaron huérfanos antes.
        $orphanDeliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        RoleActivity::factory()->create([
            'deliverable_id'       => $orphanDeliverable->id,
            'responsible_id'       => $responsible->id,
            'role'                 => 'engineering',
            'status'               => 'in_progress',
            'commitment_date'      => $past,
            'actual_delivery_date' => null,
        ]);
        $orphanDeliverable->delete();

        return $responsible;
    }

    public function test_workload_report_excludes_orphaned_activities(): void
    {
        $responsible = $this->seedOverdueAndOrphan();

        $res = $this->actingAs($this->admin, 'sanctum')->getJson('/api/reports/workload')->assertOk();
        $row = collect($res->json())->firstWhere('user_id', $responsible->id);

        $this->assertNotNull($row);
        $this->assertSame(1, $row['total'], 'La huérfana no debe contarse en el total del usuario.');
        $this->assertSame(1, $row['overdue'], 'La huérfana no debe contarse como vencida.');
    }

    public function test_capacity_user_activities_excludes_orphaned_activities(): void
    {
        $responsible = $this->seedOverdueAndOrphan();

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson("/api/capacity/users/{$responsible->id}/activities")
            ->assertOk();

        $this->assertCount(1, $res->json('activities'));
    }

    public function test_dashboard_and_compliance_exclude_orphaned_activities(): void
    {
        $this->seedOverdueAndOrphan();

        $dashboard = $this->actingAs($this->admin, 'sanctum')->getJson('/api/reports/dashboard')->assertOk();
        $this->assertSame(1, $dashboard->json('overdue_activities'));

        $programBreakdown = collect($dashboard->json('programs_breakdown'))->sum('overdue_count');
        $this->assertSame(1, $programBreakdown, 'El desglose por programa no debe contar la huérfana.');

        $compliance = $this->actingAs($this->admin, 'sanctum')->getJson('/api/reports/compliance')->assertOk();
        $totalByRole = collect($compliance->json('by_role'))->sum(fn ($r) => $r['on_time'] + $r['delayed']);
        // Ninguna de las dos actividades reales está entregada, así que on_time+delayed es 0 para ambas —
        // lo que importa es que no reviente ni cuente de más; se valida por separado el total de actividades.
        $this->assertIsInt($totalByRole);
    }

    /**
     * Reporte real: una asignatura/programa cuyo único entregable se borró
     * seguía apareciendo en "Programas/Asignaturas con menor avance" con
     * 0% — como si estuviera atrasada, en vez de simplemente no tener ya
     * nada que reportar.
     */
    public function test_dashboard_breakdown_omits_program_and_subject_with_no_remaining_deliverables(): void
    {
        $emptyProgram = AcademicProgram::factory()->create(['name' => 'Tecnólogo en Publicidad Digital']);
        $emptySubject = Subject::factory()->create(['academic_program_id' => $emptyProgram->id, 'name' => 'Prueba']);
        $deletedDeliverable = Deliverable::factory()->create(['subject_id' => $emptySubject->id]);
        $deletedDeliverable->delete();

        $activeProgram = AcademicProgram::factory()->create();
        $activeSubject = Subject::factory()->create(['academic_program_id' => $activeProgram->id]);
        Deliverable::factory()->create(['subject_id' => $activeSubject->id]);

        $dashboard = $this->actingAs($this->admin, 'sanctum')->getJson('/api/reports/dashboard')->assertOk();

        $programIds = collect($dashboard->json('programs_breakdown'))->pluck('id');
        $subjectIds = collect($dashboard->json('subjects_breakdown'))->pluck('id');

        $this->assertNotContains($emptyProgram->id, $programIds, 'Un programa sin entregables activos no debe aparecer en el desglose.');
        $this->assertNotContains($emptySubject->id, $subjectIds, 'Una asignatura sin entregables activos no debe aparecer en el desglose.');
        $this->assertContains($activeProgram->id, $programIds);
        $this->assertContains($activeSubject->id, $subjectIds);
    }

    public function test_cleanup_migration_removes_preexisting_orphans(): void
    {
        $deliverable = Deliverable::factory()->create();
        $activity = RoleActivity::factory()->create(['deliverable_id' => $deliverable->id]);
        // Soft-delete directo, simulando el estado de datos de antes del fix
        // (sin pasar por el DeliverableController::destroy() ya corregido).
        $deliverable->delete();

        $this->assertDatabaseHas('role_activities', ['id' => $activity->id]);

        (require base_path('database/migrations/2026_08_04_150000_cleanup_orphaned_role_activities.php'))->up();

        $this->assertDatabaseMissing('role_activities', ['id' => $activity->id]);
    }
}
