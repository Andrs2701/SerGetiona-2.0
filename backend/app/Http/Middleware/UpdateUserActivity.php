<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UpdateUserActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && !$user->is_active) {
            abort(403, 'Tu cuenta de usuario ha sido desactivada.');
        }

        $response = $next($request);

        if ($user && $user->is_active) {
            // Actualizar la última actividad del usuario si ha pasado más de 1 minuto desde la última actualización
            if (!$user->last_active_at || $user->last_active_at->diffInMinutes(now()) >= 1) {
                $user->timestamps = false;
                $user->update(['last_active_at' => now()]);
            }
        }

        return $response;
    }
}
