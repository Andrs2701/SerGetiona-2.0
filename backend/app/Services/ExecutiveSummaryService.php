<?php

namespace App\Services;

use App\Models\DecisionRecord;
use App\Models\RoleActivity;
use App\Models\User;
use App\Services\Channels\InternalChannel;
use App\Services\Channels\NotificationChannelInterface;
use Carbon\Carbon;

/**
 * Resumen ejecutivo automático. build() arma la estructura única que
 * consumen la API y los canales de envío; send() la distribuye.
 */
final class ExecutiveSummaryService
{
    /** @var array<class-string<NotificationChannelInterface>> */
    private static array $channels = [
        InternalChannel::class,
        // Futuro: EmailChannel::class, TeamsChannel::class, SlackChannel::class, WhatsAppChannel::class
    ];

    public static function build(): array
    {
        $today  = Carbon::today();
        $health = HealthService::portfolio();
        $capacity = CapacityService::global();

        $activities = RoleActivity::whereNotNull('responsible_id')->whereHas('deliverable')->get();

        $isOverdue = fn ($a) => $a->commitment_date
            && $a->commitment_date->lt($today)
            && is_null($a->actual_delivery_date)
            && !in_array($a->status, ['approved', 'delivered', 'not_applicable']);

        $overdue = $activities->filter($isOverdue)->count();

        $approaching = $activities->filter(
            fn ($a) => $a->commitment_date
                && !$isOverdue($a)
                && !in_array($a->status, ['approved', 'delivered', 'not_applicable'])
                && $a->commitment_date->toDateString() === $today->toDateString()
        )->count();

        $total    = $activities->count();
        $approved = $activities->where('status', 'approved')->count();

        $alerts = [];

        foreach ($health['projects'] as $project) {
            if ($project['level'] === 'red') {
                $alerts[] = [
                    'type'    => 'project_red',
                    'message' => "Proyecto crítico: {$project['project_name']} (salud {$project['score']}/100)",
                    'link'    => '/proyectos/' . $project['project_id'],
                ];
            }
        }

        if ($capacity['overloaded_users'] > 0) {
            $alerts[] = [
                'type'    => 'overload',
                'message' => "{$capacity['overloaded_users']} usuario(s) sobrecargado(s) — utilización global {$capacity['utilization_pct']}%",
                'link'    => '/capacidad',
            ];
        }

        if ($overdue > 0) {
            $alerts[] = [
                'type'    => 'overdue',
                'message' => "{$overdue} actividad(es) vencida(s) sin entrega",
                'link'    => '/entregables',
            ];
        }

        return [
            'generated_at' => now()->toIso8601String(),
            'portfolio'    => [
                'health_score'      => $health['portfolio_score'],
                'health_level'      => $health['portfolio_level'],
                'capacity'          => $capacity,
                'compliance_pct'    => $total > 0 ? (int) round($approved / $total * 100) : 0,
                'overdue_activities'    => $overdue,
                'approaching_activities'=> $approaching,
            ],
            'projects'     => array_map(fn ($p) => [
                'project_id'   => $p['project_id'],
                'project_name' => $p['project_name'],
                'health_score' => $p['score'],
                'health_level' => $p['level'],
            ], $health['projects']),
            'alerts'       => $alerts,
            'pending_decisions' => class_exists(DecisionRecord::class)
                ? DecisionRecord::where('status', 'pending')->count()
                : 0,
        ];
    }

    /** Envía el resumen a admin + coordinadores por los canales indicados. */
    public static function send(array $channelKeys = ['internal']): void
    {
        $summary = self::build();

        $title = 'Resumen ejecutivo — ' . now()->format('d/m/Y');
        $body  = sprintf(
            'Salud de portafolio: %d/100. Cumplimiento: %d%%. Vencidas: %d. Alertas: %d.',
            $summary['portfolio']['health_score'],
            $summary['portfolio']['compliance_pct'],
            $summary['portfolio']['overdue_activities'],
            count($summary['alerts'])
        );

        $recipients = User::whereIn('role', ['admin', 'coordinator'])
            ->where('is_active', true)
            ->get();

        foreach (self::$channels as $channelClass) {
            $channel = new $channelClass();

            if (!in_array($channel->key(), $channelKeys)) {
                continue;
            }

            foreach ($recipients as $user) {
                $channel->send($user, $title, $body, ['summary' => $summary['portfolio']]);
            }
        }
    }
}
