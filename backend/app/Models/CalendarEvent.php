<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class CalendarEvent extends Model
{
    protected $fillable = [
        'name',
        'date',
        'type',
        'description',
        'is_recurring',
        'created_by',
    ];

    protected $casts = [
        'date' => 'date',
        'is_recurring' => 'boolean',
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeForYear($query, int $year)
    {
        return $query->whereYear('date', $year)
            ->orWhere('is_recurring', true);
    }

    public static function isWorkingDay(Carbon $date): bool
    {
        if ($date->isWeekend()) {
            return false;
        }

        $month = $date->month;
        $day = $date->day;
        $year = $date->year;

        // Check non-recurring events for specific year
        $exact = self::where('date', $date->toDateString())->exists();
        if ($exact) {
            return false;
        }

        // Check recurring events (same month/day any year)
        $recurring = self::where('is_recurring', true)
            ->get()
            ->first(function ($event) use ($month, $day) {
                return $event->date->month === $month && $event->date->day === $day;
            });

        return $recurring === null;
    }
}
