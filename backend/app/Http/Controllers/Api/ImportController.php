<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\RoleActivity;
use App\Models\Subject;
use Illuminate\Http\Request;

class ImportController extends Controller
{
    /**
     * Columnas esperadas en el CSV (en orden).
     */
    private const EXPECTED_HEADERS = [
        'Tipo',
        'Programa',
        'Asignatura',
        'Semana',
        'Semestre',
        'Ciclo',
        'T_Contenido',
        'C_Entrega_Experto',
        'C_Fecha_Inicio',
        'C_Entrega_Pedagogia',
        'C_Entrega_Diseño',
        'C_Entrega_Audiovisual',
        'C_Entrega_Ingeniero',
        'C_Entrega_Calidad',
        'Res_Pedagogía',
        'Res_Diseño',
        'Res_Audiovisual',
        'Res_Ingeniero',
        'Res_Calidad',
    ];

    /**
     * POST /api/import/deliverables
     * Acepta un archivo CSV y crea entregables masivamente.
     */
    public function deliverables(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:5120',
        ]);

        $file = $request->file('file');
        $content = file_get_contents($file->getRealPath());

        // Normalizar saltos de línea
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        $lines = array_filter(explode("\n", $content), fn($l) => trim($l) !== '');
        $lines = array_values($lines);

        if (count($lines) < 2) {
            return response()->json([
                'imported' => 0,
                'errors'   => [['row' => 0, 'message' => 'El archivo no contiene filas de datos.']],
            ], 422);
        }

        // Parsear cabecera
        $headers = str_getcsv(array_shift($lines));
        $headers = array_map('trim', $headers);

        $imported = 0;
        $errors   = [];
        $rowNum   = 1; // fila 1 = primera fila de datos (después de la cabecera)

        $userId = $request->user()->id;

        foreach ($lines as $line) {
            $rowNum++;
            $values = str_getcsv($line);
            $values = array_map('trim', $values);

            // Mapear columna => valor de forma flexible
            $row = [];
            foreach ($headers as $i => $header) {
                $row[$header] = $values[$i] ?? '';
            }

            // Campos mínimos requeridos
            $programName   = $row['Programa']   ?? '';
            $subjectName   = $row['Asignatura'] ?? '';
            $tipo          = $row['Tipo']        ?? '';
            $tContenido    = $row['T_Contenido'] ?? '';

            if (empty($programName) || empty($subjectName)) {
                $errors[] = [
                    'row'     => $rowNum,
                    'message' => 'Programa o Asignatura vacíos — fila omitida.',
                ];
                continue;
            }

            try {
                // 1. Buscar o crear Programa (AcademicProgram)
                $program = AcademicProgram::firstOrCreate(
                    ['name' => $programName],
                    ['created_by' => $userId]
                );

                // 2. Buscar o crear Asignatura (Subject)
                $subject = Subject::firstOrCreate(
                    ['name' => $subjectName, 'academic_program_id' => $program->id],
                    ['created_by' => $userId]
                );

                // 3. Nombre del entregable: usamos T_Contenido si existe, sino Asignatura
                $deliverableName = !empty($tContenido) ? $tContenido : $subjectName;

                // Mapear tipo al enum del modelo
                $typeMap = [
                    'creacion' => 'creation',
                    'creación' => 'creation',
                    'creation' => 'creation',
                    'actualizacion' => 'update',
                    'actualización' => 'update',
                    'update' => 'update',
                ];
                $tipoLower   = mb_strtolower(trim($tipo));
                $mappedType  = $typeMap[$tipoLower] ?? 'creation';

                $deliverable = Deliverable::firstOrCreate(
                    [
                        'subject_id' => $subject->id,
                        'name'       => $deliverableName,
                    ],
                    [
                        'type'          => $mappedType,
                        'content_type'  => $tContenido ?: null,
                        'global_status' => 'unpublished',
                        'semestre'      => $row['Semestre'] ?? null,
                        'ciclo'         => $row['Ciclo']    ?? null,
                        'start_date'    => !empty($row['C_Fecha_Inicio']) ? $this->parseDate($row['C_Fecha_Inicio']) : null,
                        'created_by'    => $userId,
                    ]
                );

                // 4. Crear o actualizar RoleActivities
                $roleMap = [
                    'expert'      => ['commitment_date_col' => 'C_Entrega_Experto',    'responsible_col' => null],
                    'pedagogy'    => ['commitment_date_col' => 'C_Entrega_Pedagogia',  'responsible_col' => 'Res_Pedagogía'],
                    'design'      => ['commitment_date_col' => 'C_Entrega_Diseño',     'responsible_col' => 'Res_Diseño'],
                    'audiovisual' => ['commitment_date_col' => 'C_Entrega_Audiovisual','responsible_col' => 'Res_Audiovisual'],
                    'engineering' => ['commitment_date_col' => 'C_Entrega_Ingeniero',  'responsible_col' => 'Res_Ingeniero'],
                    'qa'          => ['commitment_date_col' => 'C_Entrega_Calidad',    'responsible_col' => 'Res_Calidad'],
                ];

                foreach ($roleMap as $role => $cols) {
                    $commitmentDate = null;
                    if (!empty($cols['commitment_date_col']) && !empty($row[$cols['commitment_date_col']])) {
                        $commitmentDate = $this->parseDate($row[$cols['commitment_date_col']]);
                    }

                    RoleActivity::firstOrCreate(
                        ['deliverable_id' => $deliverable->id, 'role' => $role],
                        [
                            'status'          => 'not_started',
                            'commitment_date' => $commitmentDate,
                            'checklist'       => json_encode(RoleActivity::defaultChecklist($role)),
                        ]
                    );
                }

                $imported++;
            } catch (\Throwable $e) {
                $errors[] = [
                    'row'     => $rowNum,
                    'message' => $e->getMessage(),
                ];
            }
        }

        return response()->json([
            'imported' => $imported,
            'errors'   => $errors,
        ]);
    }

    /**
     * GET /api/import/template
     * Descarga plantilla CSV con cabeceras y 2 filas de ejemplo.
     */
    public function template()
    {
        $headers = self::EXPECTED_HEADERS;

        $rows = [
            [
                'creacion',
                'Ingeniería de Sistemas',
                'Introducción a la Programación',
                '1',
                '2024-1',
                '1',
                'Fundamentos de algoritmos',
                '2024-02-15',
                '2024-02-01',
                '2024-02-22',
                '2024-03-01',
                '2024-03-08',
                '2024-03-15',
                '2024-03-22',
                'Ana Torres',
                'Luis García',
                'Pedro Ramírez',
                'Carlos Méndez',
                'Laura Soto',
            ],
            [
                'actualizacion',
                'Administración de Empresas',
                'Gestión de Proyectos',
                '3',
                '2024-2',
                '2',
                'Marco lógico de proyectos',
                '2024-04-10',
                '2024-03-25',
                '2024-04-17',
                '2024-04-24',
                '2024-05-01',
                '2024-05-08',
                '2024-05-15',
                'María López',
                'Jorge Ruiz',
                'Sandra Peña',
                'Andrés Díaz',
                'Camila Vargas',
            ],
        ];

        $output = fopen('php://temp', 'r+');
        fputcsv($output, $headers);
        foreach ($rows as $row) {
            fputcsv($output, $row);
        }
        rewind($output);
        $csv = stream_get_contents($output);
        fclose($output);

        return response($csv, 200, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="plantilla_sergestiona.csv"',
        ]);
    }

    // ---------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------

    private function parseDate(string $value): ?string
    {
        $value = trim($value);
        if (empty($value)) {
            return null;
        }

        // Formatos comunes: d/m/Y, d-m-Y, Y-m-d, Y/m/d
        $formats = ['d/m/Y', 'd-m-Y', 'Y-m-d', 'Y/m/d', 'd/m/y'];
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $value);
            if ($date !== false) {
                return $date->format('Y-m-d');
            }
        }

        // Último intento con strtotime
        $timestamp = strtotime($value);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }

        return null;
    }
}
