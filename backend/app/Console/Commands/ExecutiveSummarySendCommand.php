<?php

namespace App\Console\Commands;

use App\Services\ExecutiveSummaryService;
use Illuminate\Console\Command;

class ExecutiveSummarySendCommand extends Command
{
    protected $signature = 'summary:send {--channels=internal : Canales separados por coma (internal,email,...)}';

    protected $description = 'Genera y envía el resumen ejecutivo a admin y coordinadores';

    public function handle(): int
    {
        $channels = array_filter(array_map('trim', explode(',', $this->option('channels'))));

        ExecutiveSummaryService::send($channels);

        $this->info('Resumen ejecutivo enviado por: ' . implode(', ', $channels));

        return self::SUCCESS;
    }
}
