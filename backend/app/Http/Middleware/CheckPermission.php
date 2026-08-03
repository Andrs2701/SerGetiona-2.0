<?php

namespace App\Http\Middleware;

use App\Models\SystemPermission;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gatekeeper dinámico basado en la Matriz de Permisos (system_permissions),
 * a diferencia de CheckRole que usa una lista fija de roles pasada en la
 * ruta. Uso: ->middleware('permission:modulo,accion').
 */
class CheckPermission
{
    public function handle(Request $request, Closure $next, string $module, string $action): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        if (!SystemPermission::isAllowed($user->role, $module, $action)) {
            return response()->json(['message' => 'No tienes permiso para realizar esta acción.'], 403);
        }

        return $next($request);
    }
}
