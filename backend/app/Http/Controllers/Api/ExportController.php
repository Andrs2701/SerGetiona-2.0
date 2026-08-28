<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use Illuminate\Http\Request;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class ExportController extends Controller
{
    /**
     * Roles en el orden secuencial del flujo.
     */
    private const ROLES = [
        'expert'      => 'Experto',
        'pedagogy'    => 'Pedagogía',
        'design'      => 'Diseño',
        'audiovisual' => 'Audiovisual',
        'engineering' => 'Ingeniería',
        'qa'          => 'Calidad',
    ];

    /**
     * GET /api/export/deliverables?project_id=X
     *
     * Mismas columnas, colores y anchos que la plantilla de Carga Masiva
     * (ver ImportController::HEADERS, COLOR_HEADER_BG, COLOR_HEADER_FG y
     * COLUMN_WIDTHS) para que el archivo exportado se pueda editar y volver
     * a subir por ese flujo.
     */
    public function deliverables(Request $request)
    {
        $query = Deliverable::with([
            'subject.academicProgram.project',
            'academicLevel',
            'roleActivities.responsible',
        ]);

        if ($request->filled('project_id')) {
            $query->whereHas('subject.academicProgram', function ($q) use ($request) {
                $q->where('project_id', $request->project_id);
            });
        }

        $deliverables = $query->get();

        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setTitle('Entregables SerGestiona')
            ->setCreator('SerGestiona 2.0')
            ->setDescription('Exportación de entregables — mismo formato que la plantilla de Carga Masiva');

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Entregables');

        $headerLabels = array_values(ImportController::HEADERS);

        $col = 1;
        foreach ($headerLabels as $label) {
            $colLetter = Coordinate::stringFromColumnIndex($col);
            $sheet->getCell($colLetter . '1')->setValue($label);
            $sheet->getStyle($colLetter . '1')->applyFromArray([
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => ImportController::COLOR_HEADER_BG]],
                'font'      => ['bold' => true, 'size' => 9, 'color' => ['argb' => ImportController::COLOR_HEADER_FG]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF2C5282']]],
            ]);
            $col++;
        }
        $sheet->getRowDimension(1)->setRowHeight(32);

        $row = 2;
        foreach ($deliverables as $deliverable) {
            $subject    = $deliverable->subject;
            $program    = $subject?->academicProgram;
            $project    = $program?->project;
            $activities = $deliverable->roleActivities->keyBy('role');

            // Acceso vía ?? null (no directo con []): no todos los
            // entregables tienen una RoleActivity para cada rol, y el
            // acceso directo por clave lanza "Undefined array key" en vez
            // de simplemente devolver null.
            $expertAct      = $activities['expert'] ?? null;
            $pedagogyAct    = $activities['pedagogy'] ?? null;
            $designAct      = $activities['design'] ?? null;
            $audiovisualAct = $activities['audiovisual'] ?? null;
            $engineeringAct = $activities['engineering'] ?? null;
            $qaAct          = $activities['qa'] ?? null;

            $values = [
                $project?->name ?? '',
                $deliverable->academicLevel?->name ?? '',
                $program?->name ?? '',
                $subject?->name ?? '',
                $deliverable->name,
                $deliverable->semestre ?? '',
                $deliverable->ciclo ?? '',
                $deliverable->type === 'update' ? 'Actualizacion' : 'Creacion',
                $deliverable->start_date?->format('Y-m-d') ?? '',
                $expertAct?->commitment_date?->format('Y-m-d') ?? '',
                $pedagogyAct?->commitment_date?->format('Y-m-d') ?? '',
                $designAct?->commitment_date?->format('Y-m-d') ?? '',
                $audiovisualAct?->commitment_date?->format('Y-m-d') ?? '',
                $engineeringAct?->commitment_date?->format('Y-m-d') ?? '',
                $qaAct?->commitment_date?->format('Y-m-d') ?? '',
                $pedagogyAct?->responsible?->email ?? '',
                $designAct?->responsible?->email ?? '',
                $audiovisualAct?->responsible?->email ?? '',
                $engineeringAct?->responsible?->email ?? '',
                $qaAct?->responsible?->email ?? '',
            ];

            $col = 1;
            foreach ($values as $value) {
                $sheet->getCell(Coordinate::stringFromColumnIndex($col) . $row)->setValue($value);
                $col++;
            }
            $row++;
        }

        $col = 1;
        foreach (ImportController::COLUMN_WIDTHS as $w) {
            $sheet->getColumnDimensionByColumn($col)->setWidth($w);
            $col++;
        }

        $sheet->freezePane('A2');

        $date     = now()->format('Y-m-d');
        $filename = "entregables_{$date}.xlsx";

        $writer = new Xlsx($spreadsheet);
        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control'       => 'no-cache, no-store',
        ]);
    }

    /**
     * GET /api/export/projects?format=csv
     */
    public function projects(Request $request)
    {
        $projects = Project::with(['responsible', 'academicPrograms.subjects.deliverables.roleActivities'])->get();

        $date     = now()->format('Y-m-d');
        $filename = "proyectos_{$date}.csv";

        return response()->streamDownload(function () use ($projects) {
            $output = fopen('php://output', 'w');
            fputs($output, "\xEF\xBB\xBF");

            fputcsv($output, [
                'Nombre', 'Estado', 'Programas', 'Entregables', 'Cumplimiento (%)',
                'Responsable', 'Fecha Inicio', 'Fecha Fin',
            ]);

            foreach ($projects as $project) {
                $programsCount    = $project->academicPrograms->count();
                $deliverablesList = [];

                foreach ($project->academicPrograms as $program) {
                    foreach ($program->subjects as $subject) {
                        foreach ($subject->deliverables as $d) {
                            $deliverablesList[] = $d;
                        }
                    }
                }

                $totalDeliverables = count($deliverablesList);
                $totalRoles        = 0;
                $completedRoles    = 0;

                foreach ($deliverablesList as $d) {
                    foreach ($d->roleActivities as $act) {
                        if ($act->status === 'not_applicable') {
                            continue;
                        }
                        $totalRoles++;
                        if (in_array($act->status, RoleActivity::COMPLETED_STATUSES, true)) {
                            $completedRoles++;
                        }
                    }
                }

                $compliance = $totalRoles > 0 ? round(($completedRoles / $totalRoles) * 100, 1) : 0;

                fputcsv($output, [
                    $project->name,
                    $this->translateGlobalStatus($project->status ?? ''),
                    $programsCount,
                    $totalDeliverables,
                    $compliance . '%',
                    $project->responsible?->name ?? '',
                    $project->start_date?->format('d/m/Y') ?? '',
                    $project->end_date?->format('d/m/Y')   ?? '',
                ]);
            }

            fclose($output);
        }, $filename, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private function translateGlobalStatus(string $status): string
    {
        return match($status) {
            'unpublished'        => 'No Publicado',
            'pending_start'      => 'Pendiente Inicio',
            'in_progress'        => 'En Progreso',
            'in_review'          => 'En Revisión',
            'with_observations'  => 'Con Observaciones',
            'finished'           => 'Finalizado',
            'cancelled'          => 'Cancelado',
            'not_applicable'     => 'No Aplica',
            'active'             => 'Activo',
            'paused'             => 'Pausado',
            default              => $status,
        };
    }
}
