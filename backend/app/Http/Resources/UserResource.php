<?php

namespace App\Http\Resources;

use App\Models\SystemSetting;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class UserResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'role' => $this->role,
            'is_active' => $this->is_active,
            'phone' => $this->phone,
            'position' => $this->position,
            'department' => $this->department,
            'photo_url' => $this->photo_url,
            'weekly_capacity_points' => $this->weekly_capacity_points,
            'created_at' => $this->created_at,
            'last_active_at' => $this->last_active_at ? \Carbon\Carbon::parse($this->last_active_at)->toIso8601String() : null,
            'active_diff_seconds' => $this->last_active_at ? \Carbon\Carbon::parse($this->last_active_at)->diffInSeconds(now()) : null,
            'online_threshold_seconds' => (int) (SystemSetting::num('presence.online_threshold_minutes', 5) * 60),
            'is_online' => $this->last_active_at !== null
                && \Carbon\Carbon::parse($this->last_active_at)->diffInMinutes(now()) <= SystemSetting::num('presence.online_threshold_minutes', 5),
        ];
    }
}
