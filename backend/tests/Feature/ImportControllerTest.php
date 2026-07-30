<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class ImportControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    public function test_import_succeeds_without_fecha_entrega_experto_and_marks_expert_not_applicable(): void
    {
        $project = Project::factory()->create();

        // Sin columna fecha_entrega_experto: el rol Experto no aplica para esta fila.
        $csv = "programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido,fecha_entrega_pedagogia,correo_responsable_pedagogia\n"
            . "Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion,2026-08-01,{$this->admin->email}\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1)
            ->assertJsonPath('errors', []);

        $deliverable = Deliverable::where('name', 'Semana 1')->first();
        $this->assertNotNull($deliverable);

        $expertActivity = $deliverable->roleActivities()->where('role', 'expert')->first();
        $this->assertNotNull($expertActivity);
        $this->assertNull($expertActivity->commitment_date);
        $this->assertNull($expertActivity->responsible_id);
        $this->assertSame('not_applicable', $expertActivity->status);

        // El resto de la fila sí se procesa con normalidad.
        $pedagogyActivity = $deliverable->roleActivities()->where('role', 'pedagogy')->first();
        $this->assertSame($this->admin->id, $pedagogyActivity->responsible_id);
        $this->assertSame('not_started', $pedagogyActivity->status);
    }

    public function test_import_resolves_project_from_row_column_without_any_default_selected(): void
    {
        $csv = "proyecto,programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido\n"
            . "Escuela Nueva Desde Excel,Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        // Sin project_id ni project_name en la petición: el archivo trae su propia columna.
        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'file' => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1)
            ->assertJsonPath('errors', []);

        $project = Project::where('name', 'Escuela Nueva Desde Excel')->first();
        $this->assertNotNull($project);

        $deliverable = Deliverable::where('name', 'Semana 1')->first();
        $this->assertNotNull($deliverable);
        $this->assertSame($project->id, $deliverable->subject->academicProgram->project_id);
    }

    public function test_import_fails_clearly_when_no_project_anywhere(): void
    {
        $csv = "programa,asignatura,semana_modulo,tipo_contenido\n"
            . "Especializacion en Datos,Estadistica,Semana 1,Creacion\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=1', [
                'file' => $file,
            ])
            ->assertStatus(200);

        $response->assertJsonPath('valid', 0);
        $response->assertJsonPath('invalid', 1);
        $this->assertStringContainsString('proyecto', $response->json('errors.0.message'));
    }

    public function test_import_row_project_overrides_default_selected_project(): void
    {
        $defaultProject = Project::factory()->create(['name' => 'Proyecto Seleccionado En Pantalla']);

        $csv = "proyecto,programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido\n"
            . "Otro Proyecto Del Excel,Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $defaultProject->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1);

        $deliverable = Deliverable::where('name', 'Semana 1')->first();
        $this->assertSame('Otro Proyecto Del Excel', $deliverable->subject->academicProgram->project->name);
    }
}
