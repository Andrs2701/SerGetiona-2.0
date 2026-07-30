<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\ProductionEvent;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProductionEventTest extends TestCase
{
    use RefreshDatabase;

    public function test_activity_status_change_records_production_event(): void
    {
        $subject = Subject::factory()->create();
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);
        $user = User::factory()->create(['role' => 'expert']);

        $activity = RoleActivity::create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'expert',
            'status'          => 'not_started',
            'responsible_id'  => $user->id,
            'commitment_date' => now()->addDays(5)->toDateString(),
        ]);

        $this->assertDatabaseHas('production_events', [
            'role_activity_id' => $activity->id,
            'event_type'       => 'asignada',
            'user_id'          => $user->id,
        ]);

        $activity->update(['status' => 'in_progress']);

        $this->assertDatabaseHas('production_events', [
            'role_activity_id' => $activity->id,
            'event_type'       => 'iniciada',
            'from_state'       => 'not_started',
            'to_state'         => 'in_progress',
        ]);
    }
}
