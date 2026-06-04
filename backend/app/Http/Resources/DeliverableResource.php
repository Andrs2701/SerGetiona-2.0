<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DeliverableResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'subject_id' => $this->subject_id,
            'subject' => $this->whenLoaded('subject'),
            'name' => $this->name,
            'type' => $this->type,
            'global_status' => $this->global_status,
            'start_date' => $this->start_date,
            'notes' => $this->notes,
            'created_by' => $this->created_by,
            'creator' => $this->whenLoaded('creator', fn() => new UserResource($this->creator)),
            'role_activities' => $this->whenLoaded('roleActivities', function () {
                return $this->roleActivities->map(function ($activity) {
                    return [
                        'id' => $activity->id,
                        'role' => $activity->role,
                        'status' => $activity->status,
                        'commitment_date' => $activity->commitment_date,
                        'actual_start_date' => $activity->actual_start_date,
                        'actual_delivery_date' => $activity->actual_delivery_date,
                        'assigned_at' => $activity->assigned_at,
                        'notes' => $activity->notes,
                        'responsible' => $activity->relationLoaded('responsible') && $activity->responsible
                            ? new UserResource($activity->responsible)
                            : null,
                        'assigned_by' => $activity->relationLoaded('assignedBy') && $activity->assignedBy
                            ? new UserResource($activity->assignedBy)
                            : null,
                    ];
                });
            }),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
