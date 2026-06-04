<?php

namespace App\Observers;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditObserver
{
    public function updated(Model $model): void
    {
        $dirty = $model->getDirty();
        $original = $model->getOriginal();
        $userId = Auth::id();
        $ip = Request::ip();
        $entityType = class_basename($model);

        foreach ($dirty as $field => $newValue) {
            AuditLog::create([
                'user_id' => $userId,
                'action' => 'updated',
                'entity_type' => $entityType,
                'entity_id' => $model->getKey(),
                'field_changed' => $field,
                'old_value' => $original[$field] ?? null,
                'new_value' => $newValue,
                'ip_address' => $ip,
                'created_at' => now(),
            ]);
        }
    }
}
