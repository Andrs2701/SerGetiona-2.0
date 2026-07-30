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
}
