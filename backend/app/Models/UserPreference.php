<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserPreference extends Model
{
    protected $fillable = ['user_id', 'portfolio_view', 'right_sidebar_open'];

    protected $casts = [
        'right_sidebar_open' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
