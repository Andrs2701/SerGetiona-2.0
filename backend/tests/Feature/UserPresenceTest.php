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

    public function test_admin_can_list_users_with_presence_data(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);

        // Asegurarse de que el setting inicial existe en BD
        SystemSetting::firstOrCreate(
            ['key' => 'presence.online_threshold_minutes'],
            ['value' => '5', 'label' => 'Minutos online', 'group' => 'presence']
        );

        // Crear usuarios de prueba
        $userOnline = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $userOffline = User::factory()->create(['role' => 'design', 'is_active' => true]);
        $userNever = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        // Token reciente para userOnline (hace 2 minutos)
        Carbon::setTestNow(now());
        $tokenOnline = $userOnline->createToken('test-token');
        $tokenOnline->accessToken->last_used_at = now()->subMinutes(2);
        $tokenOnline->accessToken->save();

        // Token viejo para userOffline (hace 10 minutos)
        $tokenOffline = $userOffline->createToken('test-token-2');
        $tokenOffline->accessToken->last_used_at = now()->subMinutes(10);
        $tokenOffline->accessToken->save();

        // Petición del admin
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk();

        // Verificar userOnline
        $response->assertJsonFragment([
            'id' => $userOnline->id,
            'is_online' => true,
            'last_active_at' => now()->subMinutes(2)->toDateTimeString(),
        ]);

        // Verificar userOffline
        $response->assertJsonFragment([
            'id' => $userOffline->id,
            'is_online' => false,
            'last_active_at' => now()->subMinutes(10)->toDateTimeString(),
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

        $userOffline = User::factory()->create(['role' => 'design', 'is_active' => true]);

        // Token de hace 10 minutos (debería ser online con umbral 15)
        Carbon::setTestNow(now());
        $tokenOffline = $userOffline->createToken('test-token');
        $tokenOffline->accessToken->last_used_at = now()->subMinutes(10);
        $tokenOffline->accessToken->save();

        // Petición del admin
        $response = $this->actingAs($admin, 'sanctum')
            ->getJson('/api/users')
            ->assertOk();

        // Verificar que ahora está online
        $response->assertJsonFragment([
            'id' => $userOffline->id,
            'is_online' => true,
            'last_active_at' => now()->subMinutes(10)->toDateTimeString(),
        ]);
    }
}
