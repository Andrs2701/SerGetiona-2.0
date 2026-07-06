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
