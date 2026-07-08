<?php
/**
 * Script de diagnóstico: compara el conteo de la tarjeta del dashboard
 * vs. la lista que el frontend construiría.
 *
 * Ejecutar: php check_overdue.php
 */
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\RoleActivity;
use App\Services\WorkingDayService;
use Carbon\Carbon;

$today = now()->toDateString();
echo "=== DIAGNÓSTICO DE ACTIVIDADES VENCIDAS ===\n";
echo "Fecha de hoy (servidor): $today\n\n";

// 1. Conteo del scope overdue (lo que usa la tarjeta)
$overdueScope = RoleActivity::overdue()->get();
echo "1. SCOPE overdue() => " . $overdueScope->count() . " actividades\n";
echo str_repeat('-', 60) . "\n";
foreach ($overdueScope as $a) {
    echo "  ID:{$a->id} | role:{$a->role} | status:{$a->status} | commit:{$a->commitment_date} | actual_delivery:{$a->actual_delivery_date}\n";
}

// 2. Todas las actividades con fecha de compromiso pasada (sin filtros de estado)
echo "\n2. TODAS con commitment_date < hoy (sin filtros):\n";
$allPastDue = RoleActivity::whereNotNull('commitment_date')
    ->where('commitment_date', '<', $today)
    ->get();
echo "   Total: " . $allPastDue->count() . "\n";

// 3. Las que están en estado 'delivered' con fecha pasada
$deliveredPastDue = RoleActivity::whereNotNull('commitment_date')
    ->where('commitment_date', '<', $today)
    ->where('status', 'delivered')
    ->get();
echo "\n3. DELIVERED con commitment_date pasada (EXCLUIDAS del scope):\n";
echo "   Total: " . $deliveredPastDue->count() . "\n";
foreach ($deliveredPastDue as $a) {
    echo "  ID:{$a->id} | role:{$a->role} | commit:{$a->commitment_date} | actual_delivery:{$a->actual_delivery_date}\n";
}

// 4. Approaching
echo "\n4. APPROACHING (tarjeta 'Por Vencer'):\n";
$approachingCandidates = RoleActivity::whereNotNull('commitment_date')
    ->whereNull('actual_delivery_date')
    ->whereNotIn('status', ['approved', 'delivered', 'not_applicable'])
    ->get();
$approachingCount = 0;
foreach ($approachingCandidates as $a) {
    $status = WorkingDayService::getStatus(Carbon::parse($a->commitment_date));
    if ($status === 'approaching') {
        $approachingCount++;
        echo "  ID:{$a->id} | role:{$a->role} | status:{$a->status} | commit:{$a->commitment_date}\n";
    }
}
echo "   Total approaching: $approachingCount\n";

echo "\n=== FIN DEL DIAGNÓSTICO ===\n";
