<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\Notification;
use App\Models\RoleActivity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $coordinator;
    private User $expert;
    private User $pedagogue;
    private Deliverable $deliverable;
    private RoleActivity $expertActivity;
    private RoleActivity $pedagogyActivity;

    protected function setUp(): void
    {
        parent::setUp();

        $this->coordinator = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);
        $this->expert      = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $this->pedagogue   = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $this->deliverable = Deliverable::factory()->create(['name' => 'Semana 1']);

        $this->expertActivity = RoleActivity::factory()->create([
            'deliverable_id' => $this->deliverable->id,
            'role'           => 'expert',
            'responsible_id' => $this->expert->id,
            'status'         => 'in_progress',
        ]);

        $resourceType = \App\Models\ResourceType::where('role', 'expert')->first();
        if ($resourceType) {
            \App\Models\ProductionLog::create([
                'role_activity_id' => $this->expertActivity->id,
                'resource_type_id' => $resourceType->id,
                'quantity' => 1,
                'produced_by' => $this->expert->id,
                'logged_by' => $this->expert->id,
                'produced_at' => now(),
            ]);
        }

        $this->pedagogyActivity = RoleActivity::factory()->create([
            'deliverable_id' => $this->deliverable->id,
            'role'           => 'pedagogy',
            'responsible_id' => $this->pedagogue->id,
            'status'         => 'not_started',
        ]);

        $pedagogyResourceType = \App\Models\ResourceType::where('role', 'pedagogy')->first();
        if ($pedagogyResourceType) {
            \App\Models\ProductionLog::create([
                'role_activity_id' => $this->pedagogyActivity->id,
                'resource_type_id' => $pedagogyResourceType->id,
                'quantity' => 1,
                'produced_by' => $this->pedagogue->id,
                'logged_by' => $this->pedagogue->id,
                'produced_at' => now(),
            ]);
        }
    }

    public function test_assignment_notification_includes_required_fields(): void
    {
        $newExpert = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $this->actingAs($this->coordinator, 'sanctum')
            ->putJson("/api/activities/{$this->expertActivity->id}", [
                'responsible_id' => $newExpert->id,
            ])
            ->assertOk();

        $notif = Notification::where('user_id', $newExpert->id)
            ->where('type', 'task_assigned')
            ->first();

        $this->assertNotNull($notif);

        $project = $this->deliverable->subject->academicProgram->project;
        $program = $this->deliverable->subject->academicProgram;

        // Mensaje enriquecido: proyecto, programa, actividad (rol), estado y fecha límite
        $this->assertStringContainsString($project->name, $notif->message);
        $this->assertStringContainsString($program->name, $notif->message);
        $this->assertStringContainsString('Experto Temático', $notif->message);
        $this->assertStringContainsString('Estado actual', $notif->message);
        $this->assertStringContainsString('Fecha límite', $notif->message);

        // Debe decir quién hizo la asignación, no solo qué se asignó.
        $this->assertStringContainsString($this->coordinator->name, $notif->message);
    }

    public function test_quick_action_deliver_enables_next_role_and_notifies(): void
    {
        $response = $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/activities/{$this->expertActivity->id}/quick-action", [
                'action' => 'deliver',
            ])
            ->assertOk();

        // La actividad del siguiente rol pasa a in_progress automáticamente
        $this->assertEquals('in_progress', $this->pedagogyActivity->fresh()->status);

        // La respuesta incluye el siguiente rol del flujo
        $response->assertJsonPath('next_role', 'pedagogy');

        // El responsable del siguiente rol recibe notificación
        $this->assertTrue(
            Notification::where('user_id', $this->pedagogue->id)
                ->where('type', 'next_in_chain')
                ->exists()
        );

        // Coordinadores/admins reciben notificación cruzada del cambio
        $this->assertTrue(
            Notification::where('user_id', $this->coordinator->id)
                ->where('type', 'status_changed')
                ->exists()
        );
    }

    public function test_update_to_approved_enables_next_role_and_notifies(): void
    {
        $this->expertActivity->update(['status' => 'delivered']);

        $this->actingAs($this->coordinator, 'sanctum')
            ->putJson("/api/activities/{$this->expertActivity->id}", [
                'status' => 'approved',
            ])
            ->assertOk();

        $this->assertEquals('in_progress', $this->pedagogyActivity->fresh()->status);

        $this->assertTrue(
            Notification::where('user_id', $this->pedagogue->id)
                ->where('type', 'next_in_chain')
                ->exists()
        );
    }

    public function test_chain_does_not_regress_an_already_started_next_activity(): void
    {
        $this->pedagogyActivity->update(['status' => 'in_review']);

        $this->actingAs($this->expert, 'sanctum')
            ->postJson("/api/activities/{$this->expertActivity->id}/quick-action", [
                'action' => 'deliver',
            ])
            ->assertOk();

        // No se pisa el estado del siguiente rol si ya estaba avanzado
        $this->assertEquals('in_review', $this->pedagogyActivity->fresh()->status);

        // Pero sí se le notifica que es su turno
        $this->assertTrue(
            Notification::where('user_id', $this->pedagogue->id)
                ->where('type', 'next_in_chain')
                ->exists()
        );
    }

    public function test_concurrent_quick_action_does_not_duplicate_notifications(): void
    {
        $this->expertActivity->update(['status' => 'delivered']);

        // Primer approve: legítimo, notifica y avanza la cadena.
        $this->actingAs($this->coordinator, 'sanctum')
            ->postJson("/api/activities/{$this->expertActivity->id}/quick-action", ['action' => 'approve'])
            ->assertOk();

        $notifCountAfterFirst = Notification::where('user_id', $this->coordinator->id)
            ->where('type', 'status_changed')
            ->count();

        // Segundo approve "concurrente" (simulado: dos usuarios aprobando casi a
        // la vez terminan enviando este mismo request por separado): la actividad
        // ya está aprobada, así que debe ser un no-op — sin duplicar notificación
        // ni volver a avanzar la cadena.
        $this->actingAs($this->coordinator, 'sanctum')
            ->postJson("/api/activities/{$this->expertActivity->id}/quick-action", ['action' => 'approve'])
            ->assertOk()
            ->assertJsonPath('next_role', null);

        $this->assertEquals('approved', $this->expertActivity->fresh()->status);

        $notifCountAfterSecond = Notification::where('user_id', $this->coordinator->id)
            ->where('type', 'status_changed')
            ->count();

        $this->assertEquals(
            $notifCountAfterFirst,
            $notifCountAfterSecond,
            'El segundo intento concurrente no debe duplicar notificaciones.'
        );
    }

    public function test_findings_return_preserves_delivery_date_and_is_not_overdue(): void
    {
        $qaUser = User::factory()->create(['role' => 'qa', 'is_active' => true]);
        $qaActivity = RoleActivity::factory()->create([
            'deliverable_id' => $this->deliverable->id,
            'role'           => 'qa',
            'responsible_id' => $qaUser->id,
            'status'         => 'in_review',
        ]);

        $this->expertActivity->update(['commitment_date' => now()->subDays(3)->toDateString()]);

        // 1) El experto entrega por primera vez.
        $this->actingAs($this->expert, 'sanctum')
            ->putJson("/api/activities/{$this->expertActivity->id}", ['status' => 'delivered'])
            ->assertOk();

        $firstDelivery = $this->expertActivity->fresh();
        $this->assertNotNull($firstDelivery->actual_delivery_date);
        $firstDeliveryDate = $firstDelivery->actual_delivery_date->toDateString();
        $this->assertEquals($firstDeliveryDate, $firstDelivery->first_delivered_at->toDateString());

        // 2) QA devuelve la actividad del experto con hallazgos.
        $this->actingAs($qaUser, 'sanctum')
            ->putJson("/api/activities/{$qaActivity->id}", [
                'status'       => 'adjustments_requested',
                'adjust_roles' => ['expert'],
            ])
            ->assertOk();

        $returned = $this->expertActivity->fresh();
        $this->assertEquals('adjustments_requested', $returned->status);
        // La fecha de la primera entrega no se borra.
        $this->assertNotNull($returned->actual_delivery_date);
        $this->assertEquals($firstDeliveryDate, $returned->actual_delivery_date->toDateString());
        $this->assertEquals($firstDeliveryDate, $returned->first_delivered_at->toDateString());

        // Aunque su fecha comprometida ya pasó, no debe contar como vencida.
        $this->assertFalse(
            RoleActivity::overdue()->whereKey($returned->id)->exists(),
            'Una actividad devuelta con hallazgos no debe considerarse vencida.'
        );

        // 3) El experto corrige y vuelve a entregar (segunda entrega, otro día).
        $this->travelTo(now()->addDay());
        $this->actingAs($this->expert, 'sanctum')
            ->putJson("/api/activities/{$this->expertActivity->id}", ['status' => 'delivered'])
            ->assertOk();

        $redelivered = $this->expertActivity->fresh();
        $this->assertEquals('delivered', $redelivered->status);
        $this->assertNotNull($redelivered->actual_delivery_date);
        // La fecha "en vivo" avanza a la segunda entrega...
        $this->assertNotEquals($firstDeliveryDate, $redelivered->actual_delivery_date->toDateString());
        // ...pero la fecha de la primera entrega nunca cambia.
        $this->assertEquals($firstDeliveryDate, $redelivered->first_delivered_at->toDateString());
    }

    public function test_last_role_in_chain_has_no_next(): void
    {
        $qaUser     = User::factory()->create(['role' => 'qa', 'is_active' => true]);
        $qaActivity = RoleActivity::factory()->create([
            'deliverable_id' => $this->deliverable->id,
            'role'           => 'qa',
            'responsible_id' => $qaUser->id,
            'status'         => 'in_progress',
        ]);

        $this->actingAs($qaUser, 'sanctum')
            ->postJson("/api/activities/{$qaActivity->id}/quick-action", [
                'action' => 'deliver',
            ])
            ->assertOk()
            ->assertJsonPath('next_role', null);
    }
}
