<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoleCoverage extends Model
{
    protected $fillable = [
        'user_id',
        'covering_role',
        'starts_at',
        'ends_at',
        'reason',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'ends_at' => 'date',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Coberturas vigentes hoy: ya empezaron y (no tienen fin o el fin no ha pasado).
     * whereDate() (no where() a secas) porque la columna `date` en SQLite se
     * guarda como 'YYYY-MM-DD 00:00:00' — comparar ese string completo contra
     * 'YYYY-MM-DD' con <= falla siempre que la cobertura empieza justo hoy,
     * porque el string más largo nunca es <= a su propio prefijo.
     */
    public function scopeActive($query)
    {
        $today = now()->toDateString();

        return $query->whereDate('starts_at', '<=', $today)
            ->where(function ($q) use ($today) {
                $q->whereNull('ends_at')->orWhereDate('ends_at', '>=', $today);
            });
    }
}
