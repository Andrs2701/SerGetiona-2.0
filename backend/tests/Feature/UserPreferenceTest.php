<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPreferenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_gets_default_preference_on_first_request(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $res = $this->actingAs($user, 'sanctum')
            ->getJson('/api/preferences')
            ->assertStatus(200);

        $this->assertEquals('table', $res->json('preferences.portfolio_view'));
    }

    public function test_user_can_update_portfolio_view(): void
    {
        $user = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/preferences', ['portfolio_view' => 'cards'])
            ->assertStatus(200)
            ->assertJsonPath('preferences.portfolio_view', 'cards');

        $this->assertDatabaseHas('user_preferences', [
            'user_id'        => $user->id,
            'portfolio_view' => 'cards',
        ]);
    }

    public function test_user_cannot_set_invalid_view(): void
    {
        $user = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/preferences', ['portfolio_view' => 'kanban'])
            ->assertStatus(422);
    }

    public function test_preference_persists_across_requests(): void
    {
        $user = User::factory()->create(['role' => 'coordinator', 'is_active' => true]);

        $this->actingAs($user, 'sanctum')
            ->putJson('/api/preferences', ['portfolio_view' => 'timeline'])
            ->assertStatus(200);

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/preferences')
            ->assertJsonPath('preferences.portfolio_view', 'timeline');
    }
}
