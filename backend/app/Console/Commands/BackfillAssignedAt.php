<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\RoleActivity;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class BackfillAssignedAt extends Command
{
    protected $signature = 'role-activities:backfill-assigned-at {--dry-run : Muestra los cambios sin escribirlos}';

    protected $description = 'Rellena assigned_at en actividades con responsable ya asignado antes del fix del observer '
        . '(usa el audit_log de responsible_id más reciente si existe, o created_at como respaldo)';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $activities = RoleActivity::whereNotNull('responsible_id')
            ->whereNull('assigned_at')
            ->get(['id', 'responsible_id', 'created_at']);

        $fromAuditLog  = 0;
        $fromCreatedAt = 0;

        DB::beginTransaction();
        try {
            foreach ($activities as $activity) {
                // El log más reciente donde el responsable quedó en el valor
                // ACTUAL de la actividad — si hubo reasignaciones, nos interesa
                // cuándo llegó el responsable de hoy, no el primero que hubo.
                $auditEntry = AuditLog::where('entity_type', 'RoleActivity')
                    ->where('entity_id', $activity->id)
                    ->where('field_changed', 'responsible_id')
                    ->where('new_value', (string) $activity->responsible_id)
                    ->orderByDesc('created_at')
                    ->first();

                if ($auditEntry) {
                    $assignedAt = $auditEntry->created_at;
                    $fromAuditLog++;
                } else {
                    // Sin historial de cambio: el responsable se puso desde la
                    // creación de la actividad.
                    $assignedAt = $activity->created_at;
                    $fromCreatedAt++;
                }

                DB::table('role_activities')->where('id', $activity->id)->update(['assigned_at' => $assignedAt]);
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Error al aplicar el backfill: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info($dryRun ? '=== DRY RUN (sin escribir cambios) ===' : '=== Backfill aplicado ===');
        $this->line('Actividades procesadas: ' . $activities->count());
        $this->line("  Con fecha real desde audit_logs: {$fromAuditLog}");
        $this->line("  Con fecha aproximada (created_at de la actividad): {$fromCreatedAt}");

        return self::SUCCESS;
    }
}
