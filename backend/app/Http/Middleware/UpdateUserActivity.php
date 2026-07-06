<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class UpdateUserActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $user = $request->user();
        if ($user) {
            // Actualizar la última actividad del usuario si ha pasado más de 1 minuto desde la última actualización
            if (!$user->last_active_at || now()->diffInMinutes($user->last_active_at) >= 1) {
                $user->timestamps = false;
                $user->update(['last_active_at' => now()]);
            }
        }

        return $response;
    }
}
