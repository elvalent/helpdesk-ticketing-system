<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TicketCreatedNotification extends Notification
{
    use Queueable;

    public $ticket;

    public function __construct($ticket)
    {
        $this->ticket = $ticket;
    }

    public function via($notifiable)
    {
        return ['mail', 'database'];
    }

    public function toMail($notifiable)
    {
        return (new MailMessage)
            ->subject('Tiket Baru: ' . $this->ticket->title)
            ->greeting('Halo Tim IT!')
            ->line('Ada tiket baru dari user: ' . $this->ticket->user->name)
            ->line('Judul: ' . $this->ticket->title)
            ->line('Deskripsi: ' . $this->ticket->description)
            ->line('Prioritas: ' . $this->ticket->priority)
            ->action('Lihat Dashboard IT', 'http://localhost:5173')
            ->line('Mohon segera ditindaklanjuti.');
    }

    public function toArray($notifiable)
    {
        return [
            'ticket_id' => $this->ticket->id,
            'title' => $this->ticket->title,
            'message' => 'Tiket baru dari ' . $this->ticket->user->name,
        ];
    }
}