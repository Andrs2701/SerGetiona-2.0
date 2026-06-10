<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ImportController extends Controller
{
    // ---------------------------------------------------------------
    // Column definitions
    // ---------------------------------------------------------------

    /**
     * Canonical CSV header names (flexible matching is applied below).
     */
    private const EXPECTED_HEADERS = [
        'tipo',
        'programa',
        'asignatura',
        'semana_modulo',
        'semestre',
        'ciclo',
        'tipo_contenido',
        'fecha_inicio',
        'fecha_entrega_experto',
        'fecha_entrega_pedagogia',
        'fecha_entrega_diseno',
        'fecha_entrega_audiovisual',
        'fecha_entrega_ingeniero',
        'fecha_entrega_calidad',
        'correo_responsable_pedagogia',
        'correo_responsable_diseno',
        'correo_responsable_audiovisual',
        'correo_responsable_ingeniero',
        'correo_responsable_calidad',
    ];

    /** Columns that MUST have a value in every data row. */
    private const REQUIRED_COLS = [
        'programa',
        'asignatura',
        'semana_modulo',
        'tipo_contenido',
        'fecha_entrega_experto',
    ];

    /** Map column name → role key (for responsible e-mail look-ups). */
    private const RESPONSIBLE_COLS = [
        'correo_responsable_pedagogia'    => 'pedagogy',
        'correo_responsable_diseno'       => 'design',
        'correo_responsable_audiovisual'  => 'audiovisual',
        'correo_responsable_ingeniero'    => 'engineering',
        'correo_responsable_calidad'      => 'qa',
    ];

    /** Map role → commitment date column name. */
    private const COMMITMENT_COLS = [
        'expert'      => 'fecha_entrega_experto',
        'pedagogy'    => 'fecha_entrega_pedagogia',
        'design'      => 'fecha_entrega_diseno',
        'audiovisual' => 'fecha_entrega_audiovisual',
        'engineering' => 'fecha_entrega_ingeniero',
        'qa'          => 'fecha_entrega_calidad',
    ];

    /** Allowed values for the `tipo` column (mapped to Deliverable::type enum). */
    private const TIPO_MAP = [
        'pregrado'    => 'creation',
        'posgrado'    => 'creation',
        'diplomado'   => 'creation',
        'tarea'       => 'creation',
        'curso'       => 'creation',
        'otro'        => 'creation',
        'creacion'    => 'creation',
        'creación'    => 'creation',
        'creation'    => 'creation',
        'actualizacion' => 'update',
        'actualización' => 'update',
        'update'      => 'update',
    ];

    // ---------------------------------------------------------------
    // POST /api/import/deliverables
    // ---------------------------------------------------------------

    /**
     * Import deliverables from a CSV file.
     *
     * Required form fields:
     *   - file       : CSV file
     *   - project_id : int — the project to import into
     *
     * Optional query param:
     *   - validate_only=1 : run validations only, do not persist
     */
    public function deliverables(Request $request)
    {
        $request->validate([
            'file'       => 'required|file|mimes:csv,txt|max:5120',
            'project_id' => 'required|integer|exists:projects,id',
        ]);

        $projectId = (int) $request->input('project_id');
        $validateOnly = (bool) $request->query('validate_only', false);
        $userId = $request->user()->id;

        [$rows, $parseError] = $this->parseCsv($request->file('file'));

        if ($parseError !== null) {
            return response()->json([
                'imported' => 0,
                'errors'   => [['row' => 0, 'field' => 'file', 'message' => $parseError]],
            ], 422);
        }

        // Pre-cache users by email (lower-case) to avoid N+1 queries
        $usersByEmail = User::pluck('id', 'email')
            ->mapWithKeys(fn ($id, $email) => [mb_strtolower($email) => $id])
            ->all();

        $valid   = 0;
        $invalid = 0;
        $errors  = [];
        $preview = [];
        $rowNum  = 1;

        foreach ($rows as $row) {
            $rowNum++;
            $rowErrors = $this->validateRow($row, $rowNum, $usersByEmail);

            if (!empty($rowErrors)) {
                $errors  = array_merge($errors, $rowErrors);
                $invalid++;
                continue;
            }

            $valid++;

            // Build preview (first 5 valid records)
            if (count($preview) < 5) {
                $preview[] = $this->previewRecord($row);
            }

            if (!$validateOnly) {
                try {
                    DB::transaction(function () use ($row, $projectId, $userId, $usersByEmail) {
                        $this->persistRow($row, $projectId, $userId, $usersByEmail);
                    });
                } catch (\Throwable $e) {
                    $errors[] = ['row' => $rowNum, 'field' => 'general', 'message' => $e->getMessage()];
                    $invalid++;
                    $valid = max(0, $valid - 1);
                }
            }
        }

        if ($validateOnly) {
            return response()->json(compact('valid', 'invalid', 'errors', 'preview'));
        }

        return response()->json([
            'imported' => $valid,
            'errors'   => $errors,
        ]);
    }

    // ---------------------------------------------------------------
    // GET /api/import/template
    // ---------------------------------------------------------------

    /**
     * Download a CSV template with all headers and 2 example rows.
     */
    public function template()
    {
        $headers = self::EXPECTED_HEADERS;

        $rows = [
            [
                'control_de_cambios',
                'Profesional en negocios digitales',
                'Matemáticas aplicadas I',
                'Semana 1',
                'I',
                '1',
                'update',
                '2026-05-11',
                '2026-05-04',
                '2026-05-21',
                '2026-05-27',
                '2026-05-25',
                '2026-05-29',
                '2026-06-01',
                'pedagogo@universidad.edu.co',
                'disenador@universidad.edu.co',
                'audiovisual@universidad.edu.co',
                'ingeniero@universidad.edu.co',
                'calidad@universidad.edu.co',
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
    // Private helpers
    // ---------------------------------------------------------------

    /**
     * Parse the uploaded CSV file.
     * Returns [rows[], errorMessage|null].
     *
     * @return array{0: array<int, array<string, string>>, 1: string|null}
     */
    private function parseCsv(\Illuminate\Http\UploadedFile $file): array
    {
        $content = file_get_contents($file->getRealPath());
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        $lines   = array_values(array_filter(explode("\n", $content), fn ($l) => trim($l) !== ''));

        if (count($lines) < 2) {
            return [[], 'El archivo no contiene filas de datos.'];
        }

        // Parse and normalise header names (lower-case, trim whitespace)
        $rawHeaders = array_map(fn ($h) => mb_strtolower(trim($h)), str_getcsv(array_shift($lines)));

        $rows = [];
        foreach ($lines as $line) {
            $values = array_map('trim', str_getcsv($line));
            $row    = [];
            foreach ($rawHeaders as $i => $header) {
                $row[$header] = $values[$i] ?? '';
            }
            $rows[] = $row;
        }

        return [$rows, null];
    }

    /**
     * Validate a single data row.
     * Returns an array of error objects (may be empty).
     *
     * @param  array<string, string>  $row
     * @param  array<string, int>     $usersByEmail
     * @return array<int, array{row: int, field: string, message: string}>
     */
    private function validateRow(array $row, int $rowNum, array $usersByEmail): array
    {
        $errors = [];

        // Required fields
        foreach (self::REQUIRED_COLS as $col) {
            if (empty($row[$col] ?? '')) {
                $errors[] = [
                    'row'     => $rowNum,
                    'field'   => $col,
                    'message' => "El campo '{$col}' es obligatorio.",
                ];
            }
        }

        // Date formats
        $dateCols = array_merge(
            ['fecha_inicio'],
            array_values(self::COMMITMENT_COLS)
        );
        foreach ($dateCols as $col) {
            $val = $row[$col] ?? '';
            if (!empty($val) && $this->parseDate($val) === null) {
                $errors[] = [
                    'row'     => $rowNum,
                    'field'   => $col,
                    'message' => "Formato de fecha inválido en '{$col}'. Use YYYY-MM-DD o DD/MM/YYYY.",
                ];
            }
        }

        // Responsible e-mails must belong to existing users
        foreach (self::RESPONSIBLE_COLS as $col => $_role) {
            $email = mb_strtolower(trim($row[$col] ?? ''));
            if (!empty($email) && !isset($usersByEmail[$email])) {
                $errors[] = [
                    'row'     => $rowNum,
                    'field'   => $col,
                    'message' => "El usuario con correo '{$email}' no existe en el sistema.",
                ];
            }
        }

        return $errors;
    }

    /**
     * Persist a validated row inside an existing DB transaction.
     *
     * @param  array<string, string>  $row
     * @param  array<string, int>     $usersByEmail
     */
    private function persistRow(array $row, int $projectId, int $userId, array $usersByEmail): void
    {
        // 1. Program
        $program = AcademicProgram::firstOrCreate(
            ['name' => $row['programa'], 'project_id' => $projectId],
            ['created_by' => $userId]
        );

        // 2. Subject
        $subject = Subject::firstOrCreate(
            ['name' => $row['asignatura'], 'academic_program_id' => $program->id],
            ['created_by' => $userId]
        );

        // 3. Deliverable type
        $tipoKey    = mb_strtolower(trim($row['tipo'] ?? ''));
        $mappedType = self::TIPO_MAP[$tipoKey] ?? 'creation';

        // 4. Deliverable
        $deliverable = Deliverable::firstOrCreate(
            [
                'subject_id' => $subject->id,
                'name'       => $row['semana_modulo'],
            ],
            [
                'type'          => $mappedType,
                'content_type'  => $row['tipo_contenido'] ?: null,
                'global_status' => 'unpublished',
                'semestre'      => $row['semestre'] ?: null,
                'ciclo'         => $row['ciclo'] ?: null,
                'start_date'    => !empty($row['fecha_inicio']) ? $this->parseDate($row['fecha_inicio']) : null,
                'created_by'    => $userId,
            ]
        );

        // 5. Role activities
        foreach (self::COMMITMENT_COLS as $role => $dateCol) {
            $commitmentDate = !empty($row[$dateCol]) ? $this->parseDate($row[$dateCol]) : null;

            // Resolve responsible user
            $responsibleId = null;
            foreach (self::RESPONSIBLE_COLS as $emailCol => $emailRole) {
                if ($emailRole === $role) {
                    $email = mb_strtolower(trim($row[$emailCol] ?? ''));
                    if (!empty($email) && isset($usersByEmail[$email])) {
                        $responsibleId = $usersByEmail[$email];
                    }
                    break;
                }
            }

            $activity = RoleActivity::firstOrCreate(
                ['deliverable_id' => $deliverable->id, 'role' => $role],
                [
                    'status'          => 'not_started',
                    'commitment_date' => $commitmentDate,
                    'responsible_id'  => $responsibleId,
                    'checklist'       => json_encode(RoleActivity::defaultChecklist($role)),
                ]
            );

            // Update commitment date / responsible if the record already existed
            if (!$activity->wasRecentlyCreated) {
                $updates = [];
                if ($commitmentDate !== null && $activity->commitment_date === null) {
                    $updates['commitment_date'] = $commitmentDate;
                }
                if ($responsibleId !== null && $activity->responsible_id === null) {
                    $updates['responsible_id'] = $responsibleId;
                }
                if (!empty($updates)) {
                    $activity->update($updates);
                }
            }
        }
    }

    /**
     * Build a lightweight preview record (no DB writes).
     *
     * @param  array<string, string>  $row
     * @return array<string, string>
     */
    private function previewRecord(array $row): array
    {
        return [
            'programa'        => $row['programa']        ?? '',
            'asignatura'      => $row['asignatura']      ?? '',
            'semana_modulo'   => $row['semana_modulo']   ?? '',
            'tipo_contenido'  => $row['tipo_contenido']  ?? '',
            'semestre'        => $row['semestre']        ?? '',
            'ciclo'           => $row['ciclo']           ?? '',
            'fecha_inicio'    => $row['fecha_inicio']    ?? '',
            'fecha_experto'   => $row['fecha_entrega_experto'] ?? '',
        ];
    }

    /**
     * Parse a date string in several common formats.
     * Returns 'Y-m-d' string or null on failure.
     */
    private function parseDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') {
            return null;
        }

        $formats = ['d/m/Y', 'd-m-Y', 'Y-m-d', 'Y/m/d', 'd/m/y'];
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $value);
            if ($date !== false) {
                return $date->format('Y-m-d');
            }
        }

        $timestamp = strtotime($value);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }

        return null;
    }
}
