<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use App\Models\RoleActivity;
use App\Http\Controllers\Api\RoleActivityController;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

class NotificationService
{
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

        Log::info("EMAIL: {$title} -> {$user->email} | {$message}");
    }

    public static function notifyMany(Collection $users, string $type, string $title, string $message, array $data = []): void
    {
        foreach ($users as $user) {
            static::notify($user, $type, $title, $message, $data);
        }
    }
}
