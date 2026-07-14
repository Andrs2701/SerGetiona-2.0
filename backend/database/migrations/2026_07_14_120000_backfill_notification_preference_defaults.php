<?php

use App\Models\UserPreference;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    /**
     * Cambia el default de notificaciones por correo a "solo Tareas" también
     * para usuarios que ya tenían una fila en user_preferences. No existe
     * ninguna columna que distinga "usuario que personalizó" de "usuario que
     * nunca tocó sus preferencias", así que esto reactiva el default nuevo
     * para todos por igual — decisión de negocio explícita, no un descuido.
     */
    public function up(): void
    {
        UserPreference::query()->update([
            'email_chat' => false,
            'email_deadlines' => false,
        ]);
    }

    /**
     * Revertir vuelve a activar Chat y Vencimientos para todos, igual que
     * antes de esta migración.
     */
    public function down(): void
    {
        UserPreference::query()->update([
            'email_chat' => true,
            'email_deadlines' => true,
        ]);
    }
};
