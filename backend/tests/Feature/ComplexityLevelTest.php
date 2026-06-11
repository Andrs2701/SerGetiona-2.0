<?php

namespace Tests\Feature;

use App\Models\ComplexityLevel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComplexityLevelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $expert;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin  = User::factory()->create(['role' => 'admin',  'is_active' => true]);
        $this->expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);
    }

    public function test_any_authenticated_user_can_list_complexity_levels(): void
    {
        ComplexityLevel::factory()->count(3)->create();

        $this->actingAs($this->expert, 'sanctum')
            ->getJson('/api/complexity-levels')
            ->assertStatus(200)
            ->assertJsonStructure(['levels']);
    }

    public function test_admin_can_create_complexity_level(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/complexity-levels', [
                'name'       => 'Muy Alta',
                'points'     => 13,
                'sort_order' => 5,
            ])
            ->assertStatus(201)
            ->assertJsonPath('name', 'Muy Alta')
            ->assertJsonPath('points', 13);
    }

    public function test_admin_can_update_complexity_level(): void
    {
        $level = ComplexityLevel::create(['name' => 'Baja', 'points' => 1, 'is_active' => true, 'sort_order' => 1]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/complexity-levels/{$level->id}", ['points' => 2])
            ->assertStatus(200)
            ->assertJsonPath('points', 2);
    }

    public function test_admin_cannot_delete_level_in_use(): void
    {
        $level = ComplexityLevel::create(['name' => 'Media', 'points' => 3, 'is_active' => true, 'sort_order' => 2]);
        // Create deliverable referencing this level
        \App\Models\Deliverable::factory()->create(['complexity_level_id' => $level->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/complexity-levels/{$level->id}")
            ->assertStatus(409);
    }

    public function test_non_admin_cannot_delete_complexity_level(): void
    {
        $level = ComplexityLevel::create(['name' => 'Alta', 'points' => 5, 'is_active' => true, 'sort_order' => 3]);

        $this->actingAs($this->expert, 'sanctum')
            ->deleteJson("/api/complexity-levels/{$level->id}")
            ->assertStatus(403);
    }
}
