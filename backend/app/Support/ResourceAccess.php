<?php

namespace App\Support;

use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\User;

class ResourceAccess
{
    public static function isManager(User $user): bool
    {
        $rule = \App\Models\VisibilityRule::where('role_slug', $user->role)->first();
        if ($rule) {
            return $rule->scope === 'all';
        }
        return in_array($user->role, ['admin', 'coordinator'], true);
    }

    public static function canAccessProject(User $user, Project $project): bool
    {
        if (self::isManager($user)) {
            return true;
        }

        return RoleActivity::where('responsible_id', $user->id)
            ->whereHas(
                'deliverable.subject.academicProgram',
                fn ($query) => $query->where('project_id', $project->id)
            )
            ->exists();
    }

    public static function canAccessDeliverable(User $user, Deliverable $deliverable): bool
    {
        $project = $deliverable->subject?->academicProgram?->project;

        return $project !== null && self::canAccessProject($user, $project);
    }

    public static function canAccessActivity(User $user, RoleActivity $activity): bool
    {
        $activity->loadMissing('deliverable.subject.academicProgram.project');

        return $activity->deliverable !== null
            && self::canAccessDeliverable($user, $activity->deliverable);
    }
}
