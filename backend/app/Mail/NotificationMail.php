<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

class NotificationMail extends Mailable implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $notifTitle,
        public string $notifBody,
        public ?string $actionUrl = null,
    ) {
        $this->actionUrl ??= rtrim(config('app.frontend_url'), '/') . '/notificaciones';
    }

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->notifTitle);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.notification',
            with: [
                'notifTitle' => $this->notifTitle,
                'notifBody' => $this->notifBody,
                'actionUrl' => $this->actionUrl,
            ],
        );
    }
}
