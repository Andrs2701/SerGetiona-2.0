<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleActivityObserverTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Regresión: el commit e48dc36 (instrumentación de production_events) movió
     * la sincronización de status a "updated" (después del UPDATE), donde mutar
     * atributos ya no se persiste — solo cambia el objeto en memoria. Esta prueba
     * habría fallado con ese bug: fresh() habría devuelto el status viejo.
     */
    public function test_removing_the_responsible_from_an_existing_activity_persists_not_applicable(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $user        = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'responsible_id'  => $user->id,
            'commitment_date' => now()->addDays(5)->toDateString(),
            'status'          => 'not_started',
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $activity->update(['responsible_id' => null]);

        $this->assertSame('not_applicable', $activity->fresh()->status);
        $this->assertNull($activity->fresh()->responsible_id);
        $this->assertNull($activity->fresh()->actual_delivery_date);
    }

    public function test_reassigning_a_not_applicable_activity_persists_not_started(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $user        = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'responsible_id'  => null,
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $this->assertSame('not_applicable', $activity->fresh()->status);

        $activity->update(['responsible_id' => $user->id]);

        $this->assertSame('not_started', $activity->fresh()->status);
    }

    public function test_assigned_at_is_set_on_creation_and_refreshed_on_every_reassignment(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $userA       = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);
        $userB       = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'responsible_id'  => $userA->id,
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $firstAssignedAt = $activity->fresh()->assigned_at;
        $this->assertNotNull($firstAssignedAt);

        // El timeline muestra "Asignada a {responsable actual}" junto a esta
        // fecha, así que al reasignar debe reflejar la fecha de la persona
        // que quedó, no la de quien tuvo el rol primero.
        $this->travel(1)->hours();
        $activity->update(['responsible_id' => $userB->id]);

        $secondAssignedAt = $activity->fresh()->assigned_at;
        $this->assertNotNull($secondAssignedAt);
        $this->assertTrue($secondAssignedAt->gt($firstAssignedAt));
    }
}
