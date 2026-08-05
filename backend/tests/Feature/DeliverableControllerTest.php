<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliverableControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    public function test_index_filters_by_week_across_a_week_boundary(): void
    {
        $subject = Subject::factory()->create();

        $inWeek = Deliverable::factory()->create(['subject_id' => $subject->id, 'name' => 'Dentro de la semana']);
        RoleActivity::factory()->create(['deliverable_id' => $inWeek->id, 'commitment_date' => '2026-03-18']); // miércoles, semana 12 de 2026

        $outOfWeek = Deliverable::factory()->create(['subject_id' => $subject->id, 'name' => 'Fuera de la semana']);
        RoleActivity::factory()->create(['deliverable_id' => $outOfWeek->id, 'commitment_date' => '2026-03-23']); // lunes siguiente, semana 13

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/deliverables?year=2026&week=12')
            ->assertOk();

        $names = collect($res->json())->pluck('name');
        $this->assertTrue($names->contains('Dentro de la semana'));
        $this->assertFalse($names->contains('Fuera de la semana'));
    }

    public function test_index_rejects_week_and_month_combined(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/deliverables?year=2026&week=12&month=3')
            ->assertStatus(422);
    }

    public function test_index_rejects_week_without_year(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/deliverables?week=12')
            ->assertStatus(422);
    }

    /** Regresión: el comportamiento existente de year/month (sin week) no debe cambiar. */
    public function test_index_year_and_month_filter_unchanged_without_week(): void
    {
        $subject = Subject::factory()->create();

        $inMonth = Deliverable::factory()->create(['subject_id' => $subject->id, 'name' => 'De marzo']);
        RoleActivity::factory()->create(['deliverable_id' => $inMonth->id, 'commitment_date' => '2026-03-10']);

        $outOfMonth = Deliverable::factory()->create(['subject_id' => $subject->id, 'name' => 'De abril']);
        RoleActivity::factory()->create(['deliverable_id' => $outOfMonth->id, 'commitment_date' => '2026-04-10']);

        $res = $this->actingAs($this->admin, 'sanctum')
            ->getJson('/api/deliverables?year=2026&month=3')
            ->assertOk();

        $names = collect($res->json())->pluck('name');
        $this->assertTrue($names->contains('De marzo'));
        $this->assertFalse($names->contains('De abril'));
    }
}
