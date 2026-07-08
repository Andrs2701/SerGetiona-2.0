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
}
