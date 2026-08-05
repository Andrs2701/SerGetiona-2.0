<?php

use App\Models\SystemPermission;
use Illuminate\Database\Migrations\Migration;

/**
 * Corrige el allowed_roles con el que quedó sembrado "projects.view" —
 * la migración 2026_08_04_090000 (y el seeder original) lo abrían a los 8
 * roles por defecto, lo que dejaba "Escuelas / Proyectos" visible en el
 * menú de cualquier rol operativo (Diseño, Pedagogía, Experto, etc.) sin
 * que un admin lo hubiera autorizado explícitamente desde la Matriz de
 * Permisos. Reportado en producción: un usuario con rol Diseño veía el
 * enlace y los botones de gestión del módulo.
 *
 * Usa update() (no firstOrCreate) a propósito: la fila ya existe en
 * cualquier entorno donde ya corrió esa migración — firstOrCreate no la
 * tocaría. No afecta el acceso de un rol operativo a un proyecto
 * puntual donde sí tiene actividades asignadas, que sigue funcionando
 * aparte vía ResourceAccess::canAccessProject() y no depende de este
 * permiso.
 */
return new class extends Migration
{
    public function up(): void
    {
        SystemPermission::where('module', 'projects')->where('action', 'view')
            ->update(['allowed_roles' => ['admin', 'coordinator']]);
    }

    public function down(): void
    {
        SystemPermission::where('module', 'projects')->where('action', 'view')
            ->update(['allowed_roles' => ['admin', 'coordinator', 'expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa']]);
    }
};
