<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChannelMessage extends Model
{
    protected $fillable = ['channel_id', 'user_id', 'parent_id', 'content'];

    public function channel()
    {
        return $this->belongsTo(Channel::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function parent()
    {
        return $this->belongsTo(ChannelMessage::class, 'parent_id');
    }

    public function replies()
    {
        return $this->hasMany(ChannelMessage::class, 'parent_id');
    }

    public function mentions()
    {
        return $this->hasMany(Mention::class, 'message_id');
    }
}
