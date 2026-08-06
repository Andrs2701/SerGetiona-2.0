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

    /**
     * Reporte real: un archivo sin columnas "semestre"/"ciclo" (no son
     * obligatorias) pasaba "Validar" sin errores pero fallaba con HTTP 500
     * ("Undefined array key semestre") al importar de verdad — persistRow()
     * las leía con `?:` en vez de `??`/empty(), que sí tolera la clave ausente.
     */
    public function test_import_succeeds_without_optional_semestre_and_ciclo_columns(): void
    {
        $project = Project::factory()->create();

        $csv = "programa,asignatura,semana_modulo,tipo_contenido\n"
            . "Especializacion en Datos,Estadistica,Semana 1,Creacion\n";

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
        $this->assertNull($deliverable->semestre);
        $this->assertNull($deliverable->ciclo);
    }

    public function test_import_accepts_dd_mm_yyyy_dates(): void
    {
        $project = Project::factory()->create();

        $csv = "programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido,fecha_inicio,fecha_entrega_pedagogia,correo_responsable_pedagogia\n"
            . "Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion,15/08/2026,20/08/2026,{$this->admin->email}\n";

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
        $this->assertSame('2026-08-15', $deliverable->start_date?->toDateString());

        $pedagogyActivity = $deliverable->roleActivities()->where('role', 'pedagogy')->first();
        $this->assertSame('2026-08-20', $pedagogyActivity->commitment_date?->toDateString());
    }

    /**
     * DateTime::createFromFormat('d/m/Y', ...) no rechaza valores fuera de
     * rango por sí solo: "rueda" el mes/día hacia el siguiente (32/13/2026
     * se vuelve silenciosamente 2027-02-01) en vez de fallar. Sin chequear
     * DateTime::getLastErrors() esa fila se importaría con una fecha
     * completamente distinta a la que el usuario escribió, sin ningún aviso.
     */
    public function test_import_rejects_impossible_calendar_date_with_clear_error(): void
    {
        $project = Project::factory()->create();

        $csv = "programa,asignatura,semana_modulo,tipo_contenido,fecha_inicio\n"
            . "Especializacion en Datos,Estadistica,Semana 1,Creacion,32/13/2026\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=1', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('valid', 0)
            ->assertJsonPath('invalid', 1);

        $errors = $response->json('errors');
        $this->assertCount(1, $errors);
        $this->assertSame('fecha_inicio', $errors[0]['field']);
        $this->assertStringContainsString('YYYY-MM-DD', $errors[0]['message']);

        $this->assertNull(Deliverable::where('name', 'Semana 1')->first());
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

    /**
     * Regresión: programa/asignatura/semana_modulo vienen de celdas de
     * Excel digitadas a mano y no pasaban por trim() ni comparación
     * insensible a mayúsculas — una fila con un espacio de más o distinta
     * capitalización creaba un Programa/Asignatura/Entregable duplicado en
     * paralelo, con nombre visualmente idéntico al ya existente.
     */
    public function test_import_treats_whitespace_and_case_variants_as_the_same_program_subject_and_deliverable(): void
    {
        $project = Project::factory()->create();

        $csv = "programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido\n"
            . "Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion\n"
            . "especializacion en datos ,Estadistica ,Semana 1 ,I,1,Creacion\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('errors', []);

        $this->assertSame(1, \App\Models\AcademicProgram::where('project_id', $project->id)->count());
        $program = \App\Models\AcademicProgram::where('project_id', $project->id)->first();
        $this->assertSame(1, \App\Models\Subject::where('academic_program_id', $program->id)->count());
        $subject = \App\Models\Subject::where('academic_program_id', $program->id)->first();
        $this->assertSame(1, Deliverable::where('subject_id', $subject->id)->count());
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

    public function test_import_notifies_the_responsible_and_sets_assigned_at(): void
    {
        $project     = Project::factory()->create();
        $responsible = User::factory()->create(['role' => 'pedagogy', 'is_active' => true]);

        $csv = "programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido,fecha_entrega_pedagogia,correo_responsable_pedagogia\n"
            . "Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion,2026-08-01,{$responsible->email}\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1);

        $this->assertDatabaseHas('notifications', [
            'user_id' => $responsible->id,
            'type'    => 'task_assigned',
        ]);

        $deliverable = Deliverable::where('name', 'Semana 1')->first();
        $pedagogyActivity = $deliverable->roleActivities()->where('role', 'pedagogy')->first();
        $this->assertSame($responsible->id, $pedagogyActivity->responsible_id);
        $this->assertNotNull($pedagogyActivity->assigned_at);
    }

    public function test_import_does_not_notify_an_inactive_responsible(): void
    {
        $project     = Project::factory()->create();
        $responsible = User::factory()->create(['role' => 'pedagogy', 'is_active' => false]);

        $csv = "programa,asignatura,semana_modulo,semestre,ciclo,tipo_contenido,fecha_entrega_pedagogia,correo_responsable_pedagogia\n"
            . "Especializacion en Datos,Estadistica,Semana 1,I,1,Creacion,2026-08-01,{$responsible->email}\n";

        $file = UploadedFile::fake()->createWithContent('carga.csv', $csv);

        $this->actingAs($this->admin, 'sanctum')
            ->postJson('/api/import/deliverables?validate_only=0', [
                'project_id' => $project->id,
                'file'       => $file,
            ])
            ->assertStatus(200)
            ->assertJsonPath('imported', 1);

        // El responsable sí queda asignado en la actividad (la carga no lo bloquea),
        // pero no debe generarse ninguna notificación para un usuario inactivo.
        $deliverable = Deliverable::where('name', 'Semana 1')->first();
        $pedagogyActivity = $deliverable->roleActivities()->where('role', 'pedagogy')->first();
        $this->assertSame($responsible->id, $pedagogyActivity->responsible_id);

        $this->assertDatabaseMissing('notifications', ['user_id' => $responsible->id]);
    }
}
