<?php

namespace Tests\Feature;

use App\Models\AcademicLevel;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class AcademicLevelTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $expert;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin  = User::factory()->create(['role' => 'admin',  'is_active' => true]);
        $this->expert = User::factory()->create(['role' => 'expert', 'is_active' => true]);
    }

    public function test_migration_seeds_the_five_academic_levels(): void
    {
        $names = AcademicLevel::orderBy('sort_order')->pluck('name')->all();
        $this->assertSame(['Pregrado', 'Posgrado', 'Continuada', 'Curso', 'Externo'], $names);
    }

    public function test_any_authenticated_user_can_list_academic_levels(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->getJson('/api/academic-levels')
            ->assertStatus(200)
            ->assertJsonStructure(['levels']);
    }

    public function test_admin_can_create_academic_level(): void
    {
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/academic-levels', ['name' => 'Diplomado', 'sort_order' => 9])
            ->assertStatus(201)
            ->assertJsonPath('name', 'Diplomado');
    }

    public function test_non_admin_cannot_create_academic_level(): void
    {
        $this->actingAs($this->expert, 'sanctum')
            ->postJson('/api/academic-levels', ['name' => 'Diplomado'])
            ->assertStatus(403);
    }

    public function test_admin_cannot_delete_level_in_use(): void
    {
        $level = AcademicLevel::where('name', 'Curso')->first();
        Deliverable::factory()->create(['academic_level_id' => $level->id]);

        $this->actingAs($this->admin, 'sanctum')
            ->deleteJson("/api/academic-levels/{$level->id}")
            ->assertStatus(409);
    }

    public function test_deliverable_can_be_created_with_an_academic_level(): void
    {
        $level   = AcademicLevel::where('name', 'Posgrado')->first();
        $subject = \App\Models\Subject::factory()->create();

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/deliverables', [
                'subject_id'        => $subject->id,
                'name'              => 'Semana 1',
                'academic_level_id' => $level->id,
            ])
            ->assertStatus(200)
            ->assertJsonPath('academic_level_id', $level->id)
            ->assertJsonPath('academic_level.name', 'Posgrado');
    }

    public function test_import_resolves_academic_level_id_from_tipo_column(): void
    {
        $project = Project::factory()->create();

        $csv = "tipo,programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido,fecha_entrega_experto\n"
            . "Posgrado,Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion,2026-08-15\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1);

        $level = AcademicLevel::where('name', 'Posgrado')->first();
        $deliverable = Deliverable::where('name', 'Semana 1')->first();

        $this->assertNotNull($deliverable);
        $this->assertSame($level->id, $deliverable->academic_level_id);
        $this->assertSame('Posgrado', $deliverable->record_type);
    }

    public function test_import_leaves_academic_level_id_null_when_tipo_does_not_match_catalog(): void
    {
        $project = Project::factory()->create();

        $csv = "tipo,programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido,fecha_entrega_experto\n"
            . "ValorInventado,Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion,2026-08-15\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1);

        $deliverable = Deliverable::where('name', 'Semana 1')->first();

        $this->assertNotNull($deliverable);
        $this->assertNull($deliverable->academic_level_id);
        $this->assertSame('ValorInventado', $deliverable->record_type);
    }
}
