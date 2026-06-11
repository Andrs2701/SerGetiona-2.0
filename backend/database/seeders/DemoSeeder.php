<?php

namespace Database\Seeders;

use App\Models\AcademicProgram;
use App\Models\Channel;
use App\Models\ChannelMessage;
use App\Models\DecisionRecord;
use App\Models\Project;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    public function run(): void
    {
        $admin       = User::where('email', 'admin@sergestiona.co')->firstOrFail();
        $coordinator = User::where('email', 'coordinador@sergestiona.co')->firstOrFail();
        $expert      = User::where('email', 'experto1@sergestiona.co')->firstOrFail();
        $pedagogy    = User::where('email', 'pedagogia@sergestiona.co')->firstOrFail();
        $design      = User::where('email', 'disenio@sergestiona.co')->firstOrFail();
        $audiovisual = User::where('email', 'audiovisual@sergestiona.co')->firstOrFail();
        $engineering = User::where('email', 'ingenieria@sergestiona.co')->firstOrFail();
        $qa          = User::where('email', 'calidad@sergestiona.co')->firstOrFail();

        $project1 = Project::where('name', 'Actualización Curricular 2026')->firstOrFail();
        $project2 = Project::where('name', 'Creación Especialización Psicosocial')->firstOrFail();
        $project3 = Project::where('name', 'Control de Cambios Q2 2026')->firstOrFail();

        $program1 = AcademicProgram::where('code', 'ESP-BPS-2026')->first();
        $program2 = AcademicProgram::where('code', 'ESP-PS-2026')->first();

        // ── Decisiones ────────────────────────────────────────────────────────
        $decisions = [
            [
                'decision_date'        => '2026-01-20',
                'project_id'           => $project1->id,
                'academic_program_id'  => $program1?->id,
                'description'          => 'Se decide adoptar la metodología ADDIE para el diseño instruccional de todos los programas nuevos del año 2026.',
                'responsible_id'       => $coordinator->id,
                'status'               => 'implemented',
                'impact'               => 'high',
                'observations'         => 'Formación obligatoria para el equipo de pedagogía en mayo 2026.',
                'created_by'           => $admin->id,
            ],
            [
                'decision_date'        => '2026-02-10',
                'project_id'           => $project1->id,
                'academic_program_id'  => null,
                'description'          => 'Ampliar fecha límite del Módulo 1 en dos semanas por retrasos en la entrega de recursos audiovisuales.',
                'responsible_id'       => $coordinator->id,
                'status'               => 'implemented',
                'impact'               => 'medium',
                'observations'         => 'Nueva fecha: 28 de febrero 2026. Comunicado a todo el equipo.',
                'created_by'           => $coordinator->id,
            ],
            [
                'decision_date'        => '2026-03-15',
                'project_id'           => $project1->id,
                'academic_program_id'  => $program1?->id,
                'description'          => 'Contratar proveedor externo para grabación de videos de alta calidad para los módulos 3 y 4.',
                'responsible_id'       => $admin->id,
                'status'               => 'implemented',
                'impact'               => 'high',
                'observations'         => 'Presupuesto aprobado: $8.000.000 COP. Entregables semanas 7-10.',
                'created_by'           => $admin->id,
            ],
            [
                'decision_date'        => '2026-04-05',
                'project_id'           => $project2->id,
                'academic_program_id'  => $program2?->id,
                'description'          => 'Incluir laboratorio de simulación virtual en Psicología del Desarrollo, reemplazando 4 horas presenciales.',
                'responsible_id'       => $coordinator->id,
                'status'               => 'in_progress',
                'impact'               => 'high',
                'observations'         => 'Requiere licencia de plataforma VR. Evaluando proveedores.',
                'created_by'           => $coordinator->id,
            ],
            [
                'decision_date'        => '2026-05-12',
                'project_id'           => $project1->id,
                'academic_program_id'  => null,
                'description'          => 'Migrar todos los SCORM a formato H5P para mejorar compatibilidad con LMS Moodle 4.2.',
                'responsible_id'       => $engineering->id,
                'status'               => 'pending',
                'impact'               => 'medium',
                'observations'         => 'Plan de migración pendiente de aprobación. Afecta 60+ contenidos.',
                'created_by'           => $admin->id,
            ],
            [
                'decision_date'        => '2026-06-01',
                'project_id'           => $project3->id,
                'academic_program_id'  => null,
                'description'          => 'Cancelar actualización de recursos multimedia en Corrección 2 por cierre anticipado del proyecto Q2.',
                'responsible_id'       => $admin->id,
                'status'               => 'cancelled',
                'impact'               => 'low',
                'observations'         => 'Recursos quedaron en versión 2025. Se reprograman para Q3.',
                'created_by'           => $admin->id,
            ],
        ];

        foreach ($decisions as $d) {
            DecisionRecord::create($d);
        }

        // ── Canales ───────────────────────────────────────────────────────────
        $channelGeneral = Channel::create([
            'name'            => 'general',
            'type'            => 'general',
            'project_id'      => null,
            'is_archived'     => false,
            'last_message_at' => Carbon::parse('2026-06-10 14:35:00'),
        ]);

        $channelCurricular = Channel::create([
            'name'            => 'actualizacion-curricular-2026',
            'type'            => 'project',
            'project_id'      => $project1->id,
            'is_archived'     => false,
            'last_message_at' => Carbon::parse('2026-06-11 09:20:00'),
        ]);

        $channelPsico = Channel::create([
            'name'            => 'esp-psicosocial',
            'type'            => 'project',
            'project_id'      => $project2->id,
            'is_archived'     => false,
            'last_message_at' => Carbon::parse('2026-06-09 16:45:00'),
        ]);

        // Membresías
        $channelGeneral->members()->attach([
            $admin->id       => ['last_read_at' => now()],
            $coordinator->id => ['last_read_at' => now()],
            $expert->id      => ['last_read_at' => now()],
            $pedagogy->id    => ['last_read_at' => now()],
            $design->id      => ['last_read_at' => now()],
            $audiovisual->id => ['last_read_at' => now()],
            $engineering->id => ['last_read_at' => now()],
            $qa->id          => ['last_read_at' => now()],
        ]);

        $channelCurricular->members()->attach([
            $admin->id       => ['last_read_at' => now()],
            $coordinator->id => ['last_read_at' => now()],
            $expert->id      => ['last_read_at' => Carbon::parse('2026-06-10 08:00:00')],
            $pedagogy->id    => ['last_read_at' => Carbon::parse('2026-06-10 08:00:00')],
            $design->id      => ['last_read_at' => Carbon::parse('2026-06-09 17:00:00')],
            $audiovisual->id => ['last_read_at' => Carbon::parse('2026-06-09 17:00:00')],
            $engineering->id => ['last_read_at' => Carbon::parse('2026-06-10 08:00:00')],
            $qa->id          => ['last_read_at' => Carbon::parse('2026-06-09 17:00:00')],
        ]);

        $channelPsico->members()->attach([
            $admin->id       => ['last_read_at' => now()],
            $coordinator->id => ['last_read_at' => now()],
            $expert->id      => ['last_read_at' => Carbon::parse('2026-06-09 16:00:00')],
            $pedagogy->id    => ['last_read_at' => Carbon::parse('2026-06-09 16:00:00')],
        ]);

        // ── Mensajes: #general ────────────────────────────────────────────────
        $m1 = ChannelMessage::create([
            'channel_id' => $channelGeneral->id,
            'user_id'    => $admin->id,
            'content'    => 'Bienvenidos al canal general de SerGestiona. Acá coordinamos temas transversales a todos los proyectos.',
            'created_at' => '2026-06-01 08:00:00',
        ]);

        $m2 = ChannelMessage::create([
            'channel_id' => $channelGeneral->id,
            'user_id'    => $coordinator->id,
            'content'    => 'Recordatorio: la reunion de seguimiento semanal es todos los lunes a las 9am. @carlos.ramirez @ana.torres por favor confirmar asistencia.',
            'created_at' => '2026-06-02 07:50:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelGeneral->id,
            'user_id'    => $expert->id,
            'parent_id'  => $m2->id,
            'content'    => 'Confirmo asistencia el lunes.',
            'created_at' => '2026-06-02 08:10:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelGeneral->id,
            'user_id'    => $pedagogy->id,
            'parent_id'  => $m2->id,
            'content'    => 'Confirmado, estaré en la reunión.',
            'created_at' => '2026-06-02 08:25:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelGeneral->id,
            'user_id'    => $admin->id,
            'content'    => 'El sistema de gestión SerGestiona ya esta en producción. Cualquier inconveniente reportarlo acá.',
            'created_at' => '2026-06-10 14:35:00',
        ]);

        // ── Mensajes: #actualizacion-curricular-2026 ──────────────────────────
        $m3 = ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $coordinator->id,
            'content'    => 'Iniciamos el proyecto Actualización Curricular 2026. El objetivo es tener todos los contenidos de Bienestar Psicosocial listos para el 31 de agosto.',
            'created_at' => '2026-01-16 09:00:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $expert->id,
            'content'    => 'Entendido @coordinador.general. Ya tengo el guion de Fundamentos del Bienestar en borrador. Lo comparto esta semana.',
            'created_at' => '2026-01-16 09:20:00',
        ]);

        $m4 = ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $coordinator->id,
            'content'    => '@carlos.ramirez el guion de Intervención Psicosocial tiene observaciones del equipo de pedagogía. Por favor revisarlo antes del viernes.',
            'created_at' => '2026-06-05 10:15:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $expert->id,
            'parent_id'  => $m4->id,
            'content'    => 'Listo, lo reviso hoy en la tarde y lo tengo corregido para mañana jueves.',
            'created_at' => '2026-06-05 10:40:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $pedagogy->id,
            'content'    => 'El diseño instruccional del Módulo 2 ya esta listo. @luis.gomez puedes empezar con la maquetación visual.',
            'created_at' => '2026-06-08 16:00:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $design->id,
            'content'    => 'Recibido @ana.torres. Empiezo el lunes. Necesitaré los assets de branding actualizados.',
            'created_at' => '2026-06-08 16:30:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelCurricular->id,
            'user_id'    => $coordinator->id,
            'content'    => 'Equipo: recordar que el viernes es el corte de avance. @carlos.ramirez @ana.torres @luis.gomez por favor actualizar el estado de sus actividades en el sistema.',
            'created_at' => '2026-06-11 09:20:00',
        ]);

        // ── Mensajes: #esp-psicosocial ────────────────────────────────────────
        ChannelMessage::create([
            'channel_id' => $channelPsico->id,
            'user_id'    => $coordinator->id,
            'content'    => 'Canal para la Especialización en Psicología Social. Arrancamos en julio 2026. @carlos.ramirez ya tienes los syllabus para comenzar los guiones?',
            'created_at' => '2026-06-06 11:00:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelPsico->id,
            'user_id'    => $expert->id,
            'content'    => 'Sí @coordinador.general, tengo los syllabus de las dos asignaturas. Psicología del Desarrollo está más avanzado. Psicopatología Social lo tengo en 60%.',
            'created_at' => '2026-06-06 11:45:00',
        ]);

        $m5 = ChannelMessage::create([
            'channel_id' => $channelPsico->id,
            'user_id'    => $pedagogy->id,
            'content'    => 'Desde pedagogía recomendamos incluir actividades de reflexión al final de cada semana. Documenté las sugerencias en el guion compartido.',
            'created_at' => '2026-06-09 15:00:00',
        ]);

        ChannelMessage::create([
            'channel_id' => $channelPsico->id,
            'user_id'    => $expert->id,
            'parent_id'  => $m5->id,
            'content'    => 'Excelente sugerencia @ana.torres, lo incorporo en la próxima revisión del guion.',
            'created_at' => '2026-06-09 16:45:00',
        ]);

        $this->command->info('DemoSeeder completado: 6 decisiones, 3 canales, 16 mensajes.');
    }
}
