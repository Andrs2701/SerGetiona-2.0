<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\RoleActivityController;
use App\Models\Deliverable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RecalculateDeliverableStatuses extends Command
{
    protected $signature = 'deliverables:recalculate-status {--dry-run : Muestra los cambios sin escribirlos}';

    protected $description = 'Recalcula global_status de los entregables a partir del estado real de sus actividades, sin tocar estados editoriales manuales (pending_start, with_observations, cancelled, not_applicable)';

    private const PROTECTED_STATUSES = ['pending_start', 'with_observations', 'cancelled', 'not_applicable'];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $deliverables = Deliverable::whereNotIn('global_status', self::PROTECTED_STATUSES)->get();

        $transitions = [];
        $unchanged = 0;

        DB::beginTransaction();
        try {
            foreach ($deliverables as $deliverable) {
                $before = $deliverable->global_status;
                RoleActivityController::recalculateGlobalStatus($deliverable);
                $after = $deliverable->global_status;

                if ($after !== $before) {
                    $key = "{$before} -> {$after}";
                    $transitions[$key] = ($transitions[$key] ?? 0) + 1;
                } else {
                    $unchanged++;
                }
            }

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }
        } catch (\Throwable $e) {
            DB::rollBack();
            $this->error('Error al recalcular: ' . $e->getMessage());
            return self::FAILURE;
        }

        $this->info($dryRun ? '=== DRY RUN (sin escribir cambios) ===' : '=== Cambios aplicados ===');
        $this->line('Entregables evaluados: ' . $deliverables->count());
        $this->line("Sin cambios: {$unchanged}");
        foreach ($transitions as $key => $count) {
            $this->line("  {$key}: {$count}");
        }
        $this->line('Total con cambio: ' . array_sum($transitions));

        return self::SUCCESS;
    }
}
