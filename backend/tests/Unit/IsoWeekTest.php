<?php

namespace Tests\Unit;

use App\Support\IsoWeek;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

class IsoWeekTest extends TestCase
{
    public function test_range_always_starts_monday_and_ends_sunday_six_days_later(): void
    {
        foreach ([[2025, 1], [2025, 30], [2026, 1], [2026, 52], [2020, 53]] as [$year, $week]) {
            [$start, $end] = IsoWeek::range($year, $week);

            $this->assertSame(1, $start->dayOfWeekIso, "semana {$week}/{$year}: el inicio debe ser lunes");
            $this->assertSame(7, $end->dayOfWeekIso, "semana {$week}/{$year}: el fin debe ser domingo");
            $this->assertTrue($start->copy()->addDays(6)->isSameDay($end), "semana {$week}/{$year}: el rango debe cubrir 7 días");
        }
    }

    public function test_weeks_in_year_is_always_52_or_53(): void
    {
        foreach (range(2018, 2035) as $year) {
            $this->assertContains(IsoWeek::weeksInYear($year), [52, 53], "año {$year}");
        }
    }

    public function test_current_week_and_range_round_trip(): void
    {
        foreach ([
            Carbon::create(2026, 1, 1),   // año nuevo, jueves — caso límite: semana 1 de 2026 empieza en dic-2025
            Carbon::create(2026, 6, 15),
            Carbon::create(2025, 12, 31), // fin de año — caso límite del otro lado
        ] as $date) {
            $week = IsoWeek::currentWeek($date);
            [$start, $end] = IsoWeek::range($week['year'], $week['week']);

            $this->assertTrue(
                $date->betweenIncluded($start, $end),
                "la fecha {$date->toDateString()} debe caer dentro de su propio rango de semana calculado"
            );
        }
    }

    /** Caso conocido: 1-ene-2026 es jueves, así que su semana ISO 1 empieza el lunes anterior (29-dic-2025). */
    public function test_known_year_boundary_case(): void
    {
        [$start, $end] = IsoWeek::range(2026, 1);

        $this->assertSame('2025-12-29', $start->toDateString());
        $this->assertSame('2026-01-04', $end->toDateString());

        $week = IsoWeek::currentWeek(Carbon::create(2026, 1, 1));
        $this->assertSame(['year' => 2026, 'week' => 1], $week);
    }
}
