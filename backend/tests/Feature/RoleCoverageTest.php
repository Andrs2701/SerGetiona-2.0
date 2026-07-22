<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\RoleCoverage;
use App\Models\User;
use App\Services\ReassignmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleCoverageTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $covering; // role=design, cubriendo audiovisual
    private User $native;   // role=audiovisual, sin cobertura

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin    = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $this->covering = User::factory()->create(['role' => 'design', 'is_active' => true]);
        $this->native   = User::factory()->create(['role' => 'audiovisual', 'is_active' => true]);

        RoleCoverage::create([
            'user_id'       => $this->covering->id,
            'covering_role' => 'audiovisual',
            'starts_at'     => now()->subDay(),
            'ends_at'       => now()->addDay(),
            'reason'        => 'Vacaciones de prueba',
            'created_by'    => $this->admin->id,
        ]);
    }

    public function test_admin_can_create_and_end_a_role_coverage(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/role-coverages', [
                'user_id'       => $this->native->id,
                'covering_role' => 'design',
                'starts_at'     => now()->toDateString(),
            ])
            ->assertStatus(201)
            ->assertJsonPath('covering_role', 'design');

        $coverage = RoleCoverage::where('user_id', $this->native->id)->firstOrFail();

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/role-coverages/{$coverage->id}")
            ->assertStatus(200);

        $this->assertDatabaseMissing('role_coverages', ['id' => $coverage->id]);
    }

    public function test_non_manager_cannot_create_a_role_coverage(): void
    {
        $this->actingAs($this->native, 'sanctum')
            ->postJson('/api/role-coverages', [
                'user_id'       => $this->native->id,
                'covering_role' => 'design',
                'starts_at'     => now()->toDateString(),
            ])
            ->assertStatus(403);
    }

    public function test_user_index_filtered_by_role_includes_active_coverage(): void
    {
        $response = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/users?role=audiovisual')
            ->assertStatus(200);

        $json = $response->json();
        $ids = collect($json['data'] ?? $json)->pluck('id')->all();

        $this->assertContains($this->native->id, $ids, 'El usuario con rol propio audiovisual debe aparecer.');
        $this->assertContains($this->covering->id, $ids, 'El usuario cubriendo audiovisual debe aparecer también.');
    }

    public function test_reassignment_suggestions_include_active_coverage(): void
    {
        $deliverable = Deliverable::factory()->create();
        $activity = RoleActivity::factory()->create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'audiovisual',
            'responsible_id' => $this->native->id,
        ]);

        $suggestions = ReassignmentService::suggestionsFor($activity);
        $suggestedIds = collect($suggestions)->pluck('user_id')->all();

        $this->assertContains($this->covering->id, $suggestedIds, 'El usuario cubriendo audiovisual debe sugerirse como candidato.');
    }
}
