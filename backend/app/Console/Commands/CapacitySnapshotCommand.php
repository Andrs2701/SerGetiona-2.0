<?php

namespace App\Console\Commands;

use App\Services\CapacityService;
use Illuminate\Console\Command;

class CapacitySnapshotCommand extends Command
{
    protected $signature = 'capacity:snapshot';

    protected $description = 'Genera el snapshot semanal de capacidad operativa (idempotente)';

    public function handle(): int
    {
        CapacityService::ensureWeeklySnapshot();

        $this->info('Snapshot semanal de capacidad verificado/generado.');

        return self::SUCCESS;
    }
}
