<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class TestMailCommand extends Command
{
    protected $signature = 'mail:test {email : La dirección de correo de destino}';
    protected $description = 'Envía un correo de prueba SMTP depurando la comunicación cruda con Office 365';

    public function handle()
    {
        $email = $this->argument('email');
        $host = config('mail.mailers.smtp.host') ?? env('MAIL_HOST', 'smtp.office365.com');
        $port = config('mail.mailers.smtp.port') ?? env('MAIL_PORT', 587);
        $username = config('mail.mailers.smtp.username') ?? env('MAIL_USERNAME');
        $password = config('mail.mailers.smtp.password') ?? env('MAIL_PASSWORD');
        $from = config('mail.from.address') ?? env('MAIL_FROM_ADDRESS', $username);

        $this->info("=== Iniciando depuración SMTP cruda ===");
        $this->line("Host: {$host}");
        $this->line("Puerto: {$port}");
        $this->line("Usuario: {$username}");
        $this->line("Remitente: {$from}");
        $this->line("Destinatario: {$email}");
        $this->line("Conectando TCP...");

        $socket = @fsockopen($host, $port, $errno, $errstr, 10);
        if (!$socket) {
            $this->error("Error de conexión TCP: {$errstr} ({$errno})");
            return 1;
        }

        $this->readResponse($socket);

        // 1. EHLO
        $this->sendCmd($socket, "EHLO " . request()->ip());
        $this->readResponse($socket);

        // 2. STARTTLS
        $this->sendCmd($socket, "STARTTLS");
        $res = $this->readResponse($socket);
        if (strpos($res, '220') === false) {
            $this->error("El servidor no aceptó STARTTLS.");
            fclose($socket);
            return 1;
        }

        // Activar TLS
        $this->line("Iniciando negociación TLS...");
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
            $this->error("Fallo al habilitar la encriptación TLS.");
            fclose($socket);
            return 1;
        }
        $this->info("Conexión encriptada exitosamente con TLS.");

        // 3. EHLO de nuevo sobre TLS
        $this->sendCmd($socket, "EHLO " . request()->ip());
        $this->readResponse($socket);

        // 4. AUTH LOGIN
        $this->sendCmd($socket, "AUTH LOGIN");
        $this->readResponse($socket);

        $this->sendCmd($socket, base64_encode($username));
        $this->readResponse($socket);

        $this->sendCmd($socket, base64_encode($password));
        $res = $this->readResponse($socket);
        if (strpos($res, '235') === false) {
            $this->error("Autenticación SMTP fallida. Verifica las credenciales.");
            fclose($socket);
            return 1;
        }

        // 5. MAIL FROM
        $this->sendCmd($socket, "MAIL FROM:<{$from}>");
        $this->readResponse($socket);

        // 6. RCPT TO
        $this->sendCmd($socket, "RCPT TO:<{$email}>");
        $this->readResponse($socket);

        // 7. DATA
        $this->sendCmd($socket, "DATA");
        $this->readResponse($socket);

        // Enviar contenido
        $boundary = md5(uniqid(time()));
        $subject = "Prueba de Depuración SMTP - Sergestiona 2.0";
        $headers = [
            "From: \"Sergestiona 2.0\" <{$from}>",
            "To: <{$email}>",
            "Subject: {$subject}",
            "MIME-Version: 1.0",
            "Content-Type: text/plain; charset=UTF-8",
            "Content-Transfer-Encoding: 8bit",
        ];

        $body = "¡Éxito! Este es un mensaje de prueba de depuración SMTP crudo desde Sergestiona 2.0.\r\n"
              . "Si recibes este correo, el servidor de correo entregó y procesó el mensaje sin problemas.";

        $message = implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n";
        fwrite($socket, $message);
        $this->line("> [Cuerpo del mensaje enviado]");
        $res = $this->readResponse($socket);

        // 8. QUIT
        $this->sendCmd($socket, "QUIT");
        $this->readResponse($socket);

        fclose($socket);
        $this->info("=== Fin de la depuración SMTP ===");
        return 0;
    }

    private function sendCmd($socket, $cmd)
    {
        $this->line("< " . $cmd);
        fwrite($socket, $cmd . "\r\n");
    }

    private function readResponse($socket)
    {
        $response = "";
        while ($line = fgets($socket, 515)) {
            $response .= $line;
            $this->line("> " . trim($line));
            if (substr($line, 3, 1) == " ") {
                break;
            }
        }
        return $response;
    }
}
