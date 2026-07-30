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
}
