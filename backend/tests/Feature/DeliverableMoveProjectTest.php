<?php

namespace Tests\Feature;

use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeliverableMoveProjectTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    public function test_admin_can_move_a_deliverable_to_a_different_project(): void
    {
        $originProject = Project::factory()->create();
        $targetProject = Project::factory()->create();

        $program    = AcademicProgram::factory()->create(['project_id' => $originProject->id, 'name' => 'Ingeniería de Sistemas']);
        $subject    = Subject::factory()->create(['academic_program_id' => $program->id, 'name' => 'Estructuras de Datos']);
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/deliverables/{$deliverable->id}", [
                'project_id' => $targetProject->id,
            ])
            ->assertStatus(200);

        $deliverable->refresh();
        $newSubject = $deliverable->subject()->with('academicProgram')->first();

        $this->assertSame($targetProject->id, $newSubject->academicProgram->project_id);
        $this->assertSame('Ingeniería de Sistemas', $newSubject->academicProgram->name);
        $this->assertSame('Estructuras de Datos', $newSubject->name);

        // El programa/asignatura original bajo el proyecto de origen sigue existiendo intacto.
        $this->assertDatabaseHas('academic_programs', ['id' => $program->id, 'project_id' => $originProject->id]);
    }

    public function test_moving_to_a_project_where_the_program_already_exists_reuses_it(): void
    {
        $originProject = Project::factory()->create();
        $targetProject = Project::factory()->create();

        $originProgram = AcademicProgram::factory()->create(['project_id' => $originProject->id, 'name' => 'Ingeniería de Sistemas']);
        $existingTargetProgram = AcademicProgram::factory()->create(['project_id' => $targetProject->id, 'name' => 'Ingeniería de Sistemas']);

        $subject     = Subject::factory()->create(['academic_program_id' => $originProgram->id]);
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/deliverables/{$deliverable->id}", [
                'project_id' => $targetProject->id,
            ])
            ->assertStatus(200);

        $newSubject = $deliverable->fresh()->subject;
        $this->assertSame($existingTargetProgram->id, $newSubject->academic_program_id);

        // No se creó un programa duplicado bajo el proyecto destino.
        $this->assertSame(1, AcademicProgram::where('project_id', $targetProject->id)->count());
    }

    public function test_move_does_not_trigger_when_project_id_unchanged(): void
    {
        $project = Project::factory()->create();
        $program = AcademicProgram::factory()->create(['project_id' => $project->id]);
        $subject = Subject::factory()->create(['academic_program_id' => $program->id]);
        $deliverable = Deliverable::factory()->create(['subject_id' => $subject->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->putJson("/api/deliverables/{$deliverable->id}", [
                'project_id' => $project->id,
            ])
            ->assertStatus(200);

        $deliverable->refresh();
        $this->assertSame($subject->id, $deliverable->subject_id);
        // No se creó ningún programa/asignatura adicional.
        $this->assertSame(1, AcademicProgram::count());
    }
}
