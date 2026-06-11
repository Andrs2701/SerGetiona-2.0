<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CapacityReportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $coordinator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin       = User::factory()->create(['role' => 'admin',       'is_active' => true]);
        $this->coordinator = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);

        // Seed system settings needed by CapacityService
        \App\Models\SystemSetting::insert([
            ['key' => 'capacity_default_points',  'value' => '10', 'label' => 'Puntos por defecto', 'group' => 'capacity'],
            ['key' => 'capacity_default_activity', 'value' => '3',  'label' => 'Puntos actividad',   'group' => 'capacity'],
            ['key' => 'capacity_high_threshold',  'value' => '80', 'label' => 'Umbral alto',        'group' => 'capacity'],
            ['key' => 'capacity_overload_threshold','value'=> '100','label' => 'Umbral sobrecarga', 'group' => 'capacity'],
        ]);
    }

    public function test_capacity_index_returns_expected_shape(): void
    {
        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/capacity')
            ->assertStatus(200);

        $res->assertJsonStructure([
            'summary' => ['capacity_points', 'active_points', 'utilization_pct', 'status'],
            'users',
        ]);
    }

    public function test_capacity_by_role_returns_roles(): void
    {
        $this->actingAs($this->coordinator, 'sanctum')
            ->getJson('/api/capacity/by-role')
            ->assertStatus(200)
            ->assertJsonStructure(['roles']);
    }

    public function test_capacity_trends_returns_series(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/capacity/trends?weeks=4')
            ->assertStatus(200)
            ->assertJsonStructure(['series']);
    }

    public function test_operational_user_cannot_access_capacity(): void
    {
        $expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $this->actingAs($expert, 'sanctum')
            ->getJson('/api/capacity')
            ->assertStatus(403);
    }
}
