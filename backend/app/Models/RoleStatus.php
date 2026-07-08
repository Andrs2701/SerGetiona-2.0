<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoleStatus extends Model
{
    use HasFactory;

    protected $table = 'role_statuses';

    protected $fillable = [
        'role',
        'status_slug',
        'sort_order',
    ];
}
