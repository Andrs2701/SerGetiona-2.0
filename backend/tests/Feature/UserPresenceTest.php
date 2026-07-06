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

        // assertJsonFragment no ata las claves a la MISMA fila — comprobar cada
        // usuario por separado evita falsos positivos (ej. is_online:false de
        // userNever "cubriendo" por error la aserción de userOffline).
        $rows = collect($response->json('data'))->keyBy('id');

        $this->assertSame(true, $rows[$userOnline->id]['is_online']);
        $this->assertSame(now()->subMinutes(2)->toIso8601String(), $rows[$userOnline->id]['last_active_at']);

        $this->assertSame(false, $rows[$userOffline->id]['is_online']);
        $this->assertSame(now()->subMinutes(10)->toIso8601String(), $rows[$userOffline->id]['last_active_at']);

        $this->assertSame(false, $rows[$userNever->id]['is_online']);
        $this->assertNull($rows[$userNever->id]['last_active_at']);
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

        // Verificar que ahora está online (10 min de inactividad, umbral 15 min)
        $row = collect($response->json('data'))->keyBy('id')[$userOffline->id];
        $this->assertSame(true, $row['is_online']);
        $this->assertSame(now()->subMinutes(10)->toIso8601String(), $row['last_active_at']);
    }

    public function test_admin_can_update_user_without_password_issue(): void
    {
        $admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
        $user = User::factory()->create(['role' => 'expert', 'is_active' => true]);
        $oldPassword = $user->password;

        $response = $this->actingAs($admin, 'sanctum')
            ->putJson('/api/users/' . $user->id, [
                'name' => 'Camilo Editado',
                'role' => 'coordinator',
                'password' => '',
            ])
            ->assertOk();

        $user->refresh();
        $this->assertEquals('Camilo Editado', $user->name);
        $this->assertEquals('coordinator', $user->role);
        $this->assertEquals($oldPassword, $user->password);
    }
}
