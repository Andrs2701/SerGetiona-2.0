<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'No autenticado.'], 401);
        }

        // Verify role is active in DB
        $roleRecord = \App\Models\SystemRole::where('slug', $user->role)->first();
        if ($roleRecord && !$roleRecord->is_active) {
            return response()->json(['message' => 'Tu rol ha sido desactivado por el administrador.'], 403);
        }

        // Admin always has access
        if ($user->role === 'admin') {
            return $next($request);
        }

        if (!in_array($user->role, $roles, true)) {
            return response()->json(['message' => 'No tienes permiso para realizar esta acción.'], 403);
        }

        return $next($request);
    }
}
