<?php

namespace App\Services;

use App\Models\CalendarEvent;
use Carbon\Carbon;

class WorkingDayService
{
    public static function addWorkingDays(Carbon $baseDate, int $days): Carbon
    {
        $date = $baseDate->copy();
        $added = 0;

        while ($added < $days) {
            $date->addDay();
            if (CalendarEvent::isWorkingDay($date)) {
                $added++;
            }
        }

        return $date;
    }

    public static function suggestDates(Carbon $expertDate, array $offsets): array
    {
        $result = [];
        foreach ($offsets as $role => $days) {
            $result[$role] = static::addWorkingDays($expertDate, (int) $days);
        }
        return $result;
    }

    public static function getStatus(Carbon $commitmentDate, ?Carbon $deliveryDate = null, ?string $status = null): string
    {
        if ($status && in_array($status, \App\Models\RoleActivity::NOT_OVERDUE_STATUSES, true)) {
            return 'on_time';
        }

        if ($deliveryDate) {
            return 'on_time';
        }

        $today = Carbon::today();

        if ($commitmentDate->lt($today)) {
            return 'overdue';
        }

        // Check if vence en los próximos 3 días hábiles
        $approachingLimit = static::addWorkingDays($today, 3);
        if ($commitmentDate->lte($approachingLimit)) {
            return 'approaching';
        }

        return 'on_time';
    }
}
