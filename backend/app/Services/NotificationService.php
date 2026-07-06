<?php

namespace App\Services;

use App\Mail\NotificationMail;
use App\Models\DecisionRecord;
use App\Models\Notification;
use App\Models\User;
use App\Models\UserPreference;
use App\Models\RoleActivity;
use App\Http\Controllers\Api\RoleActivityController;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;

class NotificationService
{
    /**
     * Agrupa los ~13 tipos de notificación en 3 categorías, misma
     * clasificación que ya usan las pestañas de filtro en
     * frontend/app/(dashboard)/notificaciones/page.tsx. Un tipo no
     * listado aquí (ej. executive_summary) no dispara correo.
     */
    private const TYPE_CATEGORY = [
        'task_assigned'         => 'email_tasks',
        'status_changed'        => 'email_tasks',
        'date_changed'          => 'email_tasks',
        'adjustments_requested' => 'email_tasks',
        'activity_modified'     => 'email_tasks',
        'next_in_chain'         => 'email_tasks',
        'mention'               => 'email_chat',
        'channel_added'         => 'email_chat',
        'comment_added'         => 'email_chat',
        'deadline_approaching'  => 'email_deadlines',
        'overdue'               => 'email_deadlines',
        'overdue_reminder'      => 'email_deadlines',
        'decision_assigned'     => 'email_tasks',
    ];

    public static function translateRole(string $role): string
    {
        return match($role) {
            'expert'      => 'Experto Temático',
            'pedagogy'    => 'Pedagogía',
            'design'      => 'Diseño',
            'audiovisual' => 'Audiovisual',
            'engineering' => 'Ingeniería',
            'qa'          => 'Calidad',
            default       => $role,
        };
    }

    public static function notifyTaskAssigned(RoleActivity $activity, User $user): void
    {
        $activity->loadMissing('deliverable.subject.academicProgram.project');
        
        $deliverable = $activity->deliverable;
        $subject = $deliverable?->subject;
        $program = $subject?->academicProgram;
        $project = $program?->project;

        $projectName = $project?->name ?? 'N/A';
        $programName = $program?->name ?? 'N/A';
        $subjectName = $subject?->name ?? 'N/A';
        $deliverableName = $deliverable?->name ?? 'N/A';

        $roleLabel = self::translateRole($activity->role);
        $statusLabel = RoleActivityController::translateStatus($activity->status);
        $commitmentDate = $activity->commitment_date 
            ? (\Carbon\Carbon::parse($activity->commitment_date)->toDateString()) 
            : 'N/A';

        $message = "Se te ha asignado la actividad de rol '{$roleLabel}' en la asignatura '{$subjectName}' para el programa '{$programName}' (Proyecto: '{$projectName}'). Estado actual: '{$statusLabel}', Fecha límite: {$commitmentDate}.";

        self::notify(
            $user,
            'task_assigned',
            'Nueva actividad asignada',
            $message,
            ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id]
        );
    }

    public static function notifyDecisionAssigned(DecisionRecord $decision, User $user): void
    {
        $decision->loadMissing('project', 'program');

        $projectName = $decision->project?->name ?? 'N/A';
        $programName = $decision->program?->name ?? 'N/A';
        $dueDate = $decision->due_date
            ? (\Carbon\Carbon::parse($decision->due_date)->toDateString())
            : 'N/A';
        $description = mb_substr($decision->description, 0, 150);

        $message = "Se te ha asignado la decisión '{$description}' del programa '{$programName}' (Proyecto: '{$projectName}'). Fecha límite: {$dueDate}.";

        self::notify(
            $user,
            'decision_assigned',
            'Nueva decisión asignada',
            $message,
            ['entity_type' => 'DecisionRecord', 'entity_id' => $decision->id]
        );
    }

    public static function notify(User|int $user, string $type, string $title, string $message, array $data = []): void
    {
        if (is_int($user)) {
            $user = User::find($user);
        }

        if (!$user) {
            return;
        }

        Notification::create([
            'user_id'    => $user->id,
            'type'       => $type,
            'title'      => $title,
            'message'    => $message,
            'data'       => $data,
            'created_at' => now(),
        ]);

        self::maybeSendEmail($user, $type, $title, $message);
    }

    private static function maybeSendEmail(User $user, string $type, string $title, string $message): void
    {
        $category = self::TYPE_CATEGORY[$type] ?? null;
        if (!$category || !$user->email) {
            return;
        }

        $pref = UserPreference::firstOrCreate(
            ['user_id' => $user->id],
            [
                'portfolio_view' => 'table',
                'right_sidebar_open' => true,
                'email_notifications_enabled' => true,
                'email_tasks' => true,
                'email_chat' => true,
                'email_deadlines' => true,
            ]
        );

        if (!$pref->email_notifications_enabled || !$pref->{$category}) {
            return;
        }

        Mail::to($user->email)->queue(new NotificationMail($title, $message));
    }

    public static function notifyMany(Collection $users, string $type, string $title, string $message, array $data = []): void
    {
        foreach ($users as $user) {
            static::notify($user, $type, $title, $message, $data);
        }
    }
}
