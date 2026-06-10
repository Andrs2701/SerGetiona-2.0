<?php

namespace Database\Seeders;

use App\Models\AcademicProgram;
use App\Models\Deliverable;
use App\Models\Project;
use App\Models\RoleActivity;
use App\Models\Subject;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class RealProjectSeeder extends Seeder
{
    public function run(): void
    {
        // ─── Proyecto ────────────────────────────────────────────────────────
        $project = Project::firstOrCreate(
            ['name' => 'Control de Cambios - Profesional en Negocios Digitales'],
            [
                'status'     => 'in_progress',
                'created_by' => 1,
            ]
        );

        // ─── Programa ────────────────────────────────────────────────────────
        $program = AcademicProgram::firstOrCreate(
            ['name' => 'Profesional en negocios digitales', 'project_id' => $project->id],
            ['created_by' => 1]
        );

        // ─── Usuarios responsables ───────────────────────────────────────────
        $usersData = [
            ['name' => 'Melisa Rincon',      'role' => 'pedagogy',    'email' => 'melisa.rincon@sergestiona.co'],
            ['name' => 'Angie Vásquez',      'role' => 'pedagogy',    'email' => 'angie.vasquez@sergestiona.co'],
            ['name' => 'Cristian Barrera',   'role' => 'design',      'email' => 'cristian.barrera@sergestiona.co'],
            ['name' => 'Valentina Andrade',  'role' => 'design',      'email' => 'valentina.andrade@sergestiona.co'],
            ['name' => 'Sharick Diaz',       'role' => 'design',      'email' => 'sharick.diaz@sergestiona.co'],
            ['name' => 'Andres Baron',       'role' => 'audiovisual', 'email' => 'andres.baron@sergestiona.co'],
            ['name' => 'Luis Bueno',         'role' => 'audiovisual', 'email' => 'luis.bueno@sergestiona.co'],
            ['name' => 'Felipe Cifuentes',   'role' => 'engineering', 'email' => 'felipe.cifuentes@sergestiona.co'],
            ['name' => 'Jhon Fagua',         'role' => 'qa',          'email' => 'jhon.fagua@sergestiona.co'],
        ];

        $users = [];
        foreach ($usersData as $ud) {
            $u = User::firstOrCreate(
                ['email' => $ud['email']],
                [
                    'name'     => $ud['name'],
                    'role'     => $ud['role'],
                    'password' => Hash::make('password'),
                    'is_active'=> true,
                ]
            );
            $users[$ud['name']] = $u->id;
        }

        // ─── Asignaturas y actividades ───────────────────────────────────────
        // Columns: subject, expert_date, start_date, ped_date, dis_date, aud_date, ing_date, qa_date,
        //          res_ped, res_dis, res_aud, res_ing, res_cal
        $data = [
            [
                'subject'     => 'Matemáticas aplicadas I',
                'expert_date' => '2026-05-04',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-21',
                'dis_date'    => '2026-05-27',
                'aud_date'    => '2026-05-25',
                'ing_date'    => '2026-05-29',
                'qa_date'     => '2026-06-01',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Andres Baron',
            ],
            [
                'subject'     => 'Plataformas tecnológicas y digitales',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-22',
                'dis_date'    => '2026-05-28',
                'aud_date'    => '2026-05-26',
                'ing_date'    => '2026-05-29',
                'qa_date'     => '2026-06-01',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Andres Baron',
            ],
            [
                'subject'     => 'Comportamiento del consumidor digital',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-25',
                'dis_date'    => '2026-05-29',
                'aud_date'    => '2026-05-27',
                'ing_date'    => '2026-06-02',
                'qa_date'     => '2026-06-03',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Probabilidad y estadística',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-26',
                'dis_date'    => '2026-05-27',
                'aud_date'    => '2026-05-28',
                'ing_date'    => '2026-06-01',
                'qa_date'     => '2026-06-02',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Andres Baron',
            ],
            [
                'subject'     => 'Lenguajes de programación',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-27',
                'dis_date'    => '2026-05-28',
                'aud_date'    => '2026-05-29',
                'ing_date'    => '2026-06-04',
                'qa_date'     => '2026-06-05',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Desarrollo web móvil',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-28',
                'dis_date'    => '2026-06-03',
                'aud_date'    => '2026-06-04',
                'ing_date'    => '2026-06-05',
                'qa_date'     => '2026-06-09',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Luis Bueno',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Énfasis optativo 3 (optimización web)',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-05-29',
                'dis_date'    => '2026-06-03',
                'aud_date'    => '2026-06-09',
                'ing_date'    => '2026-06-09',
                'qa_date'     => '2026-09-10',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Luis Bueno',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Fundamentos Financieros y contables',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-06-11',
                'dis_date'    => '2026-06-12',
                'aud_date'    => '2026-06-11',
                'ing_date'    => '2026-06-16',
                'qa_date'     => '2026-06-17',
                'res_ped'     => 'Angie Vásquez',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Luis Bueno',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Negocios Digitales',
                'expert_date' => '2026-05-07',
                'start_date'  => '2026-05-11',
                'ped_date'    => '2026-06-16',
                'dis_date'    => '2026-06-17',
                'aud_date'    => '2026-06-17',
                'ing_date'    => '2026-06-18',
                'qa_date'     => '2026-06-18',
                'res_ped'     => 'Angie Vásquez',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Luis Bueno',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Decisiones y mercados',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-05-29',
                'ped_date'    => '2026-06-01',
                'dis_date'    => '2026-06-02',
                'aud_date'    => '2026-06-02',
                'ing_date'    => '2026-06-04',
                'qa_date'     => '2026-06-05',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Copywriting',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-05-29',
                'ped_date'    => '2026-06-03',
                'dis_date'    => '2026-06-04',
                'aud_date'    => '2026-06-04',
                'ing_date'    => '2026-06-09',
                'qa_date'     => '2026-06-10',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Costos y presupuestos',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-05-29',
                'ped_date'    => '2026-06-03',
                'dis_date'    => '2026-06-04',
                'aud_date'    => '2026-06-04',
                'ing_date'    => '2026-06-10',
                'qa_date'     => '2026-06-11',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Gestión de procesos de negocio',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-05-29',
                'ped_date'    => '2026-06-12',
                'dis_date'    => '2026-06-16',
                'aud_date'    => '2026-06-09',
                'ing_date'    => '2026-06-16',
                'qa_date'     => '2026-06-17',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Cristian Barrera',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Investigación e inteligencia de marketing',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-05-29',
                'ped_date'    => '2026-06-05',
                'dis_date'    => '2026-06-10',
                'aud_date'    => '2026-06-09',
                'ing_date'    => '2026-06-10',
                'qa_date'     => '2026-06-10',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Decisiones y entorno económico',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-05-29',
                'ped_date'    => '2026-06-09',
                'dis_date'    => '2026-06-11',
                'aud_date'    => '2026-06-10',
                'ing_date'    => '2026-06-11',
                'qa_date'     => '2026-06-11',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Valentina Andrade',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Inteligencia Artificial Generativa',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-06-04',
                'ped_date'    => '2026-06-10',
                'dis_date'    => '2026-06-17',
                'aud_date'    => '2026-06-11',
                'ing_date'    => '2026-06-17',
                'qa_date'     => '2026-06-17',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Sharick Diaz',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Influencer Marketing',
                'expert_date' => '2026-05-13',
                'start_date'  => '2026-06-04',
                'ped_date'    => '2026-06-11',
                'dis_date'    => '2026-06-18',
                'aud_date'    => '2026-06-12',
                'ing_date'    => '2026-06-18',
                'qa_date'     => '2026-06-18',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Sharick Diaz',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
            [
                'subject'     => 'Marketing',
                'expert_date' => '2026-05-20',
                'start_date'  => '2026-06-04',
                'ped_date'    => '2026-06-12',
                'dis_date'    => '2026-06-19',
                'aud_date'    => '2026-06-13',
                'ing_date'    => '2026-06-19',
                'qa_date'     => '2026-06-19',
                'res_ped'     => 'Melisa Rincon',
                'res_dis'     => 'Sharick Diaz',
                'res_aud'     => 'Andres Baron',
                'res_ing'     => 'Felipe Cifuentes',
                'res_cal'     => 'Jhon Fagua',
            ],
        ];

        // Expert dates that are <= 2026-05-20 should be marked as approved
        $expertApprovedCutoff = '2026-05-20';

        foreach ($data as $row) {
            // Create subject
            $subject = Subject::firstOrCreate(
                ['name' => $row['subject'], 'academic_program_id' => $program->id],
                ['created_by' => 1]
            );

            // Create deliverable
            $deliverable = Deliverable::firstOrCreate(
                ['subject_id' => $subject->id, 'name' => $row['subject']],
                [
                    'type'          => 'update',
                    'global_status' => 'in_progress',
                    'created_by'    => 1,
                ]
            );

            // Determine expert status
            $expertApproved = $row['expert_date'] <= $expertApprovedCutoff;

            // expert activity
            $expertActivity = RoleActivity::firstOrCreate(
                ['deliverable_id' => $deliverable->id, 'role' => 'expert'],
                [
                    'responsible_id'       => 1,
                    'commitment_date'      => $row['expert_date'],
                    'actual_start_date'    => $row['start_date'],
                    'actual_delivery_date' => $expertApproved ? $row['expert_date'] : null,
                    'status'               => $expertApproved ? 'approved' : 'in_development',
                    'checklist'            => [],
                ]
            );

            // Roles with their dates and responsibles
            $roleActivities = [
                'pedagogy'    => ['date' => $row['ped_date'], 'res' => $row['res_ped']],
                'design'      => ['date' => $row['dis_date'], 'res' => $row['res_dis']],
                'audiovisual' => ['date' => $row['aud_date'], 'res' => $row['res_aud']],
                'engineering' => ['date' => $row['ing_date'], 'res' => $row['res_ing']],
                'qa'          => ['date' => $row['qa_date'],  'res' => $row['res_cal']],
            ];

            foreach ($roleActivities as $role => $roleData) {
                $responsibleId = $users[$roleData['res']] ?? 1;

                RoleActivity::firstOrCreate(
                    ['deliverable_id' => $deliverable->id, 'role' => $role],
                    [
                        'responsible_id'       => $responsibleId,
                        'commitment_date'      => $roleData['date'],
                        'actual_start_date'    => null,
                        'actual_delivery_date' => null,
                        'status'               => 'pending',
                        'checklist'            => RoleActivity::defaultChecklist($role),
                    ]
                );
            }
        }

        $this->command->info('RealProjectSeeder completado.');
        $this->command->info('Proyecto: ' . $project->name . ' (ID: ' . $project->id . ')');
        $this->command->info('Programa: ' . $program->name . ' (ID: ' . $program->id . ')');
        $this->command->info('Actividades creadas: ' . RoleActivity::count());
    }
}
