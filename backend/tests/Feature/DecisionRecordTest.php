<?php

namespace Tests\Feature;

use App\Models\DecisionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DecisionRecordTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $coordinator;
    private User $expert;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin       = User::factory()->create(['role' => 'admin',       'is_active' => true]);
        $this->coordinator = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);
        $this->expert      = User::factory()->create(['role' => 'expert',      'is_active' => true]);
    }

    public function test_admin_can_create_decision(): void
    {
        $res = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/decisions', [
                'decision_date' => '2026-06-11',
                'description'   => 'Cambio en metodología de diseño.',
                'status'        => 'pending',
                'impact'        => 'high',
            ]);

        $res->assertStatus(201)
            ->assertJsonPath('status', 'pending')
            ->assertJsonPath('impact', 'high');

        $this->assertDatabaseHas('decision_records', ['description' => 'Cambio en metodología de diseño.']);
    }

    public function test_coordinator_can_update_decision(): void
    {
        $decision = DecisionRecord::create([
            'decision_date' => '2026-06-11',
            'description'   => 'Original',
            'status'        => 'pending',
            'impact'        => 'low',
            'created_by'    => $this->admin->id,
        ]);

        $this->actingAs($this->coordinator, 'sanctum')
            ->putJson("/api/decisions/{$decision->id}", ['status' => 'implemented'])
            ->assertStatus(200)
            ->assertJsonPath('status', 'implemented');
    }

    public function test_expert_cannot_access_decisions(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->getJson('/api/decisions')
            ->assertStatus(403);
    }

    public function test_decisions_list_is_filtered_by_status(): void
    {
        DecisionRecord::create(['decision_date' => '2026-06-11', 'description' => 'A', 'status' => 'pending',     'impact' => 'low', 'created_by' => $this->admin->id]);
        DecisionRecord::create(['decision_date' => '2026-06-11', 'description' => 'B', 'status' => 'implemented', 'impact' => 'low', 'created_by' => $this->admin->id]);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/decisions?status=pending')
            ->assertStatus(200);

        $decisions = $res->json('decisions');
        $this->assertCount(1, $decisions);
        $this->assertEquals('pending', $decisions[0]['status']);
    }

    public function test_admin_can_delete_decision(): void
    {
        $decision = DecisionRecord::create([
            'decision_date' => '2026-06-11',
            'description'   => 'To delete',
            'status'        => 'cancelled',
            'impact'        => 'low',
            'created_by'    => $this->admin->id,
        ]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/decisions/{$decision->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('decision_records', ['id' => $decision->id]);
    }
}
