# Evolución Funcional 2026 — Diseño Funcional y Técnico

> Cubre entregables: 6 (Diseño funcional), 7 (Diseño técnico), 8 (Modelo de datos), 9 (Backend), 10 (Frontend), 11 (Seguridad), 12 (Permisos), 16 (Open Source).
> Principios: SOLID, modularidad, bajo acoplamiento, **estrategia de ampliación funcional controlada** — solo adiciones, cero modificaciones de contrato existente.

---

## 1. Modelo de datos (migraciones nuevas, todas aditivas)

| Migración | Contenido |
|---|---|
| `create_complexity_levels_table` | `name` (unique), `points` (unsignedSmallInteger), `is_active` (bool, true), `sort_order`, timestamps. Seed idempotente: Baja=1, Media=3, Alta=5, Crítica=8 |
| `add_complexity_level_id_to_deliverables_table` | FK nullable `nullOnDelete` + índice. **Decisión:** la complejidad es propiedad del entregable (el contenido), no de cada paso del flujo; los 45 existentes quedan NULL y usan el default de settings |
| `add_weekly_capacity_points_to_users_table` | `unsignedSmallInteger` nullable. NULL ⇒ setting `capacity.default_weekly_points` |
| `create_system_settings_table` | `key` (unique), `value` (string), `label`, `group` (index). Un solo mecanismo de configuración para salud + capacidad. Helper cacheado `SystemSetting::num()` |
| `create_decision_records_table` | decision_date, project_id (FK nullable), academic_program_id (FK nullable), description, responsible_id (FK nullable), status (pending/in_progress/implemented/cancelled), impact (low/medium/high), observations, created_by. Índice `(status, decision_date)` |
| `create_channels_table` | name, type (general/project/program), project_id/academic_program_id FK nullable, created_by, is_archived |
| `create_channel_members_table` | channel_id, user_id, last_read_at. Unique `(channel_id, user_id)` |
| `create_channel_messages_table` | channel_id, user_id, parent_id (self FK), content, created_at (patrón de `comments`: sin updated_at). Índice `(channel_id, created_at)` |
| `create_mentions_table` | user_id (mencionado), source_type ('comment'/'channel_message'), source_id, mentioned_by, created_at. Sirve a comentarios Y mensajes sin tocar `comments` |
| `create_user_preferences_table` | user_id unique, `data` JSON (`{portfolio_view: 'cards'|'table'}`) |
| `create_capacity_snapshots_table` | snapshot_date, user_id, role, active_points, active_activities, capacity_points, utilization_pct, overdue_count. Unique `(snapshot_date, user_id)` |

**Decisión clave (colaboración):** NO se generaliza `comments` con morphs — tiene FK dura en producción y consumidores activos (`CommentThread`, flujo de entregables). Tablas nuevas = cero líneas tocadas del código en producción.

**Decisión clave (tendencias):** snapshots semanales lazy (se crean al consultar capacidad si falta el de la semana) + comando `php artisan capacity:snapshot` para cron futuro. El estado pasado es irreconstruible desde `role_activities`; el volumen (~500 filas/año) es trivial.

Settings sembrados: `health.weight_overdue=35`, `health.weight_deliverable_delay=25`, `health.weight_team_overload=20`, `health.weight_schedule_deviation=20`, `health.threshold_yellow=80`, `health.threshold_red=60`, `capacity.default_weekly_points=10`, `capacity.default_points=3`, `capacity.threshold_high=80`, `capacity.threshold_overload=100`.

---

## 2. Servicios backend (estáticos, patrón existente)

### `CapacityService`
- `active_points(usuario)` = Σ puntos de complejidad de sus actividades **exigibles esta semana**: `status NOT IN ('approved','not_applicable')` y `commitment_date <= fin de la semana actual` (las vencidas siguen contando hasta entregarse). Horizonte semanal porque la capacidad es semanal — contar todo el backlog futuro daría utilizaciones >800% sin significado.
- Puntos por actividad = `deliverable.complexityLevel.points` (si activo) o `capacity.default_points`.
- `utilization_pct = active_points / capacity_points × 100`. Estado: `ok` <80, `high` 80–100, `overloaded` >100 (umbrales por settings).
- `forUser / allUsers / byRole / global / trend(weeks) / ensureWeeklySnapshot`.
- Implementación: una sola query con eager loading, agregación en memoria (patrón de `ReportController::workload`).

### `HealthService`
`score = max(0, 100 − Σ peso_i × factor_i)`, factores normalizados 0–1:
| Factor (key en settings) | Definición |
|---|---|
| `overdue` | actividades vencidas / activas del proyecto |
| `deliverable_delay` | entregables con ≥1 actividad vencida / entregables no terminados |
| `team_overload` | usuarios sobrecargados con actividades en el proyecto / usuarios del proyecto |
| `schedule_deviation` | min(1, prom. días hábiles de retraso de entregas tardías / 10) |

`level`: green ≥ `health.threshold_yellow`, yellow ≥ `health.threshold_red`, red < eso. Pesos y umbrales 100% configurables por admin (peso 0 desactiva el factor). Devuelve `factors[]` con desglose para la UI.

### `ReassignmentService`
`suggestionsFor(activity)`: usuarios activos del **mismo rol**, excluyendo al responsable actual, ordenados por utilización asc (desempate: vencidas asc), con `utilization_after` simulada. **Nunca escribe** — la reasignación la ejecuta el coordinador vía `PUT /activities/{id}` existente (que ya notifica).

### `ExecutiveSummaryService` + canales
- `build()`: portafolio (salud + capacidad global + cumplimiento + vencidas), proyectos con score, alertas (`overload`, `project_red`, `overdue_spike`), decisiones pendientes.
- `send(channelKeys)`: itera implementaciones de `NotificationChannelInterface` (`app/Services/Channels/`). Hoy: `InternalChannel` (delega en `NotificationService`). Correo/Teams/Slack/WhatsApp = una clase nueva cada uno, sin tocar el resto.

### `MentionParser`
Token canónico en texto plano (sin HTML, sin XSS): `@[Nombre](user:12)` / `@[Diseño](role:design)`.
`parse / resolveUserIds (roles→usuarios activos, excluye autor) / record (persiste mentions + notifica) / toPlainText`.
Integración: una llamada al final de `CommentController::store` y en `ChannelMessageController::store`.

---

## 3. API — rutas nuevas y permisos

```
# Autenticados (todos los roles)
GET    /complexity-levels                      # dropdowns
GET|PUT /me/preferences
GET    /me/mentions
GET|POST /channels ; GET|POST /channels/{id}/messages
POST   /channels/{id}/read ; POST /channels/{id}/members
PUT    /channels/{id}                          # role:admin,coordinator

# Gerencial — middleware role:admin,coordinator (grupo)
GET /capacity ; GET /capacity/by-role ; GET /capacity/trends
GET /activities/{id}/reassignment-suggestions
GET /reports/health ; GET /projects/{id}/health
GET /reports/executive-summary
apiResource /decisions

# Solo admin — middleware role:admin (grupo)
POST|PUT|DELETE /complexity-levels             # delete bloquea si está en uso → 409
GET|PUT /settings                              # ?group=health|capacity
```

Las respuestas usan claves raíz propias (`users`, `roles`, `series`, `channels`…) — nunca `data` — para que el unwrap de `lib/api.ts` no interfiera.

### Hardening de endpoints existentes (Fase 1)
| Endpoint | Fix |
|---|---|
| `reports/dashboard`, `reports/compliance`, `reports/workload`, `calendar/all-activities`, `import/*`, `export/*` | middleware `role:admin,coordinator` |
| `programs`, `subjects`, `deliverables` | apiResource partido: `only(['index','show'])` libre (los operativos leen entregables); `except(...)` con `role:admin,coordinator` |
| `PUT activities/{id}` | guard inline: admin/coord **o** responsable |
| `POST activities/{id}/quick-action` | guard inline: admin/coord, responsable, **o** responsable del rol siguiente en `ROLE_CHAIN` (el revisor aprueba/devuelve al rol anterior) |
| `DELETE evidence/{link}` | guard inline: admin/coord, autor del link, o responsable de la actividad |

---

## 4. Frontend

### Páginas nuevas
- `/capacidad` (admin/coordinator): resumen global, barras por usuario (top sobrecarga/disponibilidad), tabla por rol, tendencia semanal (barras CSS), SidePanel con actividades del usuario y sugerencias de reasignación.
- `/decisiones` (admin/coordinator): tabla TanStack + Modal de crear/editar, badges de estado/impacto.
- `/colaboracion` (todos): lista de canales con unread + hilo de mensajes con `MentionTextarea`.
- `/configuracion` (existente, admin): se agregan secciones «Niveles de complejidad» (CRUD) y «Parámetros de salud y capacidad» (form de settings).

### Componentes nuevos
`CapacityBar`, `HealthBadge`, `ReassignmentPanel`, `DecisionFormModal`, `ChannelList`, `MessageThread` (reusa estilos de `CommentThread` sin tocarlo), `MentionTextarea`. Reutilizados: `Modal`, `SidePanel`, `PageHeader`, `LoadingSkeleton`, `StatusBadge`.

### Sidebar (`ALL_NAV_ITEMS`, aditivo)
`/capacidad` y `/decisiones` → `['admin','coordinator']`; `/colaboracion` → todos los roles.

### Selector de vista de portafolio (F4)
Toggle Tabla/Tarjetas en `/proyectos`. **Fuente de verdad: BD (`user_preferences`), caché de arranque: localStorage** (hook `usePreference`: lee localStorage síncrono sin flash, reconcilia con `GET /me/preferences`, write-through en cambios). Vista Cronológica: la arquitectura queda preparada (el valor del preference admite `'timeline'`; sin implementación visual aún).

### Dashboard ejecutivo (extensión aditiva, ver Gap Analysis)
Dos fetch nuevos con `.catch(() => {})` + dos secciones nuevas. Los KPIs y secciones existentes no se tocan.

---

## 5. Seguridad (defensa en profundidad para información gerencial)

1. **API/Backend:** middleware `role:admin,coordinator` en grupo de rutas (primera línea); guards inline para ownership.
2. **Base de datos:** la información de capacidad no se materializa en tablas accesibles por endpoints operativos; snapshots solo se leen vía rutas gerenciales.
3. **Frontend:** Sidebar no muestra los módulos; las páginas gerenciales hacen render condicional por rol y los fetch fallan a 403 silencioso si se navega directo.
4. **Operativos:** siguen viendo únicamente sus actividades (`/my-workspace`, filtros por `responsible_id` ya existentes). Sin carga global, comparativos, métricas de equipo ni indicadores ejecutivos.

---

## 6. Open Source — justificación

**Recomendación: cero dependencias nuevas.**
| Necesidad | Evaluación | Decisión |
|---|---|---|
| Menciones | tribute.js (MIT) sin mantenimiento desde 2021, opera sobre contenteditable (riesgo XSS/conflicto React); react-mentions arrastra estilos propios | Implementación propia (~150 líneas, textarea + popover Tailwind, convención del proyecto) |
| Gráficos | recharts/chart.js innecesarios para barras semanales | CSS puro (convención ya establecida: `ProgressBar`, `GlobalRing`) |
| Tablas | — | `@tanstack/react-table` **ya instalado** — se reutiliza |
| Backend | Laravel 12 cubre scheduler, validación, JSON | Sin paquetes nuevos |

Beneficio: cero dependencias introducidas = cero riesgos de licencia/mantenimiento/cadena de suministro.

---

## 7. Fases de implementación (cada una desplegable sin regresiones)

1. **Hardening de seguridad** — solo rutas + guards. Sin migraciones.
2. **Fundaciones** — complejidad + settings + capacidad por usuario + UI de configuración.
3. **Capacidad operativa** — snapshots, servicios, `/capacidad`, reasignación.
4. **Salud + resumen ejecutivo + dashboard** — depende de 2 y 3 (factor team_overload).
5. **Registro de decisiones** — independiente tras Fase 1.
6. **Colaboración + menciones + preferencias + selector de vista** — mayor superficie nueva, nada depende de ella.
7. **Tests + verificación** — transversal (los tests de autorización se escriben con Fase 1).
