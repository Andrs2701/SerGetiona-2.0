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

    /**
     * "Actividad creada" en la línea de tiempo nunca decía quién la creó
     * porque ningún controlador seteaba created_by — se centraliza en el
     * observer, igual que ya pasaba con assigned_at.
     */
    public function test_created_by_is_set_from_the_acting_user(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $creator     = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);

        $this->actingAs($creator, 'sanctum');

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $this->assertSame($creator->id, $activity->fresh()->created_by);
    }

    /**
     * Igual que assigned_at: assigned_by debe reflejar quién hizo la
     * reasignación ACTUAL, no quién asignó al primer responsable.
     */
    public function test_assigned_by_is_set_on_creation_and_updated_on_reassignment(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $userA       = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);
        $userB       = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);
        $creator     = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);
        $reassigner  = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($creator, 'sanctum');
        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'responsible_id'  => $userA->id,
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $this->assertSame($creator->id, $activity->fresh()->assigned_by);

        $this->actingAs($reassigner, 'sanctum');
        $activity->update(['responsible_id' => $userB->id]);

        $this->assertSame($reassigner->id, $activity->fresh()->assigned_by);
    }

    /**
     * La Línea de tiempo mostraba "Actividad creada — {rol}" sin decir
     * quién, y "Asignada a {responsable}" sin decir quién hizo la
     * asignación — ambos ahora deben traer el nombre real.
     */
    public function test_deliverable_timeline_shows_creator_and_assigner_names(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $creator     = User::factory()->create(['role' => 'coordinator', 'is_active' => true, 'name' => 'Coordinadora Uno']);
        $responsible = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $this->actingAs($creator, 'sanctum');
        RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'responsible_id'  => $responsible->id,
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $res = $this->actingAs($creator, 'sanctum')
            ->getJson("/api/deliverables/{$deliverable->id}/timeline")
            ->assertOk();

        $events = collect($res->json('events'));
        $created = $events->firstWhere('type', 'created');
        $assigned = $events->firstWhere('type', 'assigned');

        $this->assertSame('Coordinadora Uno', $created['user']);
        $this->assertSame('Coordinadora Uno', $assigned['user']);
    }

    /**
     * Mismo caso que test_deliverable_timeline_shows_creator_and_assigner_names,
     * pero contra GET /api/activities/{id}/timeline (RoleActivityController::
     * timeline) — un endpoint hermano y distinto del de
     * /api/deliverables/{id}/timeline, con su propio bug: 'created'/'assigned'
     * quedaban con 'user' => null a secas en vez de leer creator()/assignedBy().
     */
    public function test_activity_timeline_shows_creator_and_assigner_names(): void
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $creator     = User::factory()->create(['role' => 'coordinator', 'is_active' => true, 'name' => 'Coordinadora Uno']);
        $responsible = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $this->actingAs($creator, 'sanctum');
        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'pedagogy',
            'responsible_id'  => $responsible->id,
            'checklist'       => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        $res = $this->actingAs($creator, 'sanctum')
            ->getJson("/api/activities/{$activity->id}/timeline")
            ->assertOk();

        $events = collect($res->json('events'));
        $created = $events->firstWhere('type', 'created');
        $assigned = $events->firstWhere('type', 'assigned');

        $this->assertSame('Coordinadora Uno', $created['user']);
        $this->assertSame('Coordinadora Uno', $assigned['user']);
    }
}
