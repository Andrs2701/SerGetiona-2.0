<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Deliverable;
use App\Models\Project;
use Illuminate\Http\Request;

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
     * GET /api/export/deliverables?project_id=X&format=csv
     */
    public function deliverables(Request $request)
    {
        $query = Deliverable::with([
            'subject.academicProgram.project',
            'roleActivities.responsible',
        ]);

        if ($request->filled('project_id')) {
            $query->whereHas('subject.academicProgram', function ($q) use ($request) {
                $q->where('project_id', $request->project_id);
            });
        }

        $deliverables = $query->get();

        $date     = now()->format('Y-m-d');
        $filename = "entregables_{$date}.csv";

        return response()->streamDownload(function () use ($deliverables) {
            $output = fopen('php://output', 'w');

            // Cabecera BOM para Excel (UTF-8)
            fputs($output, "\xEF\xBB\xBF");

            // Encabezados
            $headers = [
                'Proyecto', 'Programa', 'Asignatura', 'Entregable', 'Tipo', 'Estado Global',
                'Experto', 'Fecha Experto', 'Estado Experto',
                'Pedagogía', 'Fecha Pedagogía', 'Estado Pedagogía',
                'Diseño', 'Fecha Diseño', 'Estado Diseño',
                'Audiovisual', 'Fecha Audiovisual', 'Estado Audiovisual',
                'Ingeniería', 'Fecha Ingeniería', 'Estado Ingeniería',
                'Calidad', 'Fecha Calidad', 'Estado Calidad',
                '% Cumplimiento',
            ];
            fputcsv($output, $headers);

            foreach ($deliverables as $deliverable) {
                $subject  = $deliverable->subject;
                $program  = $subject?->academicProgram;
                $project  = $program?->project;

                $activities = $deliverable->roleActivities->keyBy('role');

                // Calcular % cumplimiento: roles con status = 'approved'
                $completedRoles = 0;
                $totalRoles     = count(self::ROLES);
                foreach (array_keys(self::ROLES) as $role) {
                    $act = $activities[$role] ?? null;
                    if ($act && in_array($act->status, ['approved', 'delivered'])) {
                        $completedRoles++;
                    }
                }
                $compliance = $totalRoles > 0 ? round(($completedRoles / $totalRoles) * 100, 1) : 0;

                $row = [
                    $project?->name       ?? '',
                    $program?->name       ?? '',
                    $subject?->name       ?? '',
                    $deliverable->name,
                    $deliverable->type    ?? '',
                    $this->translateGlobalStatus($deliverable->global_status ?? ''),
                ];

                foreach (array_keys(self::ROLES) as $role) {
                    $act = $activities[$role] ?? null;
                    $row[] = $act?->responsible?->name ?? '';
                    $row[] = $act?->commitment_date?->format('d/m/Y') ?? '';
                    $row[] = RoleActivityController::translateStatus($act?->status ?? 'not_started');
                }

                $row[] = $compliance . '%';

                fputcsv($output, $row);
            }

            fclose($output);
        }, $filename, [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
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
                $totalRoles        = $totalDeliverables * count(self::ROLES);
                $completedRoles    = 0;

                foreach ($deliverablesList as $d) {
                    foreach ($d->roleActivities as $act) {
                        if (in_array($act->status, ['approved', 'delivered'])) {
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
