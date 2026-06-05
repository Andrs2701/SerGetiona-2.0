<?php

namespace Database\Seeders;

use App\Models\AcademicProgram;
use App\Models\AuditLog;
use App\Models\Comment;
use App\Models\Deliverable;
use App\Models\FlowTemplate;
use App\Models\Notification;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    // Cadena de roles
    private const ROLE_CHAIN = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];

    // Fechas base hoy: 2026-06-04
    public function run(): void
    {
        // ── Usuarios ──────────────────────────────────────────────────────────
        $admin = User::create([
            'name'      => 'Administrador',
            'email'     => 'admin@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'admin',
            'is_active' => true,
        ]);

        $coordinator = User::create([
            'name'      => 'Coordinador General',
            'email'     => 'coordinador@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'coordinator',
            'is_active' => true,
        ]);

        $expert = User::create([
            'name'      => 'Carlos Ramírez',
            'email'     => 'experto1@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'expert',
            'is_active' => true,
            'phone'     => '3001234567',
        ]);

        $pedagogy = User::create([
            'name'      => 'Ana Torres',
            'email'     => 'pedagogia@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'pedagogy',
            'is_active' => true,
        ]);

        $design = User::create([
            'name'      => 'Luis Gómez',
            'email'     => 'disenio@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'design',
            'is_active' => true,
        ]);

        $audiovisual = User::create([
            'name'      => 'Sara Mejía',
            'email'     => 'audiovisual@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'audiovisual',
            'is_active' => true,
        ]);

        $engineering = User::create([
            'name'      => 'Pedro Vargas',
            'email'     => 'ingenieria@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'engineering',
            'is_active' => true,
        ]);

        $qa = User::create([
            'name'      => 'María López',
            'email'     => 'calidad@sergestiona.co',
            'password'  => Hash::make('password'),
            'role'      => 'qa',
            'is_active' => true,
        ]);

        // ── Flow Template ──────────────────────────────────────────────────────
        FlowTemplate::create([
            'name'       => 'Estándar',
            'is_default' => true,
            'offsets'    => [
                'expert'      => 0,
                'pedagogy'    => 2,
                'design'      => 2,
                'audiovisual' => 2,
                'engineering' => 1,
                'qa'          => 1,
            ],
        ]);

        $responsibles = [
            'expert'      => $expert,
            'pedagogy'    => $pedagogy,
            'design'      => $design,
            'audiovisual' => $audiovisual,
            'engineering' => $engineering,
            'qa'          => $qa,
        ];

        // ── Proyecto 1: Actualización Curricular 2026 ─────────────────────────
        $project1 = Project::create([
            'name'           => 'Actualización Curricular 2026',
            'description'    => 'Actualización de contenidos y materiales para el año lectivo 2026.',
            'status'         => 'in_progress',
            'responsible_id' => $coordinator->id,
            'start_date'     => '2026-01-15',
            'end_date'       => '2026-12-31',
            'created_by'     => $admin->id,
        ]);

        $programs1 = [
            [
                'name'        => 'Especialización en Bienestar Psicosocial',
                'code'        => 'ESP-BPS-2026',
                'description' => 'Programa de especialización enfocado en el bienestar y la salud mental comunitaria.',
                'subjects'    => [
                    ['name' => 'Fundamentos del Bienestar',   'code' => 'FDB-101', 'credits' => 3],
                    ['name' => 'Intervención Psicosocial',    'code' => 'IPS-201', 'credits' => 4],
                    ['name' => 'Metodologías Comunitarias',   'code' => 'MTC-301', 'credits' => 3],
                ],
            ],
            [
                'name'        => 'Maestría en Atención Comunitaria',
                'code'        => 'MAT-COM-2026',
                'description' => 'Posgrado orientado a la gestión y atención en entornos comunitarios.',
                'subjects'    => [
                    ['name' => 'Teorías de la Atención Comunitaria', 'code' => 'TAC-101', 'credits' => 4],
                    ['name' => 'Gestión de Proyectos Sociales',      'code' => 'GPS-201', 'credits' => 3],
                    ['name' => 'Investigación Aplicada',             'code' => 'INV-301', 'credits' => 4],
                    ['name' => 'Ética y Derechos Humanos',           'code' => 'EDH-401', 'credits' => 2],
                ],
            ],
        ];

        $deliverableNames = ['Semana 0', 'Semana 1', 'Semana 2', 'Módulo 1', 'Módulo 2'];

        /**
         * Configuraciones de actividades por entregable.
         * Cada entry: [expert, pedagogy, design, audiovisual, engineering, qa, global_status]
         *
         * LEYENDA DE ESCENARIOS:
         * 0 → Totalmente aprobado (fechas pasadas abril-mayo)
         * 1 → Activo: experto entregado, pedagogía en revisión, diseño en desarrollo, resto no iniciado
         * 2 → Temprano: experto en desarrollo (vencido), pedagogy no iniciado, resto no iniciado
         * 3 → Ajustes devueltos al experto, pedagogy ajustando
         * 4 → Pendientes futuros: todos not_started, fechas julio
         */
        $activityConfigs = [
            // Escenario 0: ~30% approved — todo completado (fechas abril-mayo)
            ['approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'finished'],

            // Escenario 1: ~20% in_progress — experto entregó, pedagogía en revisión
            ['delivered', 'in_review', 'not_started', 'not_started', 'not_started', 'not_started', 'in_progress'],

            // Escenario 2: ~20% in_development — experto activo (algunos vencidos)
            ['in_development', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'in_progress'],

            // Escenario 3: ~15% adjustments_requested — devuelto al experto
            ['adjustments_requested', 'in_review', 'not_started', 'not_started', 'not_started', 'not_started', 'with_observations'],

            // Escenario 4: ~15% not_started — futuros
            ['not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'not_started', 'pending_start'],
        ];

        $deliverableIdx = 0;
        foreach ($programs1 as $progData) {
            $program = AcademicProgram::create([
                'project_id'  => $project1->id,
                'name'        => $progData['name'],
                'code'        => $progData['code'],
                'description' => $progData['description'],
                'created_by'  => $admin->id,
            ]);

            foreach ($progData['subjects'] as $subjData) {
                $subject = Subject::create([
                    'academic_program_id' => $program->id,
                    'name'                => $subjData['name'],
                    'code'                => $subjData['code'],
                    'credits'             => $subjData['credits'],
                    'created_by'          => $coordinator->id,
                ]);

                foreach ($deliverableNames as $idx => $dName) {
                    $scenario     = $idx % count($activityConfigs);
                    $config       = $activityConfigs[$scenario];
                    $globalStatus = $config[6];

                    $deliverable = Deliverable::create([
                        'subject_id'    => $subject->id,
                        'name'          => $dName,
                        'type'          => 'creation',
                        'global_status' => $globalStatus,
                        'start_date'    => '2026-02-01',
                        'notes'         => 'Entregable planificado para producción académica.',
                        'created_by'    => $coordinator->id,
                    ]);

                    $roles    = self::ROLE_CHAIN;
                    $statuses = array_slice($config, 0, 6);

                    foreach ($roles as $ri => $role) {
                        $status = $statuses[$ri];

                        // Determinar fechas según escenario
                        [$commitmentDate, $actualStart, $actualDelivery] =
                            $this->resolveDates($scenario, $ri, $status);

                        RoleActivity::create([
                            'deliverable_id'       => $deliverable->id,
                            'role'                 => $role,
                            'responsible_id'       => $responsibles[$role]->id,
                            'assigned_by'          => $coordinator->id,
                            'assigned_at'          => '2026-01-20 09:00:00',
                            'commitment_date'       => $commitmentDate,
                            'actual_start_date'    => $actualStart,
                            'actual_delivery_date' => $actualDelivery,
                            'status'               => $status,
                            'notes'                => $this->resolveNote($status),
                        ]);
                    }

                    // Comentario en el primer entregable
                    if ($deliverableIdx === 0) {
                        $comment = Comment::create([
                            'deliverable_id' => $deliverable->id,
                            'user_id'        => $coordinator->id,
                            'parent_id'      => null,
                            'content'        => 'Este entregable requiere especial atención en la semana de inicio.',
                            'created_at'     => now(),
                        ]);

                        Comment::create([
                            'deliverable_id' => $deliverable->id,
                            'user_id'        => $expert->id,
                            'parent_id'      => $comment->id,
                            'content'        => 'Entendido, estamos coordinando con el equipo de diseño.',
                            'created_at'     => now(),
                        ]);
                    }

                    $deliverableIdx++;
                }
            }
        }

        // ── Audit logs de ejemplo ─────────────────────────────────────────────
        AuditLog::create([
            'user_id'       => $admin->id,
            'action'        => 'updated',
            'entity_type'   => 'Project',
            'entity_id'     => $project1->id,
            'field_changed' => 'status',
            'old_value'     => 'parameterized',
            'new_value'     => 'in_progress',
            'ip_address'    => '127.0.0.1',
            'created_at'    => now(),
        ]);

        AuditLog::create([
            'user_id'       => $coordinator->id,
            'action'        => 'updated',
            'entity_type'   => 'Project',
            'entity_id'     => $project1->id,
            'field_changed' => 'responsible_id',
            'old_value'     => null,
            'new_value'     => (string) $coordinator->id,
            'ip_address'    => '127.0.0.1',
            'created_at'    => now(),
        ]);

        // ── Proyecto 2: Creación Especialización Psicosocial ──────────────────
        $project2 = Project::create([
            'name'           => 'Creación Especialización Psicosocial',
            'description'    => 'Nuevo programa de especialización en psicología social aplicada.',
            'status'         => 'parameterized',
            'responsible_id' => $coordinator->id,
            'start_date'     => '2026-06-15',
            'end_date'       => '2026-11-30',
            'created_by'     => $admin->id,
        ]);

        $program2 = AcademicProgram::create([
            'project_id'  => $project2->id,
            'name'        => 'Especialización en Psicología Social',
            'code'        => 'ESP-PS-2026',
            'description' => 'Formación avanzada en psicología social y comunitaria.',
            'created_by'  => $admin->id,
        ]);

        foreach ([
            ['name' => 'Psicología del Desarrollo', 'code' => 'PSD-101', 'credits' => 3],
            ['name' => 'Psicopatología Social',     'code' => 'PSP-201', 'credits' => 4],
        ] as $subjData) {
            $subject = Subject::create([
                'academic_program_id' => $program2->id,
                'name'                => $subjData['name'],
                'code'                => $subjData['code'],
                'credits'             => $subjData['credits'],
                'created_by'          => $coordinator->id,
            ]);

            foreach (['Semana 0', 'Semana 1', 'Semana 2'] as $dIdx => $dName) {
                $deliverable = Deliverable::create([
                    'subject_id'    => $subject->id,
                    'name'          => $dName,
                    'type'          => 'creation',
                    'global_status' => 'pending_start',
                    'start_date'    => '2026-07-01',
                    'created_by'    => $coordinator->id,
                ]);

                foreach (self::ROLE_CHAIN as $ri => $role) {
                    // Fechas futuras: julio-agosto 2026
                    $baseDate = Carbon::parse('2026-07-01')->addWeeks($ri + $dIdx);
                    RoleActivity::create([
                        'deliverable_id'       => $deliverable->id,
                        'role'                 => $role,
                        'responsible_id'       => $responsibles[$role]->id,
                        'assigned_by'          => $coordinator->id,
                        'assigned_at'          => '2026-06-10 09:00:00',
                        'commitment_date'       => $baseDate->toDateString(),
                        'actual_start_date'    => null,
                        'actual_delivery_date' => null,
                        'status'               => 'not_started',
                    ]);
                }
            }
        }

        // ── Proyecto 3: Control de Cambios Q2 2026 ───────────────────────────
        $project3 = Project::create([
            'name'           => 'Control de Cambios Q2 2026',
            'description'    => 'Gestión de actualizaciones menores y correcciones del segundo trimestre.',
            'status'         => 'in_progress',
            'responsible_id' => $coordinator->id,
            'start_date'     => '2026-04-01',
            'end_date'       => '2026-06-30',
            'created_by'     => $admin->id,
        ]);

        $program3 = AcademicProgram::create([
            'project_id'  => $project3->id,
            'name'        => 'Correcciones Generales Q2',
            'code'        => 'CQ2-2026',
            'description' => 'Programa de correcciones y mejoras del segundo trimestre.',
            'created_by'  => $admin->id,
        ]);

        foreach ([
            ['name' => 'Revisión de Contenidos',   'code' => 'RC-101', 'credits' => null],
            ['name' => 'Actualización de Recursos', 'code' => 'AR-201', 'credits' => null],
        ] as $subjData) {
            $subject = Subject::create([
                'academic_program_id' => $program3->id,
                'name'                => $subjData['name'],
                'code'                => $subjData['code'],
                'credits'             => $subjData['credits'],
                'created_by'          => $coordinator->id,
            ]);

            foreach (['Corrección 1', 'Corrección 2'] as $dName) {
                $deliverable = Deliverable::create([
                    'subject_id'    => $subject->id,
                    'name'          => $dName,
                    'type'          => 'update',
                    'global_status' => 'finished',
                    'start_date'    => '2026-04-10',
                    'notes'         => 'Cambio menor aprobado.',
                    'created_by'    => $coordinator->id,
                ]);

                // Todos aprobados (abril-mayo pasados)
                foreach (self::ROLE_CHAIN as $ri => $role) {
                    $baseDate = Carbon::parse('2026-04-10')->addDays($ri * 4);
                    RoleActivity::create([
                        'deliverable_id'       => $deliverable->id,
                        'role'                 => $role,
                        'responsible_id'       => $responsibles[$role]->id,
                        'assigned_by'          => $admin->id,
                        'assigned_at'          => '2026-04-05 09:00:00',
                        'commitment_date'       => $baseDate->toDateString(),
                        'actual_start_date'    => $baseDate->copy()->subDays(2)->toDateString(),
                        'actual_delivery_date' => $baseDate->toDateString(),
                        'status'               => 'approved',
                        'notes'                => 'Aprobado sin observaciones.',
                    ]);
                }
            }
        }

        // ── Notificaciones de ejemplo ─────────────────────────────────────────
        $notifData = [
            [
                'user_id' => $admin->id,
                'type'    => 'status_changed',
                'title'   => 'Estado de actividad cambiado',
                'message' => "La actividad 'expert' cambió de estado a 'in_review'.",
                'data'    => ['entity_type' => 'RoleActivity', 'entity_id' => 1],
            ],
            [
                'user_id' => $admin->id,
                'type'    => 'overdue',
                'title'   => 'Actividad vencida',
                'message' => 'Tienes actividades con fecha de compromiso vencida.',
                'data'    => [],
                'read_at' => now(),
            ],
            [
                'user_id' => $admin->id,
                'type'    => 'comment_added',
                'title'   => 'Nuevo comentario',
                'message' => 'Se agregó un comentario en el entregable Semana 0.',
                'data'    => ['entity_type' => 'Deliverable', 'entity_id' => 1],
            ],
            [
                'user_id' => $coordinator->id,
                'type'    => 'task_assigned',
                'title'   => 'Nueva actividad asignada',
                'message' => "Se te ha asignado la actividad de rol 'pedagogy'.",
                'data'    => ['entity_type' => 'RoleActivity', 'entity_id' => 2],
            ],
            [
                'user_id' => $coordinator->id,
                'type'    => 'date_changed',
                'title'   => 'Fecha de compromiso actualizada',
                'message' => "La fecha de compromiso de tu actividad 'pedagogy' fue actualizada.",
                'data'    => ['entity_type' => 'RoleActivity', 'entity_id' => 2],
            ],
            [
                'user_id' => $expert->id,
                'type'    => 'adjustments_requested',
                'title'   => 'Ajustes solicitados',
                'message' => 'Se han solicitado ajustes en uno de tus entregables.',
                'data'    => ['entity_type' => 'RoleActivity', 'entity_id' => 4],
            ],
        ];

        foreach ($notifData as $n) {
            Notification::create(array_merge([
                'read_at'    => null,
                'created_at' => now(),
            ], $n));
        }

        $this->command->info('DatabaseSeeder completado con ' . count($notifData) . ' notificaciones de ejemplo.');
    }

    /**
     * Retorna [commitment_date, actual_start_date, actual_delivery_date] según escenario.
     *
     * Escenarios:
     *  0 → todo aprobado: fechas abril-mayo 2026 (pasadas)
     *  1 → experto entregado, pedagogía en revisión, resto no iniciado
     *  2 → experto en_development (vencido: compromiso 28 mayo), resto no iniciado
     *  3 → adjustments_requested al experto, pedagogía in_review, resto no iniciado
     *  4 → todos not_started: fechas futuras julio-agosto 2026
     */
    private function resolveDates(int $scenario, int $roleIndex, string $status): array
    {
        $today = Carbon::parse('2026-06-04');

        switch ($scenario) {
            case 0:
                // Totalmente aprobado: fechas escalonadas abril-mayo
                $base = Carbon::parse('2026-04-01')->addDays($roleIndex * 7);
                return [
                    $base->toDateString(),
                    $base->copy()->subDays(5)->toDateString(),
                    $base->copy()->subDays(1)->toDateString(),
                ];

            case 1:
                // Experto (ri=0) entregó 2/6, pedagogía (ri=1) en revisión hasta 10/6
                // Diseño en adelante: no iniciados con fechas progresivas
                if ($roleIndex === 0) {
                    // expert: committed 30/5, entregó 2/6
                    return ['2026-05-30', '2026-05-26', '2026-06-02'];
                } elseif ($roleIndex === 1) {
                    // pedagogy: committed 10/6 (por vencer), en revisión
                    return ['2026-06-10', null, null];
                } else {
                    // Resto: compromisos progresivos junio-julio
                    $base = $today->copy()->addWeeks($roleIndex - 1);
                    return [$base->toDateString(), null, null];
                }

            case 2:
                // Experto en desarrollo (vencido): committed 28/5, sin entregar
                if ($roleIndex === 0) {
                    return ['2026-05-28', '2026-05-20', null]; // overdue implícito
                } else {
                    $base = $today->copy()->addWeeks($roleIndex);
                    return [$base->toDateString(), null, null];
                }

            case 3:
                // Ajustes devueltos: experto committed 5/6 (por vencer), pedagogy committed 12/6
                if ($roleIndex === 0) {
                    return ['2026-06-05', '2026-05-15', null];
                } elseif ($roleIndex === 1) {
                    return ['2026-06-12', null, null];
                } else {
                    $base = $today->copy()->addWeeks($roleIndex);
                    return [$base->toDateString(), null, null];
                }

            case 4:
            default:
                // Todos pendientes: fechas futuras junio 20 - agosto 2026
                $base = Carbon::parse('2026-06-20')->addWeeks($roleIndex * 2);
                return [$base->toDateString(), null, null];
        }
    }

    private function resolveNote(string $status): ?string
    {
        return match ($status) {
            'approved'               => 'Entregado y aprobado.',
            'adjustments_requested'  => 'Se solicitan ajustes antes de continuar.',
            'in_review'              => 'En revisión por el equipo.',
            'delivered'              => 'Entregado, pendiente revisión.',
            'with_findings'          => 'Con hallazgos pendientes de corrección.',
            default                  => null,
        };
    }
}
