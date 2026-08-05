<?php

namespace Tests\Feature;

use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ReportControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    /**
     * El dashboard, el desglose por programa y el desglose por rol usaban 3
     * implementaciones separadas de "vencida". Esta prueba fija un escenario
     * con casos límite (entregada tarde, aprobada, no aplica, fecha futura) y
     * exige que las 3 cifras coincidan siempre entre sí, para que ninguna
     * pueda volver a divergir silenciosamente si alguien edita solo una.
     */
    public function test_overdue_counts_agree_across_dashboard_breakdowns_and_exclude_delivered(): void
    {
        $program = AcademicProgram::factory()->create();
        $subject = Subject::factory()->create(['academic_program_id' => $program->id]);
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $responsible = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $past = now()->subDays(3)->toDateString();
        $future = now()->addDays(10)->toDateString();

        // 1) Vencida de verdad: fecha pasada, sin entregar.
        RoleActivity::factory()->create([
            'deliverable_id'   => $deliverable->id,
            'responsible_id'   => $responsible->id,
            'role'             => 'pedagogy',
            'status'           => 'in_progress',
            'commitment_date'  => $past,
            'actual_delivery_date' => null,
        ]);

        // 2) Ya entregada (tarde), pero entregada: NO debe contar como vencida.
        RoleActivity::factory()->create([
            'deliverable_id'   => $deliverable->id,
            'responsible_id'   => $responsible->id,
            'role'             => 'design',
            'status'           => 'in_review',
            'commitment_date'  => $past,
            'actual_delivery_date' => now()->subDay()->toDateString(),
        ]);

        // 3) Aprobada con fecha pasada: NO debe contar como vencida.
        RoleActivity::factory()->create([
            'deliverable_id'   => $deliverable->id,
            'responsible_id'   => $responsible->id,
            'role'             => 'audiovisual',
            'status'           => 'approved',
            'commitment_date'  => $past,
            'actual_delivery_date' => $past,
        ]);

        // 4) No aplica con fecha pasada: NO debe contar como vencida.
        RoleActivity::factory()->create([
            'deliverable_id'   => $deliverable->id,
            'role'             => 'engineering',
            'status'           => 'not_applicable',
            'commitment_date'  => $past,
            'actual_delivery_date' => null,
        ]);

        // 5) Fecha futura, sin entregar: NO debe contar como vencida (aún no vence).
        RoleActivity::factory()->create([
            'deliverable_id'   => $deliverable->id,
            'responsible_id'   => $responsible->id,
            'role'             => 'qa',
            'status'           => 'not_started',
            'commitment_date'  => $future,
            'actual_delivery_date' => null,
        ]);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/reports/dashboard')
            ->assertStatus(200);

        $data = $res->json();

        $this->assertSame(1, $data['overdue_activities'], 'La tarjeta "Vencidas" debe contar solo la actividad realmente vencida.');

        $programBreakdown = collect($data['programs_breakdown'])->firstWhere('id', $program->id);
        $this->assertNotNull($programBreakdown);
        $this->assertSame(1, $programBreakdown['overdue_count'], 'El desglose por programa debe coincidir con la tarjeta del dashboard.');

        $roleOverdueSum = collect($data['activities_by_role_detail'])->sum('overdue');
        $this->assertSame(1, $roleOverdueSum, 'La suma del desglose por rol debe coincidir con la tarjeta del dashboard.');
    }

    /**
     * El dashboard no tenía ningún filtro (ni siquiera Request en la firma).
     * Esta prueba fija dos actividades vencidas en semanas distintas y exige
     * que ?year=&week= reduzca la tarjeta "Vencidas" a solo la de esa semana,
     * mientras que los conteos estructurales (proyectos/programas) no cambian.
     */
    public function test_dashboard_week_filter_scopes_activity_metrics_but_not_structural_counts(): void
    {
        $program = AcademicProgram::factory()->create();
        $subject = Subject::factory()->create(['academic_program_id' => $program->id]);
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $responsible = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        // Vencida en la semana 12 de 2026 (16-22 mar) — hoy debe ser posterior a esa semana para que cuente como vencida.
        RoleActivity::factory()->create([
            'deliverable_id'  => $deliverable->id,
            'responsible_id'  => $responsible->id,
            'role'            => 'expert',
            'status'          => 'in_progress',
            'commitment_date' => '2026-03-18',
        ]);

        // Vencida en la semana 13 de 2026 (23-29 mar) — no debe contar al filtrar por semana 12.
        RoleActivity::factory()->create([
            'deliverable_id'  => $deliverable->id,
            'responsible_id'  => $responsible->id,
            'role'            => 'pedagogy',
            'status'          => 'in_progress',
            'commitment_date' => '2026-03-25',
        ]);

        $this->travelTo(\Carbon\Carbon::create(2026, 12, 1));

        $unfiltered = $this->actingAs($this->admin, 'sanctum')->getJson('/api/reports/dashboard')->assertOk();
        $this->assertSame(2, $unfiltered->json('overdue_activities'));

        $filtered = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/reports/dashboard?year=2026&week=12')
            ->assertOk();
        $this->assertSame(1, $filtered->json('overdue_activities'));

        // Conteos estructurales: no se acotan por semana (no tienen fecha de compromiso propia).
        $this->assertSame($unfiltered->json('active_projects'), $filtered->json('active_projects'));
        $this->assertSame($unfiltered->json('total_programs'), $filtered->json('total_programs'));
    }

    public function test_dashboard_rejects_week_and_month_combined(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/reports/dashboard?year=2026&week=12&month=3')
            ->assertStatus(422);
    }

    public function test_dashboard_rejects_week_without_year(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/reports/dashboard?week=12')
            ->assertStatus(422);
    }
}
