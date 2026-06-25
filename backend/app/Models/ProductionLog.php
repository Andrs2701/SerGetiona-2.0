<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class ProductionLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'role_activity_id',
        'resource_type_id',
        'quantity',
        'description',
        'produced_by',
        'logged_by',
        'produced_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'produced_at' => 'date',
    ];

    public function roleActivity()
    {
        return $this->belongsTo(RoleActivity::class);
    }

    public function resourceType()
    {
        return $this->belongsTo(ResourceType::class);
    }

    public function producer()
    {
        return $this->belongsTo(User::class, 'produced_by');
    }

    public function logger()
    {
        return $this->belongsTo(User::class, 'logged_by');
    }
}
