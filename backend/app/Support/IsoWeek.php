<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Utilidades ISO-8601 para semanas (lunes a domingo; la semana 1 es la que
 * contiene el primer jueves del año / el 4 de enero). Punto único de esta
 * lógica, reutilizado por DeliverableController y ReportController en vez
 * de repetir el cálculo de rango en cada uno.
 *
 * El "año" aquí es el año-semana ISO (PHP date('o')), que solo difiere del
 * año calendario unos pocos días alrededor del 31-dic/1-ene.
 * frontend/lib/isoWeek.ts replica exactamente estas mismas reglas para que
 * el selector de semanas y el filtro del backend siempre coincidan.
 */
class IsoWeek
{
    /** [Carbon $start, Carbon $end] = lunes 00:00:00 – domingo 23:59:59 de esa semana ISO. */
    public static function range(int $isoYear, int $week): array
    {
        $start = Carbon::now()->setISODate($isoYear, $week, 1)->startOfDay();
        $end   = Carbon::now()->setISODate($isoYear, $week, 7)->endOfDay();

        return [$start, $end];
    }

    /** 52 o 53 — el 28 de diciembre siempre cae en la última semana ISO de su año. */
    public static function weeksInYear(int $isoYear): int
    {
        return (int) Carbon::create($isoYear, 12, 28)->format('W');
    }

    /** Año-semana ISO y número de semana de una fecha (por defecto, hoy). */
    public static function currentWeek(?Carbon $date = null): array
    {
        $d = $date ?? Carbon::today();

        return ['year' => (int) $d->format('o'), 'week' => (int) $d->format('W')];
    }
}
