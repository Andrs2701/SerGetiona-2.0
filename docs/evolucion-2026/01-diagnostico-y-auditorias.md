# Evolución Funcional 2026 — Diagnóstico Arquitectónico y Auditorías

> Generado: 10/06/2026. Verificado contra el código real del repositorio.
> Cubre entregables: 1 (Diagnóstico arquitectónico), 2 (Auditoría de módulos), 3 (Auditoría de roles y permisos), 4 (Análisis de impacto), 5 (Gap Analysis del dashboard).

---

## 1. Diagnóstico arquitectónico

### Stack confirmado
- **Backend:** Laravel 12 + PHP 8.2, SQLite (`backend/database/database.sqlite`), Sanctum (token Bearer en localStorage `sergestiona_token`).
- **Frontend:** Next.js 16 + TypeScript + Tailwind. Sin librerías de gráficos (charts en CSS puro, convención del proyecto). `@tanstack/react-table` y `lucide-react` ya instalados.
- **Despliegue:** Render (`render.yaml`). **⚠️ Sin disco persistente** — ver riesgo R-INFRA-1.

### Convenciones del codebase (a respetar en toda extensión)
- Autorización: middleware `role:` (alias de `App\Http\Middleware\CheckRole`, registrado en `bootstrap/app.php:16`) + checks inline en controladores. **No hay Policies ni Gates.**
- Validación inline con `$request->validate()` (no FormRequests).
- Respuestas JSON planas (sin API Resources). `frontend/lib/api.ts` hace unwrap de `{data}` **solo en GET**.
- Servicios estáticos (`NotificationService`, `WorkingDayService`).
- `AuditLog` escrito manualmente en los controladores que mutan datos.
- Labels en español centralizados en `frontend/lib/types.ts`.

### Modelo de datos actual
```
Project → AcademicProgram → Subject → Deliverable → RoleActivity (×6 roles)
```
- `users.role` (enum): `admin, coordinator, expert, pedagogy, design, audiovisual, engineering, qa`.
- `RoleActivity`: role, responsible_id, assigned_by, commitment_date, actual_start_date, actual_delivery_date, status (string, 20 estados), checklist JSON, notes.
- `ROLE_CHAIN` operativo (`expert→pedagogy→design→audiovisual→engineering→qa`) duplicado en `DeliverableController`, `WorkspaceController`, `RoleActivityController` y `DatabaseSeeder`.
- Volumen actual: 8 usuarios, 3 proyectos, 4 programas, ~12 asignaturas, 45 entregables, 270 role_activities.

### Brechas (lo que NO existe hoy)
| Brecha | Impacto en nuevas funcionalidades |
|---|---|
| Sin tabla de configuración/settings | Bloquea complejidad parametrizable y fórmula de salud configurable |
| Sin campos de complejidad/esfuerzo/capacidad | Bloquea módulo de capacidad |
| Sin registro de decisiones | F7 requiere tabla nueva |
| Comentarios solo por `deliverable_id` (no polimórficos) | F6 requiere canales nuevos (NO migrar comments) |
| Sin preferencias de usuario | F4 (selector de vista) requiere tabla nueva |
| Sin snapshots históricos de carga | Tendencias requieren tabla `capacity_snapshots` |
| Sin Policies/Gates, 13 endpoints sin check de rol | Hardening previo obligatorio (Fase 1) |

---

## 2. Auditoría de roles y permisos

### Inventario de roles (valores literales en BD)
Fuente: `backend/database/migrations/2026_06_04_230001_add_fields_to_users_table.php:12`.

| Rol | Tipo | Acceso a capacidad/gerencial |
|---|---|---|
| `admin` | Gerencial | ✓ total + configuración |
| `coordinator` | Gerencial | ✓ visibilidad global |
| `expert`, `pedagogy`, `design`, `audiovisual`, `engineering`, `qa` | Operativo | ✗ solo sus actividades |

### Mecanismo de enforcement existente
- `CheckRole` middleware (`backend/app/Http/Middleware/CheckRole.php`) → 403 JSON. Usado en: projects CUD, calendar-events CUD, users (admin).
- Checks inline: `ProjectController::index` y `DeliverableController::index` filtran por `responsible_id` para `OPERATIONAL_ROLES`; `WorkspaceController` enruta admin vs operativo; `ReportController::workload` ya exige admin/coordinator inline.
- Frontend: `Sidebar.tsx` filtra `ALL_NAV_ITEMS` por rol (solo oculta links, no protege páginas).

### Huecos críticos detectados (corregidos en Fase 1)
| # | Endpoint | Riesgo |
|---|---|---|
| 1 | `GET /reports/dashboard` | Operativos ven datos globales |
| 2 | `GET /reports/compliance` | Operativos ven cumplimiento global |
| 3 | `GET /calendar/all-activities` | Operativos ven cronograma completo |
| 4 | `programs` apiResource (CUD) | Operativos pueden crear/editar/borrar programas |
| 5 | `subjects` apiResource (CUD) | Ídem asignaturas |
| 6 | `deliverables` POST/PUT/DELETE | Ídem entregables |
| 7 | `PUT /activities/{id}` | Un operativo puede modificar actividades de otro |
| 8 | `POST /activities/{id}/quick-action` | Ídem cambio de estado ajeno |
| 9 | `POST /import/deliverables` | Operativos pueden importar masivamente |
| 10 | `DELETE /evidence/{link}` | Cualquiera borra evidencia ajena |
| 11 | `GET /export/*` | Operativos exportan datos globales |

### Matriz Rol × Funcionalidad nueva
| Rol | Funcionalidades actuales | Impacto de la evolución | Ajustes requeridos |
|---|---|---|---|
| Administrador | Acceso total | Gana: capacidad, salud, decisiones, colaboración, resumen ejecutivo, **configuración de complejidad y umbrales** | Ninguno: siempre incluido en `role:admin,coordinator` y `role:admin` |
| Coordinador | Visibilidad operativa global | Gana: capacidad, salud, decisiones, colaboración, resumen ejecutivo. NO configura complejidad/umbrales (solo admin) | Ninguno sobre lo existente |
| Operativos (6 roles) | Mi Espacio, dashboard personal, calendario, sus actividades | Ganan: colaboración/menciones. **Pierden accesos que nunca debieron tener** (endpoints sin protección). Su UI NO llama esos endpoints → sin impacto visible | Guards de ownership preservan: editar su actividad, quick-action propia y de revisión en cadena, borrar su evidencia |

Validación explícita:
- **Administrador conserva acceso total** — todo middleware nuevo lo incluye.
- **Coordinador conserva visibilidad operativa global** — incluido en todos los grupos `role:admin,coordinator`.
- **Operativos mantienen únicamente lo asignado** — confirmado por mapeo frontend→endpoint: ningún componente operativo llama a los endpoints restringidos.
- **Nadie gana privilegios no autorizados** — la capacidad/comparativos/métricas de equipo viven exclusivamente bajo `role:admin,coordinator`, enforcement en backend (middleware), frontend (Sidebar + render condicional) y API.

---

## 3. Matriz de impacto (análisis de compatibilidad)

| Módulo afectado | Cambio | Riesgo | Nivel | Mitigación | Pruebas |
|---|---|---|---|---|---|
| `routes/api.php` | Rutas nuevas + middleware en existentes | Restringir un endpoint usado por UI operativa | Alto | Mapeo frontend→endpoint completado: ninguna llamada operativa a los endpoints restringidos; guards de ownership donde sí los usan | `AuthorizationMatrixTest`, checklist O3/M4 |
| `RoleActivityController` | Guard de ownership en update/quickAction | Romper flujo de revisión en cadena (pedagogy aprueba a expert) | Alto | Guard permite: admin/coord, responsable, y responsable del rol siguiente en cadena | `ActivityOwnershipTest`, checklist Q1–Q4 |
| `deliverables` (tabla) | + `complexity_level_id` nullable | Datos existentes (45) sin valor | Bajo | Nullable + default de puntos vía settings | `ComplexityLevelTest` (caso NULL) |
| `users` (tabla) | + `weekly_capacity_points` nullable | Ninguno | Bajo | Nullable, default global por setting | `CapacityReportTest` |
| `ReportController::dashboard` | Sin cambios de contrato (las secciones nuevas comen de endpoints nuevos) | Romper dashboard admin/programas | Medio | No se toca el JSON existente | `DashboardExtensionTest` (snapshot de claves) |
| `CommentController::store` | + 3 líneas (MentionParser::record) | Romper notificación existente al experto | Bajo | Cambio aditivo al final del método | `MentionNotificationTest` |
| Dashboard ejecutivo frontend | Secciones nuevas insertadas, KPIs intactos | Regresión visual/datos | Bajo | Cambios aditivos en `page.tsx`, fetch con `.catch` | Checklist D1–D5 |
| `comments` (tabla) | **CERO cambios** (canales en tablas nuevas) | — | Nulo | Decisión de diseño: no generalizar con morphs | — |
| BD producción | Solo `ADD COLUMN` nullable + tablas nuevas | SQLite frágil con ALTER complejos | Bajo | Nunca `->change()` ni renames; `migrate` (no fresh) probado sobre BD poblada | Plan de migración §doc 03 |

### Riesgos de infraestructura
- **R-INFRA-1 (CRÍTICO):** `render.yaml` no define `disk:` y el contenedor ejecuta `migrate --force && db:seed --force` en cada arranque → **la BD se regenera en cada deploy/restart**. Antes de que Decisiones/Preferencias/Colaboración guarden datos reales: plan con disco persistente, `DB_DATABASE` apuntando al disco, seed condicional (solo BD vacía). Acción del propietario de la cuenta Render.
- **R-INFRA-2:** Bugs preexistentes detectados (no introducidos por esta evolución): `lib/api.ts` define rutas inexistentes (`/academic-programs`, `/role-activities/{id}` PUT, `/projects/{id}/deliverables`, `/projects/{id}/audit`) → el detalle de proyecto cae a datos MOCK y el cambio de estado desde Mi Espacio devuelve 404; `ImportModal.tsx:68` hardcodea `http://localhost:8000`. Se corrigen los dos de impacto directo (ROLE_ACTIVITY e ImportModal) en Fase 1.

---

## 4. Gap Analysis — Dashboard Ejecutivo

### Inventario actual (en `app/(dashboard)/page.tsx`, componente `DashboardAdmin`)
| Widget existente | Fuente |
|---|---|
| KPIs ejecutivos (Proyectos Activos, Programas, Entregables, % Avance) | `GET /reports/dashboard` |
| Anillo de cumplimiento global (CSS) | ídem |
| Avance por programa (barras CSS, `programs_breakdown`) | ídem |
| Distribución por estado | ídem |
| Análisis de flujo / cuellos de botella por rol (`activities_by_role_detail`) | ídem |
| Tabla de carga de trabajo | `GET /reports/workload` |
| SlidingPanel de detalle (vencidos, etc.) | `GET /reports/compliance` |

### Faltantes → se agregan (sin tocar lo existente)
| Indicador nuevo | Fuente nueva |
|---|---|
| Capacidad operativa global (total/utilizada/disponible/% utilización) | `GET /capacity` (resumen) |
| Capacidad por rol | `GET /capacity/by-role` |
| Top sobrecarga / Top disponibilidad | `GET /capacity` (orden por utilización) |
| Tendencias semanal/mensual | `GET /capacity/trends` |
| Salud por proyecto (verde/amarillo/rojo) + salud de portafolio | `GET /reports/health` |
| Alertas ejecutivas (proyectos rojos, equipos sobrecargados, vencidos) | `GET /reports/executive-summary` |

Conclusión del Gap Analysis: **no se crea un dashboard nuevo**; se insertan dos secciones (Salud de Proyectos, Capacidad del Equipo) entre las KPI cards y `programs_breakdown`, con link «Ver todo» a `/capacidad`.
