# Sergestiona 2.0

## Prompt maestro para IA

Actúa como arquitecto principal, analista funcional y coordinador de desarrollo de Sergestiona 2.0.

Tu misión es diseñar, construir y evolucionar una plataforma web empresarial para la gestión de producción de contenidos académicos virtuales, reemplazando por completo el uso operativo de archivos Excel.

La solución debe ser clara, trazable, colaborativa, escalable y fácil de validar localmente desde navegador.

## Prioridades

1. La prioridad absoluta es que el proyecto pueda ejecutarse localmente con pocos comandos.
2. Cada avance debe ser visible en navegador antes de considerarse terminado.
3. Toda funcionalidad debe validarse con datos de prueba realistas.
4. La trazabilidad, auditoría e historial no deben perderse nunca.
5. La arquitectura debe quedar preparada para crecimiento, despliegue y mantenimiento futuro.
6. La IA debe preservar el contexto general del producto en todo momento.

## Reglas de IA

### Coordinación con subagentes

La IA principal debe trabajar con múltiples subagentes especializados cuando sea necesario.

Objetivos de esta coordinación:

- Mantener el contexto global del proyecto.
- Evitar pérdida de foco.
- Dividir el trabajo por frentes sin fragmentar la visión general.
- Acelerar el desarrollo sin sacrificar coherencia.

Reglas de operación:

- El agente principal conserva siempre la visión global, la arquitectura y las decisiones finales.
- Los subagentes pueden encargarse de análisis, frontend, backend, pruebas, documentación, datos de prueba, arquitectura y validación.
- Cada subagente debe entregar resultados resumidos, accionables y trazables.
- La coordinación entre subagentes debe evitar duplicación de trabajo.
- Ningún subagente puede cambiar la dirección del proyecto por su cuenta.
- El agente principal debe consolidar los aportes antes de decidir.
- El uso de subagentes debe servir para proteger el contexto y mantener el foco del producto.

### Regla fundamental de desarrollo

Toda funcionalidad debe poder visualizarse y probarse localmente antes de considerarse terminada.

La IA nunca debe asumir que el sistema será desplegado de inmediato en producción.

Siempre debe priorizar:

- Desarrollo local.
- Visualización en navegador.
- Datos de prueba.
- Validación funcional.
- Despliegue posterior.

### Criterio de éxito inicial

El objetivo inicial del proyecto es que cualquier usuario pueda:

- Clonar el repositorio desde GitHub.
- Ejecutar unos pocos comandos.
- Visualizar Sergestiona 2.0 completamente funcional en su navegador local.

## Contexto del Producto

Sergestiona 2.0 es una plataforma web diseñada para gestionar el ciclo completo de producción de contenidos académicos virtuales.

Actualmente este proceso se realiza mediante múltiples archivos Excel donde se administran:

- Programas académicos.
- Asignaturas.
- Responsables.
- Fechas de entrega.
- Estados.
- Observaciones.

El objetivo de Sergestiona 2.0 es reemplazar ese proceso manual por una plataforma centralizada, intuitiva, colaborativa y trazable.

La plataforma debe permitir administrar:

- Proyectos.
- Programas académicos.
- Asignaturas.
- Entregables.
- Flujos de producción.
- Responsables.
- Estados.
- Comentarios.
- Evidencias.
- Métricas de cumplimiento.

## Problema Actual

La operación actual presenta los siguientes problemas:

- Dependencia de archivos Excel.
- Información distribuida en múltiples hojas.
- Ausencia de trazabilidad histórica.
- Dificultad para identificar responsables.
- Seguimiento manual de fechas.
- Poca visibilidad del estado real de los entregables.
- Falta de auditoría.
- Dificultad para generar reportes consolidados.
- Ausencia de indicadores automáticos de cumplimiento.

## Objetivo del Producto

Construir una plataforma que permita:

- Gestionar programas académicos.
- Gestionar asignaturas.
- Gestionar proyectos académicos.
- Gestionar entregables.
- Gestionar flujos de producción.
- Gestionar responsables.
- Gestionar fechas.
- Gestionar estados.
- Gestionar observaciones.
- Gestionar evidencias.
- Gestionar indicadores de cumplimiento.
- Gestionar auditoría completa.

## Filosofía del Producto

Sergestiona no es un gestor de tareas genérico.

Sergestiona es una plataforma especializada para la gestión de producción académica virtual.

Toda decisión funcional debe priorizar:

- Simplicidad.
- Productividad.
- Trazabilidad.
- Escalabilidad.
- Auditoría.
- Experiencia similar a Excel.

## Estructura Jerárquica

```text
Proyecto
 └── Programa Académico
      └── Asignatura
           └── Entregable
                └── Flujo de Producción
                     └── Actividades por Rol
```

## Ejemplo de Jerarquía

- Proyecto: Actualización Curricular 2026
- Programa: Especialización en Gestión del Bienestar Psicosocial Comunitario
- Asignatura: Análisis de Contextos y Determinantes Sociales y Ambientales
- Entregable: Semana 0
- Roles: Experto, Pedagogía, Diseño, Audiovisual, Ingeniería, Calidad

## Entidades Principales

### Proyecto

Representa una iniciativa académica.

Ejemplos:

- Actualización Curricular 2026.
- Creación de Programa.
- Ajuste de Contenidos.
- Control de Cambios.

Estados del proyecto:

- Borrador.
- Pendiente Parametrización.
- Parametrizado.
- En Ejecución.
- Suspendido.
- Finalizado.
- Cancelado.

### Programa Académico

Representa un programa institucional.

Ejemplos:

- Especialización en Gestión del Bienestar Psicosocial Comunitario.
- Maestría en Atención del Bienestar Psicosocial Comunitario.

### Asignatura

Pertenece a un programa.

Ejemplos:

- Fundamentos de la Atención Primaria.
- Procesos de Gestión Psicosocial.
- Intervención y Acción Comunitaria.

### Entregable

Representa una unidad de trabajo.

Ejemplos:

- Semana 0.
- Semana 1.
- Semana 2.
- Módulo 0.
- Módulo 1.
- Control de Cambios.

Cada entregable debe incluir:

- Fecha de inicio.
- Fechas objetivo por rol.
- Responsables.
- Estado.
- Evidencias.
- Comentarios.
- Historial.

## Tipos de Requerimiento

Cada entregable debe pertenecer a uno de estos tipos:

### Creación

Contenido nuevo.

Generalmente inicia sin fechas ni contenido.

Ejemplos:

- Módulo 0.
- Módulo 1.
- Módulo 2.

### Actualización

Contenido existente que requiere ajustes.

Ejemplos:

- Semana 0.
- Control de Cambios.
- Ajustes Curriculares.
- Roles del Sistema.

## Roles del Sistema

### Administrador

Permisos completos.

Puede:

- Crear usuarios.
- Editar usuarios.
- Desactivar usuarios.
- Crear proyectos.
- Crear programas.
- Crear asignaturas.
- Configurar flujos.
- Configurar estados.
- Configurar fechas.
- Configurar reglas.

### Coordinador

Responsable del seguimiento operativo.

Puede:

- Consultar proyectos.
- Consultar programas.
- Consultar asignaturas.
- Asignar responsables.
- Realizar seguimiento.
- Generar reportes.

### Experto Temático

Responsable de la construcción académica inicial.

### Pedagogo

Responsable de la validación pedagógica.

### Diseñador

Responsable de recursos gráficos.

### Audiovisual

Responsable de recursos audiovisuales.

### Ingeniero

Responsable de implementación técnica.

### QA / Calidad

Responsable de validación final.

## Flujo de Producción

Todos los procesos parten de la entrega del Experto Temático.

La fecha del experto es la fecha base del flujo.

A partir de ella se sugieren automáticamente las fechas de los demás roles.

Configuración inicial sugerida:

- Experto: fecha base.
- Pedagogía: +2 días.
- Diseño: +2 días.
- Audiovisual: +2 días.
- Ingeniería: +1 día.
- Calidad: +1 día.

Estas reglas no son fijas.

Deben ser parametrizables desde administración.

## Estados Globales del Entregable

- Sin Parametrizar.
- Pendiente Inicio.
- En Proceso.
- En Revisión.
- Con Observaciones.
- Finalizado.
- Cancelado.
- No Aplica.

## Estados por Rol

### Experto

- No Iniciado.
- Borrador.
- En Desarrollo.
- Entregado.
- Ajustes Solicitados.
- Aprobado.
- No Aplica.

### Pedagogía

- No Iniciado.
- En Curso.
- En Revisión.
- Ajustando.
- Aprobado.
- No Aplica.

### Diseño

- No Iniciado.
- Diseñando.
- Ajustando.
- Aprobado.
- No Aplica.

### Audiovisual

- No Iniciado.
- Producción.
- Edición.
- Aprobado.
- No Aplica.

### Ingeniería

- No Iniciado.
- Implementando.
- Validando.
- Aprobado.
- No Aplica.

### Calidad

- Pendiente.
- En Pruebas.
- Con Hallazgos.
- Aprobado.
- No Aplica.

Todos los estados deben ser administrables.

## Trazabilidad Obligatoria

Cada actividad debe almacenar:

- Responsable asignado.
- Fecha de asignación.
- Usuario que asignó.
- Fecha compromiso.
- Fecha inicio real.
- Fecha entrega real.
- Estado actual.
- Historial de estados.
- Comentarios.
- Evidencias.

Nunca se debe sobrescribir información histórica.

Todo cambio debe registrarse.

## Auditoría

Cada modificación debe generar un registro.

Guardar:

- Usuario.
- Acción.
- Fecha.
- Hora.
- Valor anterior.
- Valor nuevo.
- Entidad afectada.

Ejemplos de eventos auditables:

- Cambio de responsable.
- Cambio de fecha.
- Cambio de estado.
- Carga de archivo.
- Eliminación lógica.

## Conversaciones

Cada entregable tendrá un hilo de conversación independiente.

Estructura:

```text
Entregable
 └── Comentarios
      └── Respuestas
```

Objetivos:

- Registrar observaciones.
- Solicitar ajustes.
- Resolver dudas.
- Mantener trazabilidad.

Los comentarios nunca se eliminan.

## Gestión Documental

Cada actividad podrá contener:

- Archivos.
- Evidencias.
- Versiones.

Debe existir historial de versiones.

## Indicadores Automáticos

El sistema debe calcular automáticamente:

### Cumplimiento por rol

Porcentaje de entregas realizadas.

### Cumplimiento por programa

Porcentaje consolidado.

### Cumplimiento por proyecto

Porcentaje consolidado.

### Entregas a tiempo

`fecha_entrega_real <= fecha_compromiso`

### Entregas tardías

`fecha_entrega_real > fecha_compromiso`

### Días de retraso

`fecha_entrega_real - fecha_compromiso`

### Productividad por usuario

Cantidad de entregables completados.

## Importación Masiva

Debe soportar:

- CSV.
- XLSX.

Debe permitir importar:

- Programas.
- Asignaturas.
- Entregables.
- Responsables.
- Fechas.
- Estados.

## Vista Principal

La interfaz principal debe estar basada en una tabla avanzada.

Inspiración:

- Excel.
- Airtable.
- Smartsheet.

Debe permitir:

- Filtros.
- Ordenamiento.
- Agrupación.
- Búsqueda.
- Exportación.

No utilizar Kanban como vista principal.

Kanban, Calendario y Gantt pueden existir como vistas secundarias.

## Arquitectura Recomendada

### Frontend

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- TanStack Table.

### Backend

- Laravel 12.
- PHP 8.4.
- Laravel Sanctum.

### Base de Datos

- PostgreSQL.

### Archivos

- S3 compatible storage.

### Notificaciones

- Correo electrónico.
- Notificaciones internas.

## Estrategia de Desarrollo y Despliegue

### Repositorio y control de versiones

Todo el desarrollo debe mantenerse bajo control de versiones mediante Git y GitHub.

La estructura del proyecto debe estar preparada para trabajo colaborativo y despliegues futuros.

Requisitos:

- Todo el código debe almacenarse en GitHub.
- Cada funcionalidad debe desarrollarse en ramas independientes.
- Utilizar Pull Requests para integrar cambios.
- Mantener documentación técnica actualizada dentro del repositorio.
- Mantener archivos de contexto del proyecto para facilitar el trabajo con IA.

### Entorno de desarrollo

Durante las etapas iniciales no se debe desplegar directamente en un servidor productivo.

La prioridad es disponer de un entorno local de desarrollo que permita:

- Visualizar cambios en tiempo real.
- Realizar pruebas funcionales.
- Realizar pruebas de usuario.
- Realizar pruebas de integración.
- Realizar pruebas de aceptación.
- Validar reglas de negocio.
- Ajustar la experiencia de usuario.

### Ejecución local obligatoria

La solución debe poder ejecutarse completamente en un navegador web local.

El sistema debe permitir:

- Levantar frontend localmente.
- Levantar backend localmente.
- Ejecutar base de datos localmente.
- Simular el entorno completo de producción.

La IA debe priorizar configuraciones que permitan ejecutar el proyecto mediante comandos simples de desarrollo.

Ejemplo:

```bash
npm install
npm run dev
```

Frontend disponible en:

`http://localhost:3000`

Backend disponible en:

`http://localhost:8000`

El objetivo es que cada avance pueda visualizarse inmediatamente desde el navegador sin necesidad de despliegues externos.

### Dockerización

La arquitectura debe estar preparada para ejecutarse mediante Docker.

Se recomienda incluir:

- Dockerfile para frontend.
- Dockerfile para backend.
- `docker-compose.yml`.
- PostgreSQL.
- Redis, si posteriormente es requerido.

Objetivo:

Permitir que cualquier desarrollador pueda levantar el proyecto completo con un único comando.

Ejemplo:

```bash
docker compose up -d
```

### Proceso de validación

Antes de cualquier despliegue a servidores se debe completar este ciclo:

1. Desarrollo local.
2. Pruebas unitarias.
3. Pruebas funcionales.
4. Pruebas de integración.
5. Pruebas de usuario.
6. Corrección de hallazgos.
7. Validación funcional.
8. Aprobación.
9. Despliegue.

No se debe desplegar ninguna funcionalidad sin pasar por este flujo.

### Datos de prueba

Durante el desarrollo se deben generar datos de prueba realistas.

La aplicación no debe desarrollarse utilizando únicamente pantallas vacías.

Debe existir información simulada para:

- Programas.
- Asignaturas.
- Entregables.
- Responsables.
- Estados.
- Comentarios.
- Evidencias.

Esto permitirá validar correctamente la experiencia de usuario.

### Modo sandbox

La plataforma debe contar con un entorno de pruebas o sandbox.

Objetivos:

- Probar configuraciones.
- Probar flujos.
- Probar parametrizaciones.
- Simular proyectos completos.
- Capacitar usuarios.

Los datos del sandbox no deben afectar los datos reales.

### Estrategia de despliegue futuro

Una vez finalizadas las pruebas locales y las validaciones funcionales, el sistema deberá estar preparado para desplegarse en infraestructura productiva.

La arquitectura debe diseñarse desde el inicio para facilitar:

- Despliegue en VPS.
- Despliegue en Docker.
- Despliegue en servicios cloud.
- Escalabilidad futura.

Sin embargo, durante la fase inicial del proyecto la prioridad absoluta es la visualización local y la validación funcional desde navegador.

## Requisitos No Funcionales

- Responsive.
- Auditoría completa.
- Escalable.
- Multiusuario.
- Permisos basados en roles.
- Tiempo de respuesta inferior a 2 segundos.
- Seguridad basada en RBAC.
- Eliminación lógica.
- Historial completo de cambios.

## Regla Final

La plataforma nunca debe comportarse como un simple gestor de tareas.

Debe comportarse como un sistema empresarial de gestión de producción académica, permitiendo trazabilidad completa desde la creación de un proyecto hasta la aprobación final de cada entregable.
