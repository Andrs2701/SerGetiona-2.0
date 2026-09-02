<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\RoleActivityController;
use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * RoleActivityController::recalculateGlobalStatus() y el "Caso A" de
 * update() (QA se aprueba a sí mismo -> termina el entregable y aprueba a
 * los roles hermanos) no tenían ningún test en todo el repo antes de este
 * archivo — se agregan aquí junto con la corrección del caso "sin Calidad".
 */
class RoleActivityControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $expert;
    private User $pedagogue;
    private User $qa;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin     = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $this->expert    = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $this->pedagogue = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);
        $this->qa        = User::factory()->create(['role' => 'qa', 'is_active' => true]);
    }

    /**
     * Reporte real (captura de producción): entregables sin nadie de
     * Calidad asignado quedaban encallados en "En Revisión" para siempre
     * en 100% de avance, porque solo QA puede disparar el "Caso A" que
     * termina el entregable — y sin fila de QA nunca existe quien lo haga.
     */
    public function test_deliverable_finishes_automatically_when_qa_role_has_no_activity_row(): void
    {
        $deliverable = Deliverable::factory()->create(['global_status' => 'in_review']);

        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'expert',
            'responsible_id' => $this->expert->id,
            'status'         => 'approved',
        ]);
        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'pedagogy',
            'responsible_id' => $this->pedagogue->id,
            'status'         => 'in_review', // entregado pero nunca aprobado formalmente por nadie
        ]);
        // Sin fila para 'qa' en absoluto — nunca se creó para este entregable.

        RoleActivityController::recalculateGlobalStatus($deliverable->fresh());

        $deliverable->refresh();
        $this->assertSame('finished', $deliverable->global_status);

        // A diferencia del Caso A (QA aprobando), aquí NO se reescribe el
        // estado individual del rol — sigue reflejando fielmente que nadie
        // lo aprobó formalmente (no hay QA que lo haga).
        $pedagogyActivity = $deliverable->roleActivities()->where('role', 'pedagogy')->first();
        $this->assertSame('in_review', $pedagogyActivity->status);
    }

    /** Mismo caso que arriba pero con la fila de QA existente y marcada explícitamente 'not_applicable'. */
    public function test_deliverable_finishes_automatically_when_qa_role_is_explicitly_not_applicable(): void
    {
        $deliverable = Deliverable::factory()->create(['global_status' => 'in_review']);

        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'expert',
            'responsible_id' => $this->expert->id,
            'status'         => 'delivered',
        ]);
        RoleActivity::factory()->create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'qa',
            'responsible_id'  => null,
            'status'          => 'not_applicable',
        ]);

        RoleActivityController::recalculateGlobalStatus($deliverable->fresh());

        $deliverable->refresh();
        $this->assertSame('finished', $deliverable->global_status);
    }

    /**
     * Cuando SÍ hay alguien de Calidad asignado, la lógica no cambia: el
     * entregable no debe terminar solo porque el resto de roles ya
     * entregó — sigue esperando la aprobación explícita de QA.
     */
    public function test_deliverable_does_not_finish_early_when_qa_is_assigned_but_has_not_approved(): void
    {
        $deliverable = Deliverable::factory()->create(['global_status' => 'in_review']);

        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'expert',
            'responsible_id' => $this->expert->id,
            'status'         => 'approved',
        ]);
        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'pedagogy',
            'responsible_id' => $this->pedagogue->id,
            'status'         => 'delivered',
        ]);
        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'qa',
            'responsible_id' => $this->qa->id,
            'status'         => 'not_started',
        ]);

        RoleActivityController::recalculateGlobalStatus($deliverable->fresh());

        $deliverable->refresh();
        $this->assertNotSame('finished', $deliverable->global_status);
        $this->assertSame('in_progress', $deliverable->global_status);

        // Los roles hermanos NO se tocan sin la aprobación explícita de QA.
        $pedagogyActivity = $deliverable->roleActivities()->where('role', 'pedagogy')->first();
        $this->assertSame('delivered', $pedagogyActivity->status);
    }

    /** Sin QA, pero un rol aplicable todavía no ha entregado nada: no debe terminar antes de tiempo. */
    public function test_deliverable_without_qa_does_not_finish_while_a_role_is_still_active(): void
    {
        $deliverable = Deliverable::factory()->create(['global_status' => 'in_progress']);

        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'expert',
            'responsible_id' => $this->expert->id,
            'status'         => 'approved',
        ]);
        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'pedagogy',
            'responsible_id' => $this->pedagogue->id,
            'status'         => 'in_progress', // aún no entrega
        ]);

        RoleActivityController::recalculateGlobalStatus($deliverable->fresh());

        $deliverable->refresh();
        $this->assertNotSame('finished', $deliverable->global_status);
    }

    /**
     * Comportamiento existente (Caso A de update()), sin ningún test previo
     * en el repo: QA aprobando su propia actividad termina el entregable y
     * aprueba a los roles hermanos que estaban delivered/in_review.
     */
    public function test_qa_approving_finishes_deliverable_and_approves_sibling_roles(): void
    {
        $deliverable = Deliverable::factory()->create(['global_status' => 'in_review']);

        RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'expert',
            'responsible_id' => $this->expert->id,
            'status'         => 'delivered',
        ]);
        $qaActivity = RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'qa',
            'responsible_id' => $this->qa->id,
            'status'         => 'in_review',
        ]);

        $this->actingAs($this->qa, 'sanctum')
            ->putJson("/api/activities/{$qaActivity->id}", ['status' => 'approved'])
            ->assertStatus(200);

        $deliverable->refresh();
        $this->assertSame('finished', $deliverable->global_status);

        $expertActivity = $deliverable->roleActivities()->where('role', 'expert')->first();
        $this->assertSame('approved', $expertActivity->status);
    }
}
