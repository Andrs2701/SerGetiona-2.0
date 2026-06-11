<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;

class SeedIfEmptyCommand extends Command
{
    protected $signature = 'app:seed-if-empty';

    protected $description = 'Load demo data only when the database has no users';

    public function handle(): int
    {
        if (User::query()->exists()) {
            $this->info('Database already contains data; seeding skipped.');

            return self::SUCCESS;
        }

        return Artisan::call('db:seed', ['--force' => true]);
    }
}
