<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BackfillAssignedAtTest extends TestCase
{
    use RefreshDatabase;

    private function makeActivityWithoutAssignedAt(int $responsibleId): RoleActivity
    {
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $activity = RoleActivity::create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'pedagogy',
            'responsible_id' => $responsibleId,
            'checklist'      => RoleActivity::defaultChecklist('pedagogy'),
        ]);

        // Simula el estado pre-fix: assigned_at siempre quedaba en null.
        RoleActivity::where('id', $activity->id)->update(['assigned_at' => null]);

        return $activity->fresh();
    }

    public function test_dry_run_does_not_write_anything(): void
    {
        $user = User::factory()->create(['role' => 'pedagogy']);
        $activity = $this->makeActivityWithoutAssignedAt($user->id);

        $this->artisan('role-activities:backfill-assigned-at', ['--dry-run' => true])
            ->assertExitCode(0);

        $this->assertNull($activity->fresh()->assigned_at);
    }

    public function test_uses_the_most_recent_matching_audit_log_entry_when_available(): void
    {
        $user = User::factory()->create(['role' => 'pedagogy']);
        $activity = $this->makeActivityWithoutAssignedAt($user->id);

        $olderLog = AuditLog::create([
            'user_id' => $user->id, 'action' => 'updated', 'entity_type' => 'RoleActivity',
            'entity_id' => $activity->id, 'field_changed' => 'responsible_id',
            'old_value' => null, 'new_value' => (string) $user->id,
            'created_at' => now()->subDays(3),
        ]);
        $newerLog = AuditLog::create([
            'user_id' => $user->id, 'action' => 'updated', 'entity_type' => 'RoleActivity',
            'entity_id' => $activity->id, 'field_changed' => 'responsible_id',
            'old_value' => null, 'new_value' => (string) $user->id,
            'created_at' => now()->subDay(),
        ]);

        $this->artisan('role-activities:backfill-assigned-at')->assertExitCode(0);

        $assignedAt = $activity->fresh()->assigned_at;
        $this->assertNotNull($assignedAt);
        $this->assertTrue($assignedAt->equalTo($newerLog->created_at));
        $this->assertFalse($assignedAt->equalTo($olderLog->created_at));
    }

    public function test_falls_back_to_created_at_when_no_audit_log_exists(): void
    {
        $user = User::factory()->create(['role' => 'pedagogy']);
        $activity = $this->makeActivityWithoutAssignedAt($user->id);

        $this->artisan('role-activities:backfill-assigned-at')->assertExitCode(0);

        $fresh = $activity->fresh();
        $this->assertNotNull($fresh->assigned_at);
        $this->assertTrue($fresh->assigned_at->equalTo($fresh->created_at));
    }

    public function test_does_not_touch_activities_that_already_have_assigned_at(): void
    {
        $user = User::factory()->create(['role' => 'pedagogy']);
        $subject     = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $activity = RoleActivity::create([
            'deliverable_id' => $deliverable->id,
            'role'           => 'pedagogy',
            'responsible_id' => $user->id,
            'checklist'      => RoleActivity::defaultChecklist('pedagogy'),
        ]);
        $originalAssignedAt = $activity->fresh()->assigned_at;
        $this->assertNotNull($originalAssignedAt);

        $this->artisan('role-activities:backfill-assigned-at')->assertExitCode(0);

        $this->assertTrue($activity->fresh()->assigned_at->equalTo($originalAssignedAt));
    }
}
