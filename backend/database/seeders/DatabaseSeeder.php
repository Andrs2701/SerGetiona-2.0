<?php

namespace Database\Seeders;

use App\Models\AcademicProgram;
use App\Models\AuditLog;
use App\Models\Comment;
use App\Models\Deliverable;
use App\Models\FlowTemplate;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // ── Usuarios ──────────────────────────────────────────────────────────
        $admin = User::create([
            'name' => 'Administrador',
            'email' => 'admin@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'admin',
            'is_active' => true,
        ]);

        $coordinator = User::create([
            'name' => 'Coordinador General',
            'email' => 'coordinador@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'coordinator',
            'is_active' => true,
        ]);

        $expert = User::create([
            'name' => 'Carlos Ramírez',
            'email' => 'experto1@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'expert',
            'is_active' => true,
            'phone' => '3001234567',
        ]);

        $pedagogy = User::create([
            'name' => 'Ana Torres',
            'email' => 'pedagogia@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'pedagogy',
            'is_active' => true,
        ]);

        $design = User::create([
            'name' => 'Luis Gómez',
            'email' => 'disenio@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'design',
            'is_active' => true,
        ]);

        $audiovisual = User::create([
            'name' => 'Sara Mejía',
            'email' => 'audiovisual@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'audiovisual',
            'is_active' => true,
        ]);

        $engineering = User::create([
            'name' => 'Pedro Vargas',
            'email' => 'ingenieria@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'engineering',
            'is_active' => true,
        ]);

        $qa = User::create([
            'name' => 'María López',
            'email' => 'calidad@sergestiona.co',
            'password' => Hash::make('password'),
            'role' => 'qa',
            'is_active' => true,
        ]);

        // ── Flow Template ──────────────────────────────────────────────────────
        FlowTemplate::create([
            'name' => 'Estándar',
            'is_default' => true,
            'offsets' => [
                'expert' => 0,
                'pedagogy' => 2,
                'design' => 2,
                'audiovisual' => 2,
                'engineering' => 1,
                'qa' => 1,
            ],
        ]);

        // ── Proyecto 1: Actualización Curricular 2026 ─────────────────────────
        $project1 = Project::create([
            'name' => 'Actualización Curricular 2026',
            'description' => 'Actualización de contenidos y materiales para el año lectivo 2026.',
            'status' => 'in_progress',
            'responsible_id' => $coordinator->id,
            'start_date' => '2026-01-15',
            'end_date' => '2026-12-31',
            'created_by' => $admin->id,
        ]);

        $responsibles = [
            'expert' => $expert,
            'pedagogy' => $pedagogy,
            'design' => $design,
            'audiovisual' => $audiovisual,
            'engineering' => $engineering,
            'qa' => $qa,
        ];

        $programs1 = [
            [
                'name' => 'Especialización en Bienestar Psicosocial',
                'code' => 'ESP-BPS-2026',
                'description' => 'Programa de especialización enfocado en el bienestar y la salud mental comunitaria.',
                'subjects' => [
                    ['name' => 'Fundamentos del Bienestar', 'code' => 'FDB-101', 'credits' => 3],
                    ['name' => 'Intervención Psicosocial', 'code' => 'IPS-201', 'credits' => 4],
                    ['name' => 'Metodologías Comunitarias', 'code' => 'MTC-301', 'credits' => 3],
                ],
            ],
            [
                'name' => 'Maestría en Atención Comunitaria',
                'code' => 'MAT-COM-2026',
                'description' => 'Posgrado orientado a la gestión y atención en entornos comunitarios.',
                'subjects' => [
                    ['name' => 'Teorías de la Atención Comunitaria', 'code' => 'TAC-101', 'credits' => 4],
                    ['name' => 'Gestión de Proyectos Sociales', 'code' => 'GPS-201', 'credits' => 3],
                    ['name' => 'Investigación Aplicada', 'code' => 'INV-301', 'credits' => 4],
                    ['name' => 'Ética y Derechos Humanos', 'code' => 'EDH-401', 'credits' => 2],
                ],
            ],
        ];

        $deliverableNames = ['Semana 0', 'Semana 1', 'Semana 2', 'Módulo 1', 'Módulo 2'];

        // [expert_status, pedagogy_status, design_status, audiovisual_status, engineering_status, qa_status, global_status]
        $activityConfigs = [
            ['approved', 'approved', 'approved', 'approved', 'approved', 'approved', 'finished'],
            ['in_development', 'in_progress', 'designing', 'production', 'implementing', 'in_testing', 'in_progress'],
            ['draft', 'not_started', 'not_started', 'not_started', 'not_started', 'pending', 'pending_start'],
            ['delivered', 'in_review', 'adjusting', 'editing', 'validating', 'with_findings', 'in_review'],
            ['adjustments_requested', 'adjusting', 'not_started', 'not_started', 'not_started', 'pending', 'with_observations'],
        ];

        $deliverableIdx = 0;
        foreach ($programs1 as $progData) {
            $program = AcademicProgram::create([
                'project_id' => $project1->id,
                'name' => $progData['name'],
                'code' => $progData['code'],
                'description' => $progData['description'],
                'created_by' => $admin->id,
            ]);

            foreach ($progData['subjects'] as $subjData) {
                $subject = Subject::create([
                    'academic_program_id' => $program->id,
                    'name' => $subjData['name'],
                    'code' => $subjData['code'],
                    'credits' => $subjData['credits'],
                    'created_by' => $coordinator->id,
                ]);

                foreach ($deliverableNames as $idx => $dName) {
                    $config = $activityConfigs[$idx % count($activityConfigs)];
                    $globalStatus = $config[6];

                    $deliverable = Deliverable::create([
                        'subject_id' => $subject->id,
                        'name' => $dName,
                        'type' => 'creation',
                        'global_status' => $globalStatus,
                        'start_date' => '2026-02-01',
                        'notes' => 'Entregable planificado para producción académica.',
                        'created_by' => $coordinator->id,
                    ]);

                    $roles = ['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'];
                    $statuses = [$config[0], $config[1], $config[2], $config[3], $config[4], $config[5]];

                    foreach ($roles as $ri => $role) {
                        $baseDate = \Carbon\Carbon::parse('2026-02-01')->addWeeks($ri);
                        $isApproved = $statuses[$ri] === 'approved';
                        RoleActivity::create([
                            'deliverable_id' => $deliverable->id,
                            'role' => $role,
                            'responsible_id' => $responsibles[$role]->id,
                            'assigned_by' => $coordinator->id,
                            'assigned_at' => '2026-01-20 09:00:00',
                            'commitment_date' => $baseDate->toDateString(),
                            'actual_start_date' => $isApproved ? $baseDate->copy()->subDays(5)->toDateString() : null,
                            'actual_delivery_date' => $isApproved ? $baseDate->copy()->subDays(1)->toDateString() : null,
                            'status' => $statuses[$ri],
                            'notes' => $isApproved ? 'Entregado y aprobado.' : null,
                        ]);
                    }

                    // Add comments on first deliverable
                    if ($deliverableIdx === 0) {
                        $comment = Comment::create([
                            'deliverable_id' => $deliverable->id,
                            'user_id' => $coordinator->id,
                            'parent_id' => null,
                            'content' => 'Este entregable requiere especial atención en la semana de inicio.',
                            'created_at' => now(),
                        ]);

                        Comment::create([
                            'deliverable_id' => $deliverable->id,
                            'user_id' => $expert->id,
                            'parent_id' => $comment->id,
                            'content' => 'Entendido, estamos coordinando con el equipo de diseño.',
                            'created_at' => now(),
                        ]);
                    }

                    $deliverableIdx++;
                }
            }
        }

        // Audit logs de ejemplo
        AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'updated',
            'entity_type' => 'Project',
            'entity_id' => $project1->id,
            'field_changed' => 'status',
            'old_value' => 'parameterized',
            'new_value' => 'in_progress',
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
        ]);

        AuditLog::create([
            'user_id' => $coordinator->id,
            'action' => 'updated',
            'entity_type' => 'Project',
            'entity_id' => $project1->id,
            'field_changed' => 'responsible_id',
            'old_value' => null,
            'new_value' => (string)$coordinator->id,
            'ip_address' => '127.0.0.1',
            'created_at' => now(),
        ]);

        // ── Proyecto 2: Creación Especialización Psicosocial ──────────────────
        $project2 = Project::create([
            'name' => 'Creación Especialización Psicosocial',
            'description' => 'Nuevo programa de especialización en psicología social aplicada.',
            'status' => 'parameterized',
            'responsible_id' => $coordinator->id,
            'start_date' => '2026-03-01',
            'end_date' => '2026-11-30',
            'created_by' => $admin->id,
        ]);

        $program2 = AcademicProgram::create([
            'project_id' => $project2->id,
            'name' => 'Especialización en Psicología Social',
            'code' => 'ESP-PS-2026',
            'description' => 'Formación avanzada en psicología social y comunitaria.',
            'created_by' => $admin->id,
        ]);

        foreach ([
            ['name' => 'Psicología del Desarrollo', 'code' => 'PSD-101', 'credits' => 3],
            ['name' => 'Psicopatología Social', 'code' => 'PSP-201', 'credits' => 4],
        ] as $subjData) {
            $subject = Subject::create([
                'academic_program_id' => $program2->id,
                'name' => $subjData['name'],
                'code' => $subjData['code'],
                'credits' => $subjData['credits'],
                'created_by' => $coordinator->id,
            ]);

            foreach (['Semana 0', 'Semana 1', 'Semana 2'] as $dName) {
                $deliverable = Deliverable::create([
                    'subject_id' => $subject->id,
                    'name' => $dName,
                    'type' => 'creation',
                    'global_status' => 'pending_start',
                    'start_date' => '2026-04-01',
                    'created_by' => $coordinator->id,
                ]);

                foreach (['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'] as $ri => $role) {
                    $baseDate = \Carbon\Carbon::parse('2026-04-01')->addWeeks($ri);
                    RoleActivity::create([
                        'deliverable_id' => $deliverable->id,
                        'role' => $role,
                        'responsible_id' => $responsibles[$role]->id,
                        'assigned_by' => $coordinator->id,
                        'assigned_at' => '2026-03-15 09:00:00',
                        'commitment_date' => $baseDate->toDateString(),
                        'status' => 'not_started',
                    ]);
                }
            }
        }

        // ── Proyecto 3: Control de Cambios Q1 2026 ───────────────────────────
        $project3 = Project::create([
            'name' => 'Control de Cambios Q1 2026',
            'description' => 'Gestión de actualizaciones menores y correcciones del primer trimestre.',
            'status' => 'in_progress',
            'responsible_id' => $coordinator->id,
            'start_date' => '2026-01-01',
            'end_date' => '2026-03-31',
            'created_by' => $admin->id,
        ]);

        $program3 = AcademicProgram::create([
            'project_id' => $project3->id,
            'name' => 'Correcciones Generales Q1',
            'code' => 'CQ1-2026',
            'description' => 'Programa de correcciones y mejoras del primer trimestre.',
            'created_by' => $admin->id,
        ]);

        foreach ([
            ['name' => 'Revisión de Contenidos', 'code' => 'RC-101', 'credits' => null],
            ['name' => 'Actualización de Recursos', 'code' => 'AR-201', 'credits' => null],
        ] as $subjData) {
            $subject = Subject::create([
                'academic_program_id' => $program3->id,
                'name' => $subjData['name'],
                'code' => $subjData['code'],
                'credits' => $subjData['credits'],
                'created_by' => $coordinator->id,
            ]);

            foreach (['Corrección 1', 'Corrección 2'] as $dName) {
                $deliverable = Deliverable::create([
                    'subject_id' => $subject->id,
                    'name' => $dName,
                    'type' => 'update',
                    'global_status' => 'finished',
                    'start_date' => '2026-01-10',
                    'notes' => 'Cambio menor aprobado.',
                    'created_by' => $coordinator->id,
                ]);

                foreach (['expert', 'pedagogy', 'design', 'audiovisual', 'engineering', 'qa'] as $ri => $role) {
                    $baseDate = \Carbon\Carbon::parse('2026-01-10')->addDays($ri * 3);
                    RoleActivity::create([
                        'deliverable_id' => $deliverable->id,
                        'role' => $role,
                        'responsible_id' => $responsibles[$role]->id,
                        'assigned_by' => $admin->id,
                        'assigned_at' => '2026-01-05 09:00:00',
                        'commitment_date' => $baseDate->toDateString(),
                        'actual_start_date' => $baseDate->copy()->subDays(1)->toDateString(),
                        'actual_delivery_date' => $baseDate->toDateString(),
                        'status' => 'approved',
                        'notes' => 'Aprobado sin observaciones.',
                    ]);
                }
            }
        }
    }
}
