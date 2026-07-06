<?php

namespace Tests\Feature;

use App\Models\SystemSetting;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPresenceTest extends TestCase
{
    use RefreshDatabase;

    public function test_middleware_updates_last_active_at_on_authenticated_requests(): void
    {
        $user = User::factory()->create(['role' => 'expert', 'is_active' => true]);

        $this->assertNull($user->last_active_at);

        // Realizar request autenticado para disparar el middleware UpdateUserActivity
        $this->actingAs($user, 'sanctum')
            ->getJson('/api/preferences')
            ->assertOk();

        $user->refresh();
        $this->assertNotNull($user->last_active_at);
    }

    public function test_admin_can_list_users_with_presence_data(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        // Asegurarse de que el setting inicial existe en BD
        SystemSetting::firstOrCreate(
            ['key' => 'presence.online_threshold_minutes'],
            ['value' => '5', 'label' => 'Minutos online', 'group' => 'presence']
        );

        Carbon::setTestNow(now());

        // Crear usuarios de prueba con la columna last_active_at seteada
        $userOnline = User::factory()->create([
            'role' => 'expert', 
            'is_active' => true,
            'last_active_at' => now()->subMinutes(2)
        ]);
        $userOffline = User::factory()->create([
            'role' => 'design', 
            'is_active' => true,
            'last_active_at' => now()->subMinutes(10)
        ]);
        $userNever = User::factory()->create([
            'role' => 'pedagogy', 
            'is_active' => true,
            'last_active_at' => null
        ]);

        // Petición del admin
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk();

        // Verificar userOnline
        $response->assertJsonFragment([
            'id' => $userOnline->id,
            'is_online' => true,
            'last_active_at' => now()->subMinutes(2)->toIso8601String(),
        ]);

        // Verificar userOffline
        $response->assertJsonFragment([
            'id' => $userOffline->id,
            'is_online' => false,
            'last_active_at' => now()->subMinutes(10)->toIso8601String(),
        ]);

        // Verificar userNever
        $response->assertJsonFragment([
            'id' => $userNever->id,
            'is_online' => false,
            'last_active_at' => null,
        ]);
    }

    public function test_changing_presence_threshold_affects_is_online(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        // Crear setting con 15 minutos de umbral
        $setting = SystemSetting::firstOrCreate(
            ['key' => 'presence.online_threshold_minutes'],
            ['value' => '15', 'label' => 'Minutos online', 'group' => 'presence']
        );
        $setting->value = '15';
        $setting->save();
        SystemSetting::flushCache('presence.online_threshold_minutes');

        Carbon::setTestNow(now());
        $userOffline = User::factory()->create([
            'role' => 'design', 
            'is_active' => true,
            'last_active_at' => now()->subMinutes(10)
        ]);

        // Petición del admin
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk();

        // Verificar que ahora está online
        $response->assertJsonFragment([
            'id' => $userOffline->id,
            'is_online' => true,
            'last_active_at' => now()->subMinutes(10)->toIso8601String(),
        ]);
    }
}
