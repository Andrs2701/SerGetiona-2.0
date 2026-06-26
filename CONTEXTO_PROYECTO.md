# Sergestiona 2.0 — Contexto del Proyecto

> Última actualización: 26/06/2026  
> Repositorio: https://github.com/Andrs2701/SerGetiona-2.0

---

## ¿Qué es Sergestiona 2.0?

Plataforma web empresarial que reemplaza el uso de Excel para gestionar la **producción de contenidos académicos virtuales** de la Escuela de Educación Virtual (EEV) de la Universidad Sergio Arboleda.

El Excel original (`Copia de Producción - EEV.xlsm`) contiene ~920 registros en la hoja `Bd_Calendario` y hojas independientes por rol (P_Pedagogia, P_Diseno, P_Audiovisual, P_Ingeniero). Sergestiona reemplaza todo eso con una plataforma centralizada, trazable y colaborativa.

---

## Cómo levantar el proyecto localmente

### Requisitos
- Node.js 24 + npm
- PHP 8.2 + Composer
- (Docker no requerido — se corre directo)

### Terminal 1 — Backend
```powershell
cd C:\Users\Andres\SerGetiona-2.0\backend
php artisan serve
# Disponible en http://localhost:8000
```

### Terminal 2 — Frontend
```powershell
cd C:\Users\Andres\SerGetiona-2.0\frontend
npm run dev
# Disponible en http://localhost:3000
```

### Si la base de datos está vacía o corrupta
```powershell
cd C:\Users\Andres\SerGetiona-2.0\backend
php artisan migrate:fresh --seed
php artisan db:seed --class=CalendarEventSeeder
```

---

## Credenciales de prueba

| Rol | Correo | Contraseña |
|-----|--------|------------|
Las cuentas demo se crean mediante seeders. La contraseña se configura exclusivamente
con `DEMO_USER_PASSWORD` en el entorno y no debe almacenarse en Git.

---

## Stack tecnológico

### Backend
- **Laravel 12** + PHP 8.2
- **SQLite** (archivo: `backend/database/database.sqlite`)
- **Laravel Sanctum** — autenticación por token Bearer
- Puerto: `8000`

### Frontend
- **Next.js 16** + TypeScript
- **Tailwind CSS** + **TanStack Table** + **lucide-react** + **clsx**
- Puerto: `3000`
- Sin librerías de gráficos externas — todo CSS/React puro

---

## Estructura del repositorio

```
SerGetiona-2.0/
├── backend/                    # Laravel 12
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── AuthController.php          # login, logout, forgot/reset/change password
│   │   │   ├── ProjectController.php       # CRUD proyectos + flow
│   │   │   ├── ProgramController.php       # CRUD programas académicos
│   │   │   ├── SubjectController.php       # CRUD asignaturas
│   │   │   ├── DeliverableController.php   # CRUD entregables + flow endpoint
│   │   │   ├── RoleActivityController.php  # update estado, quick-action
│   │   │   ├── CommentController.php       # comentarios por entregable
│   │   │   ├── EvidenceLinkController.php  # URLs/Drive/SharePoint por rol
│   │   │   ├── NotificationController.php  # notificaciones internas
│   │   │   ├── CalendarController.php      # eventos festivos + my-deliverables
│   │   │   ├── WorkspaceController.php     # /my-workspace por rol
│   │   │   ├── ReportController.php        # dashboard stats + compliance
│   │   │   ├── ImportController.php        # importar CSV + descargar plantilla
│   │   │   ├── ExportController.php        # exportar CSV proyectos/entregables
│   │   │   └── UserController.php          # CRUD usuarios
│   │   ├── Models/
│   │   │   ├── User, Project, AcademicProgram, Subject
│   │   │   ├── Deliverable, RoleActivity, Comment
│   │   │   ├── EvidenceLink, Evidence, AuditLog
│   │   │   ├── Notification, CalendarEvent, FlowTemplate
│   │   ├── Services/
│   │   │   ├── NotificationService.php     # notificaciones internas + log email
│   │   │   └── WorkingDayService.php       # cálculo días hábiles saltando festivos
│   │   └── Observers/
│   │       └── AuditObserver.php           # auditoría automática en cambios
│   ├── database/
│   │   ├── migrations/                     # 15 migraciones
│   │   └── seeders/
│   │       ├── DatabaseSeeder.php          # 8 usuarios, 3 proyectos, 45 entregables, 270 actividades
│   │       └── CalendarEventSeeder.php     # 52 festivos Colombia 2025-2027
│   └── routes/api.php                      # todas las rutas API
│
├── frontend/
│   ├── app/
│   │   ├── login/page.tsx                  # Login dos columnas con recuperar contraseña
│   │   └── (dashboard)/
│   │       ├── layout.tsx                  # AuthProvider + Header + Sidebar + protección
│   │       ├── page.tsx                    # Dashboard (admin vs operativo según rol)
│   │       ├── proyectos/
│   │       │   ├── page.tsx               # Lista proyectos + exportar CSV + crear
│   │       │   └── [id]/page.tsx          # Detalle proyecto: tabla Excel + 4 tabs en panel
│   │       ├── programas/page.tsx
│   │       ├── entregables/page.tsx
│   │       ├── calendario/page.tsx        # Calendario mensual con festivos
│   │       ├── mi-espacio/page.tsx        # Vista operativa personal por rol
│   │       ├── usuarios/page.tsx
│   │       ├── reportes/page.tsx
│   │       ├── configuracion/page.tsx
│   │       └── perfil/page.tsx            # Cambiar contraseña
│   ├── components/
│   │   ├── Sidebar.tsx                    # Navegación dinámica por rol
│   │   ├── Header.tsx                     # Campana notificaciones + menú usuario
│   │   ├── DashboardOperativo.tsx         # Dashboard roles operativos (6 tarjetas + tabla)
│   │   ├── ProyectosTable.tsx
│   │   ├── DeliverableFlow.tsx            # Flujo Experto→Pedagogía→...→Calidad visual
│   │   ├── CommentThread.tsx              # Chat tipo Slack
│   │   ├── EvidencePanel.tsx             # Evidencias/links por rol en acordeón
│   │   ├── ImportModal.tsx               # Importar CSV con preview
│   │   ├── NextResponsibleCard.tsx       # Card "Próximo responsable"
│   │   ├── DateStatusBadge.tsx           # Verde/Amarillo/Rojo por fecha
│   │   ├── StatusBadge.tsx              # Badge de estado en español
│   │   ├── LoadingSkeleton.tsx
│   │   ├── PageHeader.tsx
│   │   ├── Modal.tsx
│   │   └── SidePanel.tsx
│   ├── lib/
│   │   ├── api.ts                         # Cliente fetch con unwrap automático de {data:[]}
│   │   ├── types.ts                       # Todos los tipos TypeScript + labels en español
│   ├── contexts/
│   │   └── AuthContext.tsx                # AuthProvider con localStorage + /auth/me
│   └── hooks/
│       └── useAuth.ts                     # Re-exporta useAuthContext
│
├── CONTEXTO_PROYECTO.md                   # Este archivo
└── .gitignore
```

---

## Base de datos actual

| Tabla | Registros |
|-------|-----------|
| users | 8 |
| projects | 3 |
| academic_programs | 4 |
| subjects | ~12 |
| deliverables | 45 |
| role_activities | 270 (45 × 6 roles) |
| calendar_events | 52 festivos Colombia 2025-2027 |
| notifications | ~6 de ejemplo |

**Fechas del seeder:** junio-agosto 2026 con escenarios realistas:
- ~20% todo aprobado (fechas abril-mayo pasadas)
- ~20% experto entregó, pedagogía en revisión
- ~20% vencidas implícitas (sin entrega, fecha pasada)
- ~20% devueltas al experto para ajustes
- ~20% no iniciadas con fechas futuras

---

## Modelo de datos — jerarquía

```
Proyecto
 └── Programa Académico
      └── Asignatura
           └── Entregable (Semana 0, Semana 1, Módulo 1...)
                └── RoleActivity × 6 roles
                     ├── expert
                     ├── pedagogy
                     ├── design
                     ├── audiovisual
                     ├── engineering
                     └── qa
```

---

## Flujo de producción

```
Experto Temático
    ↓ entrega contenido
Pedagogía
    ↓ valida pedagógicamente (puede devolver al experto)
Diseño
    ↓ produce recursos gráficos
Audiovisual
    ↓ produce recursos audiovisuales
Ingeniería
    ↓ implementa en plataforma
Calidad (QA)
    ↓ valida todo (puede rechazar)
Completado
```

---

## Campos clave del Excel mapeados a la BD

| Excel (Bd_Calendario) | BD (deliverables/role_activities) |
|-----------------------|-----------------------------------|
| Tipo | record_type (Pregrado/Posgrado/Asignatura/Tarea/Externo) |
| T_Contenido | content_type (SCORM/RISE/Multimedia/Varios) |
| Semestre | semestre |
| Ciclo | ciclo |
| C_Entrega_Experto | role_activities.commitment_date (role=expert) |
| Res_Pedagogía | role_activities.responsible_id (role=pedagogy) |
| Estatus_semana | deliverables.global_status |
| Requerimiento | deliverables.requirement |
| Observación | deliverables.observation |

**Checklist por rol** (role_activities.checklist — JSON):
- Pedagogía: entrega_pedagogia, multimedia, descargable, actividades, guiones
- Diseño: entrega_diseno, multimedia, descargable, banners
- Audiovisual: entrega_audiovisual, videos, videos_animados, video_podcast
- Ingeniería: entrega_ingenieria, act_evaluativas, act_interactivas
- Calidad: entrega_calidad

---

## API — endpoints principales

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
POST   /api/auth/change-password

GET    /api/my-workspace              # dashboard personalizado por rol
GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}
GET    /api/deliverables/{id}/flow    # flujo secuencial con rol activo
POST   /api/activities/{id}/quick-action  # deliver|approve|request_adjustments|reject

GET    /api/deliverables/{id}/evidence    # evidencias agrupadas por rol
POST   /api/role-activities/{id}/evidence
DELETE /api/evidence/{id}

GET    /api/notifications
GET    /api/notifications/unread-count
POST   /api/notifications/{id}/read
POST   /api/notifications/read-all

GET    /api/calendar-events?year=2026
GET    /api/calendar/my-deliverables

GET    /api/reports/dashboard
GET    /api/reports/compliance

GET    /api/import/template           # descarga plantilla CSV
POST   /api/import/deliverables       # importar CSV

GET    /api/export/projects?format=csv
GET    /api/export/deliverables?project_id=X&format=csv
```

---

## Permisos por rol (sidebar y acceso)

| Módulo | Admin | Coordinator | Operativos |
|--------|-------|-------------|------------|
| Dashboard | ✓ (global) | ✓ (global) | ✓ (personal) |
| Mi Espacio | — | — | ✓ |
| Proyectos | ✓ | ✓ | — |
| Programas | ✓ | ✓ | — |
| Entregables | ✓ | ✓ | — |
| Calendario | ✓ | ✓ | ✓ |
| Usuarios | ✓ | — | — |
| Reportes | ✓ | ✓ | — |
| Configuración | ✓ | — | — |

---

## Estado actual del desarrollo (26/06/2026)

### ✅ Completado y funcionando

**Iteración base (hasta 05/06/2026):**
- Dashboard operativo rediseñado: 4 KPIs (Pendientes, En Proceso, Vencidas, % Avance) + tarjetas de prioridad con click → /mi-espacio
- Dashboard admin/coordinador rediseñado: KPIs ejecutivos, avance por programa (barras CSS), distribución por estado, análisis de flujo/cuellos de botella, ranking de programas
- Backend: endpoint /reports/dashboard extendido con programs_breakdown y activities_by_role_detail
- Autenticación completa (login, logout, recuperar contraseña, cambiar contraseña)
- Dashboard admin (stats globales + tabla proyectos)
- Dashboard operativo (6 tarjetas + tabla pendientes + acciones rápidas + toast)
- Detalle de proyecto: tabla tipo Excel agrupada por programa, colapsable
- Panel lateral con 4 tabs: Info | Flujo | Evidencias | Comentarios
- Flujo visual secuencial (DeliverableFlow)
- Chat de comentarios (CommentThread)
- Panel de evidencias/links por rol (EvidencePanel)
- Calendario mensual con festivos Colombia 2025-2027
- Notificaciones internas (campana en header)
- Importación masiva CSV + plantilla descargable
- Exportación CSV proyectos y entregables
- Sistema de permisos por rol (sidebar dinámico)
- Todos los estados en español (20 estados)
- Indicadores de fecha verde/amarillo/rojo (DateStatusBadge)
- Próximo responsable visible (NextResponsibleCard)
- WorkingDayService: cálculo de días hábiles saltando festivos
- Auditoría automática de cambios (AuditObserver)

**Iteración evolución 2026 (junio 2026):**
- **Línea de tiempo cross-rol** (`DeliverableTimelineView`): historial unificado por entregable con eventos de creación, asignación, cambios de estado y entregas
- **Producción N/A por recurso**: toggle "No aplica" en `QuickProductionGrid` — persiste en BD (`production_not_applicable`), evita bloqueo de entrega cuando no hay producción que registrar
- **Mi Espacio mejorado**: save sticky, filtrado de timeline, pestaña Evidencias con historial completo por rol, ordenamiento por date_status como criterio primario
- **Observer `RoleActivityObserver`**: auto-asigna `not_applicable` al crear/quitar responsable; resetea a `not_started` al reasignar. Corrige bug donde el restablecimiento de responsable no cambiaba el estado visual
- **Dashboard filtros avanzados** (Admin/Coordinador): FilterBar con 5 dimensiones — programa, responsable, rol, año, mes. Aplica a TabSeguimiento (Gantt) y TabProduccion. Badge con conteo de filtros activos + botón "Limpiar filtros"
- **Página Entregables — 5 correcciones**:
  - Progreso mostraba 0% aun con entregas: `calcProgressExcNA` ahora cuenta `delivered|in_review|with_observations|approved`
  - Tab Info: añadidos campos Programa, Asignatura, Módulo/Semana, Fecha estimada fin
  - Botón "Entregar" funcionando con `getDeliverableActivity` (busca `in_development` → `not_started`)
  - Botón "Aprobar" funcionando con `getApprovableActivity` (busca `delivered|in_review|with_observations`)
  - Reasignación de responsable actualiza visual inmediatamente (respuesta del PUT + `loadData()`)
  - Botón "Comentarios" redundante eliminado del panel de acciones rápidas

### 🔲 Pendiente / Próximas iteraciones
- Exportación a PDF
- Subida real de archivos (actualmente solo URLs externas)
- Notificaciones por correo electrónico (SMTP configurado, solo loggea en dev)
- Vista Kanban
- Módulo sandbox para capacitación
- Despliegue en servidor (VPS / Docker)
- Integración con PostgreSQL para producción
- Modo recuperación de contraseña con SMTP real
- Gestión de plantillas de correo desde admin
- Eventos de evidencia en línea de tiempo
- Enriquecer payload de notificaciones (proyecto, nombre responsable, fecha real)

---

## Notas importantes para retomar

1. **El token de API** se guarda en `localStorage` bajo la clave `sergestiona_token`
2. **El unwrap automático** de `{data:[]}` está en `lib/api.ts` función `unwrap()` — solo se aplica en `api.get()`, no en `api.post/put`
3. **La migración** `add_excel_fields` fue renombrada a timestamp `230100` para ejecutarse después de `create_deliverables` (`230005`)
4. **SQLite** no tiene el módulo `intl` de PHP — el comando `php artisan db:show --counts` falla. Usar tinker para contar registros
5. **CORS** está configurado para `http://localhost:3000` en `config/cors.php`
6. **Los festivos** de Colombia ya están en BD para 2025, 2026 y 2027 — no re-sembrar sin limpiar primero

---

## Último commit

```
ffd50c6 fix(backend): resetear not_applicable a not_started al reasignar responsable
b9bc158 fix(entregables): garantizar actualización visual tras reasignación de responsable
031497c fix(entregables): progreso, info-tab, botón Entregar, responsable visual
eddf1e8 feat(dashboard): filtros por programa, responsable, rol, año y mes
89943a7 refactor(mi-espacio): N/A por recurso, save sticky, timeline filtrado
21d48cd feat(iter2): mejoras funcionales – lotes 1-3
943e301 feat(timeline): línea de tiempo cross-rol por entregable
```

Rama activa: `main`

## Observers activos

| Observer | Archivo | Evento |
|----------|---------|--------|
| `RoleActivityObserver` | `app/Observers/RoleActivityObserver.php` | `creating` → `not_applicable` si sin responsable; `updating` → `not_applicable` al quitar / `not_started` al reasignar |
| `AuditObserver` | `app/Observers/AuditObserver.php` | Registra en `audit_logs` todo cambio de campo en modelos monitoreados |

## Funciones clave de lógica de negocio (frontend)

| Función | Ubicación | Qué hace |
|---------|-----------|----------|
| `calcProgressExcNA` | `entregables/page.tsx` | Calcula % excluyendo actividades `not_applicable` |
| `getDeliverableActivity` | `entregables/page.tsx` | Encuentra actividad entregable: primero `in_development`, luego `not_started` |
| `getApprovableActivity` | `entregables/page.tsx` | Encuentra actividad aprobable: `delivered|in_review|with_observations|adjustments_requested` |
| `getActiveActivity` | `entregables/page.tsx` | Actividad genérica activa (para solicitar ajustes) |
| `calcProgressExcNA` | `mi-espacio/page.tsx` | Misma lógica aplicada en Mi Espacio |
