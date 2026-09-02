<?php

namespace Tests\Feature;

use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class ExportControllerTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = User::factory()->create(['role' => 'admin', 'is_active' => true]);
    }

    /**
     * Las fechas exportadas deben ser celdas de fecha REALES de Excel (no
     * texto) con el código de formato literal 'dd/mm/yyyy' — así se ven
     * día/mes/año sin importar la configuración regional de quien abra el
     * archivo, y de paso el archivo se puede re-subir por Carga Masiva sin
     * pasar por el parseo de texto (Date::isDateTime() las detecta primero).
     */
    public function test_deliverables_export_writes_dates_as_real_dd_mm_yyyy_excel_dates(): void
    {
        $deliverable = Deliverable::factory()->create([
            'name'       => 'Semana 1',
            'start_date' => '2026-03-05', // 5 de marzo — día y mes ambos <= 12, sin ambigüedad posible al leer el resultado
        ]);

        RoleActivity::factory()->create([
            'deliverable_id'  => $deliverable->id,
            'role'            => 'expert',
            'responsible_id'  => $this->admin->id,
            'commitment_date' => '2026-12-25',
        ]);

        $response = $this->actingAs($this->admin, 'sanctum')
            ->get('/api/export/deliverables')
            ->assertStatus(200)
            ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        $tmpPath = tempnam(sys_get_temp_dir(), 'export_test_') . '.xlsx';
        file_put_contents($tmpPath, $response->getContent());

        try {
            $sheet = IOFactory::load($tmpPath)->getActiveSheet();

            // Localiza las columnas por el texto del encabezado (fila 1) en
            // vez de asumir una posición fija — no depende de que el orden
            // de ImportController::HEADERS no cambie nunca.
            $headerCol = [];
            foreach ($sheet->getRowIterator(1, 1)->current()->getCellIterator() as $cell) {
                $headerCol[$cell->getValue()] = $cell->getColumn();
            }

            $startCol   = $headerCol['Fecha Inicio'] ?? null;
            $expertCol  = $headerCol['Fecha Entrega Experto'] ?? null;
            $this->assertNotNull($startCol, 'No se encontró la columna "Fecha Inicio" en el encabezado exportado.');
            $this->assertNotNull($expertCol, 'No se encontró la columna "Fecha Entrega Experto" en el encabezado exportado.');

            $startCell  = $sheet->getCell($startCol . '2');
            $expertCell = $sheet->getCell($expertCol . '2');

            $this->assertSame(
                '2026-03-05',
                \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($startCell->getValue())->format('Y-m-d')
            );
            $this->assertSame(
                '2026-12-25',
                \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject($expertCell->getValue())->format('Y-m-d')
            );

            $this->assertSame('dd/mm/yyyy', $startCell->getStyle()->getNumberFormat()->getFormatCode());
            $this->assertSame('dd/mm/yyyy', $expertCell->getStyle()->getNumberFormat()->getFormatCode());
        } finally {
            @unlink($tmpPath);
        }
    }
}
