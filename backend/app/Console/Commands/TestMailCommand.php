<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;
use App\Mail\NotificationMail;

class TestMailCommand extends Command
{
    protected $signature = 'mail:test {email : La dirección de correo de destino}';
    protected $description = 'Envía un correo de prueba SMTP para validar el puerto 587 y credenciales de Office 365';

    public function handle()
    {
        $email = $this->argument('email');
        $this->info("Iniciando prueba de envío de correo a: {$email}...");

        try {
            // Enviamos de forma síncrona (sin cola) para ver el error de red inmediatamente
            Mail::to($email)->send(new NotificationMail(
                "Prueba de Conexión SMTP - Sergestiona 2.0",
                "¡Éxito! El puerto 587 y las credenciales de Office 365 están funcionando correctamente desde el servidor."
            ));

            $this->info("¡Correo enviado con éxito! Revisa tu bandeja de entrada o spam.");
        } catch (\Exception $e) {
            $this->error("Error al enviar el correo:");
            $this->line($e->getMessage());
        }
    }
}
