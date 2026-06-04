<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProjectResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status,
            'responsible' => $this->whenLoaded('responsible', fn() => new UserResource($this->responsible)),
            'responsible_id' => $this->responsible_id,
            'start_date' => $this->start_date,
            'end_date' => $this->end_date,
            'creator' => $this->whenLoaded('creator', fn() => new UserResource($this->creator)),
            'created_by' => $this->created_by,
            'programs_count' => $this->programs_count ?? null,
            'deliverables_count' => $this->deliverables_count ?? null,
            'compliance_percentage' => $this->compliance_percentage ?? null,
            'academic_programs' => $this->whenLoaded('academicPrograms'),
            'created_at' => $this->created_at,
            'updated_at' => $this->updated_at,
        ];
    }
}
