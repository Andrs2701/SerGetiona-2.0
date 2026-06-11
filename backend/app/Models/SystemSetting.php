<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;

class SystemSetting extends Model
{
    protected $fillable = [
        'key',
        'value',
        'label',
        'group',
    ];

    /**
     * Valor numérico de un setting, cacheado 60s. Devuelve el default si la
     * clave no existe (BD anterior a la migración o setting eliminado).
     */
    public static function num(string $key, float $default): float
    {
        $value = Cache::remember("system_setting.{$key}", 60, function () use ($key) {
            return static::where('key', $key)->value('value');
        });

        return is_numeric($value) ? (float) $value : $default;
    }

    public static function flushCache(string $key): void
    {
        Cache::forget("system_setting.{$key}");
    }
}
