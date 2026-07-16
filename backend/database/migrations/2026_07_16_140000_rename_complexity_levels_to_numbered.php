<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Renombra el catálogo de complejidad a 3 niveles numerados, según lo pedido
 * en el feedback del piloto ("que sean 3 niveles: nivel 1, nivel 2 y nivel 3").
 *
 * Se renombra en vez de recrear porque los `id` se conservan: verificado contra
 * datos reales, 1.500 de 1.545 entregables apuntan al id=1, y ese id alimenta
 * el cálculo de capacidad vía CapacityService::pointsFor(). Renombrar no mueve
 * ni un punto de utilización; recrear las filas habría dejado 1.500 entregables
 * huérfanos.
 *
 * Los puntos se conservan (1/3/5), así "Nivel 3" queda como el más alto.
 * "Crítica" se desactiva en vez de borrarse: tiene 0 entregables, pero
 * desactivar es reversible y no arriesga la FK.
 */
return new class extends Migration
{
    private const RENAMES = [
        'Baja'  => 'Nivel 1',
        'Media' => 'Nivel 2',
        'Alta'  => 'Nivel 3',
    ];

    public function up(): void
    {
        foreach (self::RENAMES as $from => $to) {
            DB::table('complexity_levels')->where('name', $from)->update(['name' => $to]);
        }

        DB::table('complexity_levels')->where('name', 'Crítica')->update(['is_active' => false]);
    }

    public function down(): void
    {
        foreach (self::RENAMES as $from => $to) {
            DB::table('complexity_levels')->where('name', $to)->update(['name' => $from]);
        }

        DB::table('complexity_levels')->where('name', 'Crítica')->update(['is_active' => true]);
    }
};
