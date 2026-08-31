<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicLevel;
use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;

class ImportController extends Controller
{
    // ---------------------------------------------------------------
    // Column definitions
    // ---------------------------------------------------------------

    public const HEADERS = [
        'proyecto'                      => 'Escuela / Proyecto',
        'tipo'                          => 'Tipo',
        'programa'                      => 'Programa',
        'asignatura'                    => 'Asignatura',
        'semana_modulo'                 => 'Semana / Módulo',
        'semestre'                      => 'Semestre',
        'ciclo'                         => 'Ciclo',
        'tipo_contenido'                => 'Tipo Contenido',
        'fecha_inicio'                  => 'Fecha Inicio',
        'fecha_entrega_experto'         => 'Fecha Entrega Experto',
        'fecha_entrega_pedagogia'       => 'Fecha Entrega Pedagogía',
        'fecha_entrega_diseno'          => 'Fecha Entrega Diseño',
        'fecha_entrega_audiovisual'     => 'Fecha Entrega Audiovisual',
        'fecha_entrega_ingeniero'       => 'Fecha Entrega Ingeniero',
        'fecha_entrega_calidad'         => 'Fecha Entrega Calidad',
        'correo_responsable_experto'    => 'Correo Responsable Experto',
        'correo_responsable_pedagogia'  => 'Correo Responsable Pedagogía',
        'correo_responsable_diseno'     => 'Correo Responsable Diseño',
        'correo_responsable_audiovisual'=> 'Correo Responsable Audiovisual',
        'correo_responsable_ingeniero'  => 'Correo Responsable Ingeniero',
        'correo_responsable_calidad'    => 'Correo Responsable Calidad',
    ];

    /** Canonical key names (lower snake_case) used internally. */
    private const KEYS = [
        'proyecto', 'tipo', 'programa', 'asignatura', 'semana_modulo', 'semestre', 'ciclo',
        'tipo_contenido', 'fecha_inicio',
        'fecha_entrega_experto', 'fecha_entrega_pedagogia', 'fecha_entrega_diseno',
        'fecha_entrega_audiovisual', 'fecha_entrega_ingeniero', 'fecha_entrega_calidad',
        'correo_responsable_experto', 'correo_responsable_pedagogia', 'correo_responsable_diseno',
        'correo_responsable_audiovisual', 'correo_responsable_ingeniero',
        'correo_responsable_calidad',
    ];

    /**
     * Columns that MUST have a value in every data row.
     * Ningún `fecha_entrega_*`/`correo_responsable_*` es obligatorio: un rol
     * sin responsable asignado queda automáticamente en 'not_applicable'
     * (RoleActivityObserver::creating()), lo cual es válido — no todos los
     * entregables necesitan los 6 roles. Exigir esas columnas bloquearía
     * filas donde ese rol simplemente no aplica.
     */
    private const REQUIRED_COLS = [
        'programa', 'asignatura', 'semana_modulo', 'tipo_contenido',
    ];

    /** Map column key → role key (for responsible e-mail look-ups). */
    private const RESPONSIBLE_COLS = [
        'correo_responsable_experto'      => 'expert',
        'correo_responsable_pedagogia'    => 'pedagogy',
        'correo_responsable_diseno'       => 'design',
        'correo_responsable_audiovisual'  => 'audiovisual',
        'correo_responsable_ingeniero'    => 'engineering',
        'correo_responsable_calidad'      => 'qa',
    ];

    /** Map role → commitment date column key. */
    private const COMMITMENT_COLS = [
        'expert'      => 'fecha_entrega_experto',
        'pedagogy'    => 'fecha_entrega_pedagogia',
        'design'      => 'fecha_entrega_diseno',
        'audiovisual' => 'fecha_entrega_audiovisual',
        'engineering' => 'fecha_entrega_ingeniero',
        'qa'          => 'fecha_entrega_calidad',
    ];

    /**
     * Maps tipo_contenido → Deliverable::type enum (creation | update).
     * `tipo` column stores the academic level (pregrado, posgrado…) in record_type,
     * and — when it matches a catalog entry — also resolves academic_level_id.
     */
    private const TIPO_CONTENIDO_MAP = [
        'creacion'      => 'creation',
        'creación'      => 'creation',
        'creation'      => 'creation',
        'actualizacion' => 'update',
        'actualización' => 'update',
        'update'        => 'update',
        'tarea'         => 'creation',
        'otro'          => 'creation',
    ];

    /**
     * Institutional colors for the template Excel — HEADERS, estos colores y
     * COLUMN_WIDTHS son públicos porque ExportController los reutiliza tal
     * cual para que el .xlsx de "Exportar" comparta estructura y colores con
     * esta plantilla (mismo layout de columnas, mismo azul institucional).
     */
    public const COLOR_HEADER_BG   = 'FF194276'; // #194276 dark blue
    public const COLOR_HEADER_FG   = 'FFFFFFFF'; // white
    private const COLOR_EXAMPLE_BG = 'FFE8EEF5'; // light blue tint
    private const COLOR_NOTE_BG    = 'FFFFFF00'; // light yellow
    private const COLOR_REQUIRED   = 'FFFF4444'; // red marker for required columns

    /** Column widths, in the same order as HEADERS. */
    public const COLUMN_WIDTHS = [22, 18, 28, 28, 20, 10, 8, 18, 14, 18, 18, 18, 18, 18, 18, 30, 30, 30, 30, 30, 30];

    // ---------------------------------------------------------------
    // GET /api/import/template
    // ---------------------------------------------------------------

    public function template()
    {
        $spreadsheet = new Spreadsheet();
        $spreadsheet->getProperties()
            ->setTitle('Plantilla Carga Masiva SerGestiona')
            ->setCreator('SerGestiona 2.0')
            ->setDescription('Plantilla oficial para carga masiva de entregables');

        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Entregables');

        // ── Row 1: instructions ──────────────────────────────────────
        $sheet->setCellValue('A1',
            'INSTRUCCIONES: Completa los datos desde la fila 4. ' .
            'Columnas en ROJO son obligatorias. ' .
            'Las fechas deben ir en formato YYYY-MM-DD o DD/MM/YYYY (ej: 2026-08-15 o 15/08/2026). ' .
            'Los correos deben corresponder a usuarios registrados en SerGestiona. ' .
            'Si no seleccionas una Escuela/Proyecto en la pantalla de Carga Masiva, la columna "Escuela / Proyecto" es obligatoria.'
        );
        $sheet->mergeCells('A1:T1');
        $sheet->getStyle('A1')->applyFromArray([
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFFFF3CD']],
            'font'      => ['bold' => false, 'size' => 9, 'color' => ['argb' => 'FF856404']],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
        ]);
        $sheet->getRowDimension(1)->setRowHeight(45);

        // ── Row 2: allowed values reference ─────────────────────────
        $notes = [
            'Tipo'           => 'Pregrado | Posgrado | Continuada | Curso | Externo',
            'Semestre'       => 'I | II | III | IV | NA',
            'Ciclo'          => '0 | 1 | 2 | 3 | 4 | NA',
            'Tipo Contenido' => 'Creacion | Actualizacion | Tarea | Otro',
        ];
        $notesText = implode('   ·   ', array_map(fn($k, $v) => "$k: $v", array_keys($notes), $notes));
        $sheet->setCellValue('A2', 'VALORES PERMITIDOS:  ' . $notesText);
        $sheet->mergeCells('A2:T2');
        $sheet->getStyle('A2')->applyFromArray([
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD1ECF1']],
            'font'      => ['bold' => false, 'size' => 8, 'color' => ['argb' => 'FF0C5460']],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_TOP],
        ]);
        $sheet->getRowDimension(2)->setRowHeight(30);

        // ── Row 3: headers ───────────────────────────────────────────
        $col = 1;
        foreach (self::HEADERS as $key => $label) {
            $isRequired = in_array($key, self::REQUIRED_COLS);
            $colLetter  = Coordinate::stringFromColumnIndex($col);
            $sheet->getCell($colLetter . '3')->setValue($isRequired ? "* $label" : $label);

            $sheet->getStyle($colLetter . '3')->applyFromArray([
                'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_HEADER_BG]],
                'font'      => ['bold' => true, 'size' => 9, 'color' => ['argb' => $isRequired ? 'FFFFCC00' : self::COLOR_HEADER_FG]],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true, 'vertical' => Alignment::VERTICAL_CENTER],
                'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF2C5282']]],
            ]);
            $col++;
        }
        $sheet->getRowDimension(3)->setRowHeight(32);

        // ── Row 4: example data ──────────────────────────────────────
        $example = [
            'Actualización Curricular 2026',
            'Pregrado',
            'Ingeniería de Sistemas',
            'Fundamentos de Programación',
            'Semana 1',
            'I',
            '1',
            'Creacion',
            '2026-07-01',
            '2026-07-07',
            '2026-07-14',
            '2026-07-21',
            '2026-07-28',
            '2026-08-04',
            '2026-08-11',
            'experto@universidad.edu.co',
            'pedagogia@universidad.edu.co',
            'disenio@universidad.edu.co',
            'audiovisual@universidad.edu.co',
            'ingenieria@universidad.edu.co',
            'calidad@universidad.edu.co',
        ];

        $col = 1;
        foreach ($example as $value) {
            $sheet->getCell(Coordinate::stringFromColumnIndex($col) . '4')->setValue($value);
            $col++;
        }
        $sheet->getStyle('A4:T4')->applyFromArray([
            'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => self::COLOR_EXAMPLE_BG]],
            'font'      => ['italic' => true, 'size' => 9, 'color' => ['argb' => 'FF4A6FA5']],
            'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FFCDD8E8']]],
        ]);
        $sheet->getRowDimension(4)->setRowHeight(18);

        // ── Column widths ────────────────────────────────────────────
        $col = 1;
        foreach (self::COLUMN_WIDTHS as $w) {
            $sheet->getColumnDimensionByColumn($col)->setWidth($w);
            $col++;
        }

        // Freeze header row
        $sheet->freezePane('A4');

        // ── Output ───────────────────────────────────────────────────
        $writer = new Xlsx($spreadsheet);
        ob_start();
        $writer->save('php://output');
        $content = ob_get_clean();

        return response($content, 200, [
            'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="plantilla_sergestiona.xlsx"',
            'Cache-Control'       => 'no-cache, no-store',
        ]);
    }

    // ---------------------------------------------------------------
    // POST /api/import/deliverables
    // ---------------------------------------------------------------

    public function deliverables(Request $request)
    {
        $request->validate([
            'file'         => 'required|file|max:2048',
            'project_id'   => 'nullable|integer|exists:projects,id',
            'project_name' => 'nullable|string|max:255',
        ]);

        $userId         = $request->user()->id;
        $validateOnly   = (bool) $request->query('validate_only', false);
        $updateExisting = $request->boolean('update_existing');

        // Resolve or create the DEFAULT project (used for rows that don't
        // bring their own "Escuela / Proyecto" column). Nullable: if the
        // file provides that column on every row, no default is needed.
        if ($request->filled('project_id')) {
            $defaultProjectId = (int) $request->input('project_id');
        } elseif ($request->filled('project_name')) {
            $project          = Project::firstOrCreate(
                ['name' => trim($request->input('project_name'))],
                ['created_by' => $userId, 'status' => 'in_progress']
            );
            $defaultProjectId = $project->id;
        } else {
            $defaultProjectId = null;
        }

        // Parse file
        $file      = $request->file('file');
        $extension = strtolower($file->getClientOriginalExtension() ?: pathinfo($file->getClientOriginalName(), PATHINFO_EXTENSION));

        [$rows, $parseError] = match (true) {
            in_array($extension, ['xlsx', 'xls', 'ods']) => $this->parseExcel($file),
            default                                       => $this->parseCsv($file),
        };

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

        // Pre-cache academic levels by normalized name (sin tildes, minúsculas) para la columna 'Tipo'
        $academicLevelsByName = AcademicLevel::active()->pluck('id', 'name')
            ->mapWithKeys(fn ($id, $name) => [$this->removeDiacritics($name) => $id])
            ->all();

        $valid   = 0;
        $updated = 0;
        $invalid = 0;
        $errors  = [];
        $preview = [];
        $rowNum  = 1;

        if (!$validateOnly) {
            DB::beginTransaction();
        }

        try {
            foreach ($rows as $row) {
                $rowNum++;
                $rowErrors = $this->validateRow($row, $rowNum, $usersByEmail, $defaultProjectId);

                if (!empty($rowErrors)) {
                    $errors  = array_merge($errors, $rowErrors);
                    $invalid++;
                    continue;
                }

                $valid++;

                if (count($preview) < 5) {
                    $preview[] = $this->previewRecord($row);
                }

                if (!$validateOnly) {
                    $rowUpdatedExisting = $this->persistRow($row, $defaultProjectId, $userId, $usersByEmail, $academicLevelsByName, $updateExisting);
                    if ($rowUpdatedExisting) {
                        $updated++;
                    }
                }
            }

            if (!$validateOnly) {
                if (empty($errors)) {
                    DB::commit();
                } else {
                    DB::rollBack();
                    $valid   = 0; // Si hay errores, nada se insertó
                    $updated = 0;
                }
            }
        } catch (\Throwable $e) {
            if (!$validateOnly) {
                DB::rollBack();
            }
            // No exponer el mensaje técnico de PHP a secas (p. ej. "Undefined
            // array key") — no le dice al usuario qué hacer. Se le da una
            // acción concreta y el detalle técnico queda disponible para
            // soporte, sin ser lo único que ve.
            return response()->json([
                'imported' => 0,
                'errors'   => [['row' => $rowNum, 'field' => 'general', 'message' =>
                    "No se pudo importar la fila {$rowNum} por un error inesperado. " .
                    'Verifica que el archivo use las mismas columnas de la plantilla oficial ' .
                    '(descárgala de nuevo si tienes dudas) y que los valores de cada celda tengan un formato válido. ' .
                    "Detalle técnico: {$e->getMessage()}"
                ]],
            ], 500);
        }

        if ($validateOnly) {
            return response()->json([
                'valid'      => $valid,
                'invalid'    => $invalid,
                'errors'     => $errors,
                'preview'    => $preview,
                'project_id' => $defaultProjectId,
            ]);
        }

        return response()->json([
            'imported'   => $valid,
            'updated'    => $updated,
            'errors'     => $errors,
            'project_id' => $defaultProjectId,
        ]);
    }

    // ---------------------------------------------------------------
    // Private: parsers
    // ---------------------------------------------------------------

    /**
     * Parse an Excel file (.xlsx / .xls / .ods).
     *
     * @return array{0: array<int, array<string, string>>, 1: string|null}
     */
    private function parseExcel(\Illuminate\Http\UploadedFile $file): array
    {
        try {
            $spreadsheet = IOFactory::load($file->getRealPath());
        } catch (\Throwable $e) {
            return [[], 'No se pudo leer el archivo Excel: ' . $e->getMessage()];
        }

        // Todo lo que sigue también va protegido: un archivo puede cargar
        // bien con IOFactory::load() y aun así hacer fallar la lectura de
        // encabezados/celdas más adelante (celdas fusionadas, formatos
        // numéricos raros, hojas corruptas mezcladas con datos válidos) —
        // sin este try/catch, eso se caía como un 500 crudo sin ningún
        // mensaje útil en vez del formato de error normal de este endpoint.
        try {
            $sheet    = $spreadsheet->getActiveSheet();
            $highRow  = $sheet->getHighestDataRow();
            $highCol  = $sheet->getHighestDataColumn();

            if ($highRow < 2) {
                return [[], 'El archivo no contiene filas de datos.'];
            }

            // Find the header row: look for a row that contains canonical keys or their Spanish labels.
            $headerRow = null;
            $colMap    = []; // colIndex (1-based) → canonical key

            $maxCol = Coordinate::columnIndexFromString($highCol);

            for ($r = 1; $r <= min($highRow, 5); $r++) {
                $candidates = [];
                for ($c = 1; $c <= $maxCol; $c++) {
                    $colLetter = Coordinate::stringFromColumnIndex($c);
                    $raw       = (string) $sheet->getCell($colLetter . $r)->getValue();
                    $norm      = $this->normalizeHeader($raw);
                    if ($norm !== null) {
                        $candidates[$c] = $norm;
                    }
                }
                // Accept this row if it contains at least 3 canonical header matches
                if (count($candidates) >= 3) {
                    $headerRow = $r;
                    $colMap    = $candidates;
                    break;
                }
            }

            if ($headerRow === null) {
                return [[], 'No se encontró la fila de encabezados. Asegúrate de usar la plantilla oficial o que la primera fila de datos contenga los nombres de columna.'];
            }

            // Parse data rows
            $rows = [];
            for ($r = $headerRow + 1; $r <= $highRow; $r++) {
                $row     = [];
                $hasData = false;
                foreach ($colMap as $colIdx => $key) {
                    $colLetter = Coordinate::stringFromColumnIndex($colIdx);
                    $cell      = $sheet->getCell($colLetter . $r);
                    $value     = $this->cellToString($cell);
                    $row[$key] = $value;
                    if ($value !== '') $hasData = true;
                }
                // Skip completely empty rows
                if ($hasData) {
                    $rows[] = $row;
                }
            }

            if (empty($rows)) {
                return [[], 'El archivo no contiene filas de datos (sólo encabezados).'];
            }

            return [$rows, null];
        } catch (\Throwable $e) {
            return [[], 'No se pudo procesar el contenido del archivo Excel: ' . $e->getMessage()];
        }
    }

    /**
     * Parse a CSV file (legacy / fallback).
     *
     * @return array{0: array<int, array<string, string>>, 1: string|null}
     */
    private function parseCsv(\Illuminate\Http\UploadedFile $file): array
    {
        $content = file_get_contents($file->getRealPath());

        // Detect and convert encoding
        $detected = mb_detect_encoding($content, ['UTF-8', 'ISO-8859-1', 'Windows-1252'], true);
        if ($detected && $detected !== 'UTF-8') {
            $content = mb_convert_encoding($content, 'UTF-8', $detected);
        }

        // Strip BOM
        $content = preg_replace('/^\xEF\xBB\xBF/', '', $content);
        $content = str_replace(["\r\n", "\r"], "\n", $content);
        $lines   = array_values(array_filter(explode("\n", $content), fn ($l) => trim($l) !== ''));

        if (count($lines) < 2) {
            return [[], 'El archivo no contiene filas de datos.'];
        }

        $rawHeaders = array_map(fn ($h) => $this->normalizeHeader($h) ?? mb_strtolower(trim($h)), str_getcsv(array_shift($lines)));

        $rows = [];
        foreach ($lines as $line) {
            $values = array_map('trim', str_getcsv($line));
            $row    = [];
            $hasData = false;
            foreach ($rawHeaders as $i => $header) {
                $value = $values[$i] ?? '';
                $row[$header] = $value;
                if ($value !== '') $hasData = true;
            }
            if ($hasData) {
                $rows[] = $row;
            }
        }

        return [$rows, null];
    }

    // ---------------------------------------------------------------
    // Private: row helpers
    // ---------------------------------------------------------------

    /**
     * Normalise a header cell value to a canonical key.
     * Handles both Spanish labels ("Tipo Contenido") and key names ("tipo_contenido").
     */
    private function normalizeHeader(string $raw): ?string
    {
        $raw = mb_strtolower(trim($raw));
        // Strip leading * (required marker from template)
        $raw = ltrim($raw, "* \t");
        // Remove diacritics for comparison
        $clean = $this->removeDiacritics($raw);

        // Direct key match
        if (in_array($raw, self::KEYS, true)) return $raw;

        // Map Spanish label → key
        $labelMap = [
            'escuela / proyecto'                => 'proyecto',
            'escuela/proyecto'                  => 'proyecto',
            'escuela proyecto'                  => 'proyecto',
            'proyecto'                          => 'proyecto',
            'tipo'                              => 'tipo',
            'programa'                          => 'programa',
            'asignatura'                        => 'asignatura',
            'semana / modulo'                   => 'semana_modulo',
            'semana/modulo'                     => 'semana_modulo',
            'semana modulo'                     => 'semana_modulo',
            'semana_modulo'                     => 'semana_modulo',
            'semestre'                          => 'semestre',
            'ciclo'                             => 'ciclo',
            'tipo contenido'                    => 'tipo_contenido',
            'tipo_contenido'                    => 'tipo_contenido',
            'fecha inicio'                      => 'fecha_inicio',
            'fecha_inicio'                      => 'fecha_inicio',
            'fecha entrega experto'             => 'fecha_entrega_experto',
            'fecha_entrega_experto'             => 'fecha_entrega_experto',
            'fecha entrega experto'             => 'fecha_entrega_experto',
            'fecha entrega pedagogia'           => 'fecha_entrega_pedagogia',
            'fecha entrega pedagogía'           => 'fecha_entrega_pedagogia',
            'fecha_entrega_pedagogia'           => 'fecha_entrega_pedagogia',
            'fecha entrega diseno'              => 'fecha_entrega_diseno',
            'fecha entrega diseño'              => 'fecha_entrega_diseno',
            'fecha_entrega_diseno'              => 'fecha_entrega_diseno',
            'fecha entrega audiovisual'         => 'fecha_entrega_audiovisual',
            'fecha_entrega_audiovisual'         => 'fecha_entrega_audiovisual',
            'fecha entrega ingeniero'           => 'fecha_entrega_ingeniero',
            'fecha_entrega_ingeniero'           => 'fecha_entrega_ingeniero',
            'fecha entrega calidad'             => 'fecha_entrega_calidad',
            'fecha_entrega_calidad'             => 'fecha_entrega_calidad',
            'correo responsable experto'        => 'correo_responsable_experto',
            'correo_responsable_experto'        => 'correo_responsable_experto',
            'correo responsable pedagogia'      => 'correo_responsable_pedagogia',
            'correo responsable pedagogía'      => 'correo_responsable_pedagogia',
            'correo_responsable_pedagogia'      => 'correo_responsable_pedagogia',
            'correo responsable diseno'         => 'correo_responsable_diseno',
            'correo responsable diseño'         => 'correo_responsable_diseno',
            'correo_responsable_diseno'         => 'correo_responsable_diseno',
            'correo responsable audiovisual'    => 'correo_responsable_audiovisual',
            'correo_responsable_audiovisual'    => 'correo_responsable_audiovisual',
            'correo responsable ingeniero'      => 'correo_responsable_ingeniero',
            'correo_responsable_ingeniero'      => 'correo_responsable_ingeniero',
            'correo responsable calidad'        => 'correo_responsable_calidad',
            'correo_responsable_calidad'        => 'correo_responsable_calidad',
        ];

        if (isset($labelMap[$raw])) return $labelMap[$raw];
        // Try without diacritics
        if (isset($labelMap[$clean])) return $labelMap[$clean];

        return null;
    }

    /** Remove diacritics from a string for fuzzy matching. */
    private function removeDiacritics(string $str): string
    {
        $map = ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ü'=>'u','ñ'=>'n',
                'Á'=>'a','É'=>'e','Í'=>'i','Ó'=>'o','Ú'=>'u','Ü'=>'u','Ñ'=>'n'];
        return strtr(mb_strtolower($str), $map);
    }

    /** Convert a spreadsheet cell to a clean UTF-8 string. */
    private function cellToString(\PhpOffice\PhpSpreadsheet\Cell\Cell $cell): string
    {
        // Date cells: convert serial number to Y-m-d string
        if (\PhpOffice\PhpSpreadsheet\Shared\Date::isDateTime($cell)) {
            $ts = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToTimestamp($cell->getValue());
            return date('Y-m-d', $ts);
        }
        // For all other types, use getValue() which returns raw UTF-8 strings
        // (getFormattedValue() can corrupt multibyte characters in some builds)
        $val = $cell->getValue();
        if ($val === null) return '';
        return trim((string) $val);
    }

    /** Validate a single row. Returns array of error objects (may be empty). */
    private function validateRow(array $row, int $rowNum, array $usersByEmail, ?int $defaultProjectId = null): array
    {
        $errors = [];

        foreach (self::REQUIRED_COLS as $col) {
            if (empty($row[$col] ?? '')) {
                $errors[] = ['row' => $rowNum, 'field' => $col, 'message' => "El campo '{$col}' es obligatorio."];
            }
        }

        if (empty($row['proyecto'] ?? '') && $defaultProjectId === null) {
            $errors[] = ['row' => $rowNum, 'field' => 'proyecto', 'message' => "El campo 'proyecto' es obligatorio (o selecciona una Escuela/Proyecto en la pantalla)."];
        }

        $dateCols = array_merge(['fecha_inicio'], array_values(self::COMMITMENT_COLS));
        foreach ($dateCols as $col) {
            $val = $row[$col] ?? '';
            if (!empty($val) && $this->parseDate($val) === null) {
                $errors[] = ['row' => $rowNum, 'field' => $col, 'message' => "Fecha inválida en '{$col}'. Use YYYY-MM-DD o DD/MM/YYYY (ej: 2026-08-15)."];
            }
        }

        foreach (self::RESPONSIBLE_COLS as $col => $_role) {
            $email = mb_strtolower(trim($row[$col] ?? ''));
            if (!empty($email) && !isset($usersByEmail[$email])) {
                $errors[] = ['row' => $rowNum, 'field' => $col, 'message' => "El usuario con correo '{$email}' no existe en el sistema."];
            }
        }

        return $errors;
    }

    /** Persist a validated row inside an existing DB transaction. */
    private function persistRow(array $row, ?int $defaultProjectId, int $userId, array $usersByEmail, array $academicLevelsByName = [], bool $updateExisting = false): bool
    {
        $projectId = !empty($row['proyecto'])
            ? $this->firstOrCreateByName(Project::class, $row['proyecto'], [], ['status' => 'in_progress', 'created_by' => $userId])->id
            : $defaultProjectId;

        $program = $this->firstOrCreateByName(
            AcademicProgram::class, $row['programa'], ['project_id' => $projectId], ['created_by' => $userId]
        );

        $subject = $this->firstOrCreateByName(
            Subject::class, $row['asignatura'], ['academic_program_id' => $program->id], ['created_by' => $userId]
        );

        $tipoContenidoKey = mb_strtolower(trim($row['tipo_contenido'] ?? ''));
        $mappedType       = self::TIPO_CONTENIDO_MAP[$this->removeDiacritics($tipoContenidoKey)] ?? 'creation';
        $recordType       = !empty($row['tipo']) ? trim($row['tipo']) : null;
        $academicLevelId  = $recordType !== null
            ? ($academicLevelsByName[$this->removeDiacritics($recordType)] ?? null)
            : null;

        $deliverable = $this->firstOrCreateByName(
            Deliverable::class,
            $row['semana_modulo'],
            ['subject_id' => $subject->id],
            [
                'type'              => $mappedType,
                'record_type'       => $recordType,
                'academic_level_id' => $academicLevelId,
                'content_type'      => $row['tipo_contenido'] ?: null,
                'global_status'     => 'unpublished',
                'semestre'          => !empty($row['semestre']) ? $row['semestre'] : null,
                'ciclo'             => !empty($row['ciclo']) ? $row['ciclo'] : null,
                'start_date'        => !empty($row['fecha_inicio']) ? $this->parseDate($row['fecha_inicio']) : null,
                'created_by'        => $userId,
            ]
        );

        $rowUpdatedExisting = false;

        foreach (self::COMMITMENT_COLS as $role => $dateCol) {
            $commitmentDate = !empty($row[$dateCol]) ? $this->parseDate($row[$dateCol]) : null;

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

            $justAssigned    = false;
            $dateJustChanged = false;
            if (!$activity->wasRecentlyCreated) {
                $updates = [];
                $currentCommitmentDate = optional($activity->commitment_date)->format('Y-m-d');

                if ($commitmentDate !== null && $currentCommitmentDate === null) {
                    // Rellenar una fecha vacía: comportamiento de siempre, en
                    // ambos modos (no es "sobrescribir", no notifica cambio).
                    $updates['commitment_date'] = $commitmentDate;
                } elseif (
                    $updateExisting && $commitmentDate !== null && $commitmentDate !== $currentCommitmentDate
                    && $activity->actual_delivery_date === null
                ) {
                    // Sobrescribir una fecha ya asignada: solo con el flag
                    // activo, y nunca si ya se entregó (protege las métricas
                    // de puntualidad de HealthService, que comparan
                    // actual_delivery_date vs commitment_date en vivo).
                    $updates['commitment_date'] = $commitmentDate;
                    $dateJustChanged = true;
                }

                if ($responsibleId !== null && $activity->responsible_id === null) {
                    $updates['responsible_id'] = $responsibleId;
                    $justAssigned = true;
                } elseif ($updateExisting && $responsibleId !== null && $responsibleId !== $activity->responsible_id) {
                    $updates['responsible_id'] = $responsibleId;
                    $justAssigned = true;
                }

                if (!empty($updates)) {
                    $activity->update($updates);
                    if ($dateJustChanged || isset($updates['responsible_id'])) {
                        $rowUpdatedExisting = true;
                    }
                }
            }

            // Notificar al responsable (asignación nueva o reasignación),
            // igual que en la creación manual desde el formulario
            // (DeliverableController::store()) y en
            // RoleActivityController::update() líneas 353-359.
            if ($responsibleId && ($activity->wasRecentlyCreated || $justAssigned)) {
                $responsibleUser = User::find($responsibleId);
                if ($responsibleUser) {
                    \App\Services\NotificationService::notifyTaskAssigned($activity, $responsibleUser);
                }
            }

            // Notificar cambio de fecha solo cuando se sobrescribió un valor
            // ya existente (no al asignarla por primera vez) — igual que
            // RoleActivityController::update() líneas 403-415.
            if ($dateJustChanged && $activity->responsible_id) {
                $responsibleUser = User::find($activity->responsible_id);
                if ($responsibleUser) {
                    \App\Services\NotificationService::notify(
                        $responsibleUser,
                        'date_changed',
                        'Fecha de compromiso actualizada',
                        "La fecha límite de tu actividad '{$activity->role}' en '{$deliverable->name}' fue actualizada a {$activity->commitment_date->format('Y-m-d')}.",
                        ['entity_type' => 'RoleActivity', 'entity_id' => $activity->id, 'deliverable_id' => $activity->deliverable_id]
                    );
                }
            }
        }

        RoleActivityController::recalculateGlobalStatus($deliverable);

        return $rowUpdatedExisting;
    }

    /**
     * Como firstOrCreate(), pero comparando 'name' sin distinguir mayúsculas
     * ni espacios al inicio/final. Los valores de Proyecto/Programa/
     * Asignatura/Entregable en Carga Masiva vienen de celdas de Excel
     * digitadas a mano — sin esto, "Módulo 2" y "módulo 2 " (una fila más
     * abajo, o en otra carga) se tratan como cosas distintas y crean una
     * fila duplicada en paralelo con el nombre visualmente idéntico.
     *
     * @param class-string<\Illuminate\Database\Eloquent\Model> $modelClass
     */
    private function firstOrCreateByName(string $modelClass, string $rawName, array $scopeAttrs, array $createAttrs = [])
    {
        $name = trim($rawName);

        $existing = $modelClass::where($scopeAttrs)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])
            ->first();

        return $existing ?? $modelClass::create([...$scopeAttrs, 'name' => $name, ...$createAttrs]);
    }

    /** Build a lightweight preview record (no DB writes). */
    private function previewRecord(array $row): array
    {
        return [
            'proyecto'       => $row['proyecto']               ?? '',
            'programa'       => $row['programa']               ?? '',
            'asignatura'     => $row['asignatura']             ?? '',
            'semana_modulo'  => $row['semana_modulo']          ?? '',
            'tipo_contenido' => $row['tipo_contenido']         ?? '',
            'semestre'       => $row['semestre']               ?? '',
            'ciclo'          => $row['ciclo']                  ?? '',
            'fecha_inicio'   => $row['fecha_inicio']           ?? '',
            'fecha_experto'  => $row['fecha_entrega_experto']  ?? '',
        ];
    }

    /** Parse a date string in several common formats. Returns 'Y-m-d' or null. */
    private function parseDate(string $value): ?string
    {
        $value = trim($value);
        if ($value === '') return null;

        foreach (['d/m/Y', 'd-m-Y', 'Y-m-d', 'Y/m/d'] as $format) {
            $date = \DateTime::createFromFormat($format, $value);
            if ($date === false) continue;

            // createFromFormat "rueda" los valores fuera de rango en vez de
            // fallar (32/13/2026 se vuelve silenciosamente 2027-02-01) —
            // getLastErrors() es la única forma de detectarlo. En PHP 8.2+
            // devuelve `false` (no un array) cuando no hubo problemas.
            $errors = \DateTime::getLastErrors();
            $hasProblems = $errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0);
            if (!$hasProblems) {
                return $date->format('Y-m-d');
            }
        }

        $timestamp = strtotime($value);
        return $timestamp !== false ? date('Y-m-d', $timestamp) : null;
    }
}
