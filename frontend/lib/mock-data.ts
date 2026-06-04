import type {
  Project,
  AcademicProgram,
  Subject,
  Deliverable,
  User,
  RoleActivity,
  DashboardStats,
  ComplianceReport,
} from './types';

export const MOCK_USERS: User[] = [
  { id: 1, name: 'Administrador', email: 'admin@sergestiona.co', role: 'admin', is_active: true, phone: '3001234567' },
  { id: 2, name: 'Ana Rodríguez', email: 'ana.rodriguez@sergestiona.co', role: 'coordinator', is_active: true, phone: '3007654321' },
  { id: 3, name: 'Carlos Méndez', email: 'carlos.mendez@sergestiona.co', role: 'coordinator', is_active: true },
  { id: 4, name: 'Laura Torres', email: 'laura.torres@sergestiona.co', role: 'expert', is_active: true },
  { id: 5, name: 'Jhon Pérez', email: 'jhon.perez@sergestiona.co', role: 'pedagogy', is_active: true },
  { id: 6, name: 'María López', email: 'maria.lopez@sergestiona.co', role: 'design', is_active: true },
  { id: 7, name: 'Pedro Gómez', email: 'pedro.gomez@sergestiona.co', role: 'audiovisual', is_active: false },
  { id: 8, name: 'Sofía Vargas', email: 'sofia.vargas@sergestiona.co', role: 'qa', is_active: true },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 1,
    name: 'Actualización Curricular 2026',
    description: 'Actualización de contenidos académicos para el año 2026',
    status: 'in_progress',
    responsible: MOCK_USERS[1],
    start_date: '2026-01-15',
    end_date: '2026-12-31',
    programs_count: 8,
    deliverables_count: 142,
    compliance_percentage: 67,
    created_at: '2026-01-10T10:00:00Z',
  },
  {
    id: 2,
    name: 'Creación Especialización Psicosocial',
    description: 'Creación de nueva especialización en bienestar psicosocial',
    status: 'parameterized',
    responsible: MOCK_USERS[2],
    start_date: '2026-02-01',
    end_date: '2026-11-30',
    programs_count: 1,
    deliverables_count: 48,
    compliance_percentage: 23,
    created_at: '2026-01-20T10:00:00Z',
  },
  {
    id: 3,
    name: 'Control de Cambios Q1 2026',
    description: 'Control de cambios del primer trimestre de 2026',
    status: 'in_progress',
    responsible: MOCK_USERS[1],
    start_date: '2026-01-05',
    end_date: '2026-03-31',
    programs_count: 3,
    deliverables_count: 37,
    compliance_percentage: 89,
    created_at: '2026-01-02T10:00:00Z',
  },
  {
    id: 4,
    name: 'Ajuste Contenidos Maestría',
    description: 'Ajuste de contenidos para la maestría en atención comunitaria',
    status: 'pending_params',
    responsible: MOCK_USERS[2],
    start_date: '2026-03-10',
    programs_count: 2,
    deliverables_count: 20,
    compliance_percentage: 0,
    created_at: '2026-03-01T10:00:00Z',
  },
];

export const MOCK_PROGRAMS: AcademicProgram[] = [
  { id: 1, project_id: 1, name: 'Especialización en Bienestar Psicosocial', code: 'ESP-PSC', subjects_count: 5, deliverables_count: 25 },
  { id: 2, project_id: 1, name: 'Maestría en Atención Comunitaria', code: 'MAES-COM', subjects_count: 4, deliverables_count: 20 },
  { id: 3, project_id: 2, name: 'Especialización en Bienestar Psicosocial', code: 'ESP-PSC', subjects_count: 8, deliverables_count: 48 },
];

export const MOCK_SUBJECTS: Subject[] = [
  { id: 1, academic_program_id: 1, name: 'Análisis de Contextos', code: 'AC-101', deliverables_count: 5 },
  { id: 2, academic_program_id: 1, name: 'Fundamentos de Intervención', code: 'FI-102', deliverables_count: 6 },
  { id: 3, academic_program_id: 1, name: 'Gestión Psicosocial', code: 'GP-103', deliverables_count: 5 },
  { id: 4, academic_program_id: 2, name: 'Políticas de Atención', code: 'PA-201', deliverables_count: 5 },
  { id: 5, academic_program_id: 2, name: 'Intervención Comunitaria', code: 'IC-202', deliverables_count: 5 },
];

const makeRoleActivities = (deliverableId: number): RoleActivity[] => [
  {
    id: deliverableId * 10 + 1,
    deliverable_id: deliverableId,
    role: 'expert',
    responsible: MOCK_USERS[3],
    commitment_date: '2026-02-15',
    actual_start_date: '2026-02-10',
    actual_delivery_date: deliverableId % 3 === 0 ? '2026-02-14' : undefined,
    status: deliverableId % 3 === 0 ? 'approved' : 'in_progress',
  },
  {
    id: deliverableId * 10 + 2,
    deliverable_id: deliverableId,
    role: 'pedagogy',
    responsible: MOCK_USERS[4],
    commitment_date: '2026-02-22',
    status: deliverableId % 4 === 0 ? 'approved' : deliverableId % 2 === 0 ? 'in_progress' : 'pending',
  },
  {
    id: deliverableId * 10 + 3,
    deliverable_id: deliverableId,
    role: 'design',
    responsible: MOCK_USERS[5],
    commitment_date: '2026-03-01',
    status: deliverableId % 5 === 0 ? 'approved' : 'not_started',
  },
  {
    id: deliverableId * 10 + 4,
    deliverable_id: deliverableId,
    role: 'audiovisual',
    responsible: MOCK_USERS[6],
    commitment_date: '2026-03-08',
    status: 'not_started',
  },
  {
    id: deliverableId * 10 + 5,
    deliverable_id: deliverableId,
    role: 'engineering',
    status: 'not_applicable',
  },
  {
    id: deliverableId * 10 + 6,
    deliverable_id: deliverableId,
    role: 'qa',
    responsible: MOCK_USERS[7],
    commitment_date: '2026-03-15',
    status: 'not_started',
  },
];

export const MOCK_DELIVERABLES: Deliverable[] = [
  {
    id: 1, subject_id: 1, name: 'Semana 0 - Bienvenida', type: 'creation',
    global_status: 'in_progress', start_date: '2026-02-01',
    subject_name: 'Análisis de Contextos', program_name: 'Especialización en Bienestar Psicosocial', program_id: 1,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 83,
    role_activities: makeRoleActivities(1),
  },
  {
    id: 2, subject_id: 1, name: 'Semana 1 - Módulo Introductorio', type: 'creation',
    global_status: 'in_review', start_date: '2026-02-08',
    subject_name: 'Análisis de Contextos', program_name: 'Especialización en Bienestar Psicosocial', program_id: 1,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 50,
    role_activities: makeRoleActivities(2),
  },
  {
    id: 3, subject_id: 2, name: 'Semana 0 - Bienvenida', type: 'update',
    global_status: 'finished', start_date: '2026-01-20',
    subject_name: 'Fundamentos de Intervención', program_name: 'Especialización en Bienestar Psicosocial', program_id: 1,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 100,
    role_activities: makeRoleActivities(3),
  },
  {
    id: 4, subject_id: 2, name: 'Módulo 1 - Bases Teóricas', type: 'update',
    global_status: 'with_observations', start_date: '2026-02-01',
    subject_name: 'Fundamentos de Intervención', program_name: 'Especialización en Bienestar Psicosocial', program_id: 1,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 33,
    role_activities: makeRoleActivities(4),
  },
  {
    id: 5, subject_id: 3, name: 'Semana 0 - Presentación', type: 'creation',
    global_status: 'pending_start', start_date: '2026-03-01',
    subject_name: 'Gestión Psicosocial', program_name: 'Especialización en Bienestar Psicosocial', program_id: 1,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 0,
    role_activities: makeRoleActivities(5),
  },
  {
    id: 6, subject_id: 4, name: 'Módulo 2 - Políticas Actuales', type: 'creation',
    global_status: 'in_progress', start_date: '2026-02-15',
    subject_name: 'Políticas de Atención', program_name: 'Maestría en Atención Comunitaria', program_id: 2,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 67,
    role_activities: makeRoleActivities(6),
  },
  {
    id: 7, subject_id: 5, name: 'Semana 1 - Diagnóstico Comunitario', type: 'creation',
    global_status: 'unpublished', start_date: '2026-03-10',
    subject_name: 'Intervención Comunitaria', program_name: 'Maestría en Atención Comunitaria', program_id: 2,
    project_name: 'Actualización Curricular 2026', compliance_percentage: 0,
    role_activities: makeRoleActivities(7),
  },
];

export const MOCK_DASHBOARD: DashboardStats = {
  active_projects: 4,
  total_programs: 12,
  total_deliverables: 247,
  with_observations: 18,
  compliance_percentage: 64,
};

export const MOCK_COMPLIANCE: ComplianceReport = {
  projects: [
    { id: 1, name: 'Actualización Curricular 2026', compliance: 67, total: 142, approved: 95, delayed: 12 },
    { id: 2, name: 'Creación Especialización Psicosocial', compliance: 23, total: 48, approved: 11, delayed: 5 },
    { id: 3, name: 'Control de Cambios Q1 2026', compliance: 89, total: 37, approved: 33, delayed: 2 },
    { id: 4, name: 'Ajuste Contenidos Maestría', compliance: 0, total: 20, approved: 0, delayed: 0 },
  ],
  by_status: {
    unpublished: 20,
    pending_start: 30,
    in_progress: 55,
    in_review: 40,
    with_observations: 18,
    finished: 72,
    cancelled: 5,
    not_applicable: 7,
  },
  by_role: [
    { role: 'expert', on_time: 80, delayed: 12 },
    { role: 'pedagogy', on_time: 70, delayed: 18 },
    { role: 'design', on_time: 65, delayed: 20 },
    { role: 'audiovisual', on_time: 60, delayed: 15 },
    { role: 'engineering', on_time: 90, delayed: 5 },
    { role: 'qa', on_time: 75, delayed: 10 },
  ],
  global_compliance: 64,
  total_approved: 139,
  total_delayed: 19,
};
