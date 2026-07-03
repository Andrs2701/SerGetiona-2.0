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

    private static ?array $holidaysCache = null;

    public static function isWorkingDay(Carbon $date): bool
    {
        if ($date->isWeekend()) {
            return false;
        }

        if (self::$holidaysCache === null) {
            $events = self::all();
            self::$holidaysCache = [
                'exact' => $events->where('is_recurring', false)->pluck('date')->map(fn($d) => $d->toDateString())->flip()->all(),
                'recurring' => $events->where('is_recurring', true)->map(fn($e) => sprintf('%02d-%02d', $e->date->month, $e->date->day))->flip()->all(),
            ];
        }

        $dateString = $date->toDateString();
        if (isset(self::$holidaysCache['exact'][$dateString])) {
            return false;
        }

        $recurringKey = sprintf('%02d-%02d', $date->month, $date->day);
        if (isset(self::$holidaysCache['recurring'][$recurringKey])) {
            return false;
        }

        return true;
    }
}
