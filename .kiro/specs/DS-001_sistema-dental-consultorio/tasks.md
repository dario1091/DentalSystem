# Plan de Implementación — DS-001: Sistema Dental Consultorio

## Resumen de Fases

| Fase | Nombre | Tareas | Estimación |
|------|--------|--------|------------|
| 1 | Fundación del Proyecto | 6 | 2-3 días |
| 2 | Autenticación y Usuarios | 5 | 2 días |
| 3 | Módulo de Pacientes | 6 | 3 días |
| 4 | Módulo de Doctores | 4 | 1-2 días |
| 5 | Catálogo de Procedimientos | 4 | 1-2 días |
| 6 | Módulo de Citas / Agenda | 7 | 3-4 días |
| 7 | Odontograma | 6 | 4-5 días |
| 8 | Historia Clínica | 5 | 3 días |
| 9 | Documentos del Paciente | 5 | 2-3 días |
| 10 | Consentimientos Informados | 6 | 3-4 días |
| 11 | Facturación Básica | 5 | 2-3 días |
| 12 | Backup y Configuración | 4 | 2 días |
| 13 | Pulido, Testing y Empaquetado | 5 | 3-4 días |

**Total estimado:** 30-40 días de desarrollo

---

## Fase 1: Fundación del Proyecto

### Tarea 1.1: Scaffolding del proyecto Tauri v2 + React

**Requisitos previos:** Rust toolchain, Node.js 20+, pnpm

**Pasos:**
1. Inicializar proyecto con `pnpm create tauri-app` (React + TypeScript + Vite)
2. Configurar `tauri.conf.json` (nombre, identificador, permisos)
3. Verificar que `pnpm tauri dev` arranca correctamente
4. Inicializar repositorio Git con `.gitignore` apropiado

**Criterio de completitud:** La app arranca mostrando la pantalla default de Tauri con React.

---

### Tarea 1.2: Configurar Tailwind CSS 4 + estructura base frontend

**Pasos:**
1. Instalar `tailwindcss` y `@tailwindcss/vite`
2. Configurar `vite.config.ts` con plugin de Tailwind
3. Crear `src/styles/globals.css` con imports de Tailwind
4. Crear estructura de carpetas: `src/features/`, `src/shared/`, `src/store/`
5. Configurar alias de paths en `tsconfig.json` (`@features/`, `@shared/`, `@store/`)

**Criterio de completitud:** Tailwind funciona, clases utility se aplican correctamente en un componente de prueba.

---

### Tarea 1.3: Configurar SQLite con rusqlite en Tauri

**Pasos:**
1. Agregar `rusqlite` con feature `bundled` en `Cargo.toml`
2. Crear módulo `src-tauri/src/db/connection.rs` con función de inicialización
3. Definir ruta del archivo `.db` (junto al ejecutable o configurable)
4. Implementar función `initialize_db()` que crea el archivo si no existe
5. Registrar como estado manejado de Tauri (`app.manage()`)

**Criterio de completitud:** Al arrancar la app, se crea el archivo `dental_system.db` vacío.

---

### Tarea 1.4: Sistema de migraciones SQL

**Pasos:**
1. Crear módulo `src-tauri/src/db/migrations/mod.rs`
2. Implementar tabla `_migrations` para tracking de versiones aplicadas
3. Crear `v001_initial_schema.rs` con tablas: `settings`, `users`, `roles`
4. Implementar runner que aplica migraciones pendientes al arrancar
5. Logging de migraciones ejecutadas

**Criterio de completitud:** Al arrancar, se aplican migraciones pendientes y se crean las tablas iniciales.

---

### Tarea 1.5: Layout principal de la aplicación (Shell)

**Pasos:**
1. Crear `src/shared/components/layout/AppShell.tsx` — sidebar + header + content area
2. Crear `src/shared/components/layout/Sidebar.tsx` con navegación a módulos
3. Crear `src/shared/components/layout/Header.tsx` con usuario logueado + logout
4. Instalar `react-router-dom` y configurar rutas base en `App.tsx`
5. Crear páginas placeholder para cada módulo

**Criterio de completitud:** Navegación funcional entre módulos con sidebar, todas las rutas responden con placeholder.

---

### Tarea 1.6: Componentes UI base (Design System mínimo)

**Pasos:**
1. Crear `src/shared/components/ui/Button.tsx` (variantes: primary, secondary, danger, ghost)
2. Crear `src/shared/components/ui/Input.tsx` (text, number, date, select)
3. Crear `src/shared/components/ui/Modal.tsx` (dialog con overlay)
4. Crear `src/shared/components/ui/Table.tsx` (con sorting y paginación básica)
5. Crear `src/shared/components/ui/Toast.tsx` (notificaciones)
6. Crear `src/shared/components/ui/Badge.tsx` (estados con color)
7. Instalar `lucide-react` para iconos

**Criterio de completitud:** Componentes reutilizables documentados con props tipadas. Storybook NO requerido.

---

## Fase 2: Autenticación y Usuarios

### Tarea 2.1: Modelo de datos de usuarios y migración

**Pasos:**
1. Crear migración `v002_auth_tables.rs` con tablas `users` y `audit_log`
2. Insertar usuario master por defecto (username: `admin`, password temporal)
3. Implementar struct `User` en `src-tauri/src/models/user.rs`

**Criterio de completitud:** Tablas creadas con usuario admin seed.

---

### Tarea 2.2: Servicio de autenticación (backend Rust)

**Pasos:**
1. Agregar dependencia `argon2` en `Cargo.toml`
2. Crear `src-tauri/src/services/auth_service.rs`
3. Implementar: `hash_password()`, `verify_password()`, `login()`, `logout()`
4. Implementar bloqueo por intentos fallidos
5. Implementar cambio de contraseña obligatorio en primer login
6. Manejar sesión como estado en memoria de Tauri

**Criterio de completitud:** Login/logout funcional con hash Argon2id y bloqueo por intentos.

---

### Tarea 2.3: Tauri commands de autenticación

**Pasos:**
1. Crear `src-tauri/src/commands/auth.rs`
2. Implementar commands: `login`, `logout`, `change_password`, `get_current_user`
3. Crear middleware/guard que verifica sesión activa en otros commands
4. Registrar commands en `lib.rs`

**Criterio de completitud:** Commands invocables desde frontend con verificación de sesión.

---

### Tarea 2.4: Pantalla de Login (frontend)

**Pasos:**
1. Crear `src/features/auth/pages/LoginPage.tsx`
2. Formulario: username + password + botón login
3. Manejo de errores (credenciales inválidas, cuenta bloqueada)
4. Redirección a cambio de contraseña si es primer login
5. Crear `src/features/auth/pages/ChangePasswordPage.tsx`

**Criterio de completitud:** Login funcional end-to-end. Primer login fuerza cambio de contraseña.

---

### Tarea 2.5: CRUD de usuarios (solo Master)

**Pasos:**
1. Crear commands: `create_user`, `update_user`, `deactivate_user`, `list_users`
2. Crear `src/features/auth/pages/UsersListPage.tsx`
3. Crear formulario de creación/edición de usuario con asignación de rol
4. Validar que solo el rol Master puede acceder a esta sección
5. Implementar log de auditoría para acciones de usuario

**Criterio de completitud:** Master puede crear usuarios con roles Doctor/Auxiliar. Roles restringen acceso.

---

## Fase 3: Módulo de Pacientes

### Tarea 3.1: Migración y modelo de pacientes

**Pasos:**
1. Crear migración `v003_patients.rs` con tabla `patients`
2. Implementar struct `Patient` y `CreatePatientDto` en `src-tauri/src/models/patient.rs`
3. Crear `src-tauri/src/db/repositories/patient_repo.rs` con queries CRUD
4. Implementar soft delete (campo `is_active`)

**Criterio de completitud:** Repository con funciones create, read, update, deactivate, search.

---

### Tarea 3.2: Tauri commands de pacientes

**Pasos:**
1. Crear `src-tauri/src/commands/patients.rs`
2. Implementar commands: `create_patient`, `update_patient`, `get_patient`, `search_patients`, `deactivate_patient`
3. Validación de documento único
4. Verificación de permisos por rol
5. Registro en audit_log

**Criterio de completitud:** Commands funcionales con validación y auditoría.

---

### Tarea 3.3: Lista de pacientes (frontend)

**Pasos:**
1. Crear `src/features/patients/pages/PatientListPage.tsx`
2. Tabla con columnas: nombre, documento, teléfono, estado, última cita
3. Barra de búsqueda (por nombre, documento o teléfono)
4. Filtro activos/inactivos
5. Botón "Nuevo Paciente"
6. Paginación

**Criterio de completitud:** Listado con búsqueda funcional conectado al backend.

---

### Tarea 3.4: Formulario de paciente (crear/editar)

**Pasos:**
1. Crear `src/features/patients/pages/PatientFormPage.tsx`
2. Secciones: datos personales, contacto, datos de salud, acudiente
3. Checkbox de autorización de datos personales (Ley 1581)
4. Validación de campos obligatorios
5. Modo creación y edición reutilizando el mismo form

**Criterio de completitud:** Crear y editar pacientes con validación completa.

---

### Tarea 3.5: Detalle del paciente (vista consolidada)

**Pasos:**
1. Crear `src/features/patients/pages/PatientDetailPage.tsx`
2. Tabs o secciones: Datos generales | Odontograma | Historia Clínica | Documentos | Citas | Cuenta
3. Resumen rápido: última cita, saldo pendiente, foto
4. Navegación a cada sub-módulo del paciente

**Criterio de completitud:** Vista de detalle con navegación a todos los módulos del paciente.

---

### Tarea 3.6: Exportación de ficha de paciente a PDF

**Pasos:**
1. Implementar generación de PDF en `src-tauri/src/services/pdf_generator.rs`
2. Template de ficha: datos personales + foto + resumen de salud
3. Command `export_patient_pdf` que genera y devuelve ruta del archivo
4. Botón en la vista de detalle del paciente

**Criterio de completitud:** PDF generado con datos del paciente, descargable desde la UI.

---

## Fase 4: Módulo de Doctores

### Tarea 4.1: Migración y modelo de doctores

**Pasos:**
1. Crear migración `v004_doctors.rs` con tabla `doctors`
2. Implementar struct `Doctor` en `src-tauri/src/models/doctor.rs`
3. Crear repository con CRUD + validación de registro profesional único

**Criterio de completitud:** Tabla y repository funcional.

---

### Tarea 4.2: Tauri commands de doctores

**Pasos:**
1. Crear `src-tauri/src/commands/doctors.rs`
2. Commands: `create_doctor`, `update_doctor`, `get_doctor`, `list_doctors`, `deactivate_doctor`
3. Verificación de permisos (solo Master puede crear/editar doctores)

**Criterio de completitud:** CRUD completo con permisos.

---

### Tarea 4.3: UI de doctores (lista + formulario)

**Pasos:**
1. Crear `src/features/doctors/pages/DoctorListPage.tsx`
2. Crear `src/features/doctors/pages/DoctorFormPage.tsx`
3. Campos: nombre, documento, registro profesional, especialidad, universidad, contacto
4. Upload de firma digitalizada (imagen)

**Criterio de completitud:** CRUD visual completo de doctores.

---

### Tarea 4.4: Vinculación doctor-usuario

**Pasos:**
1. Al crear un usuario con rol "doctor", permitir asociar con un registro de `doctors`
2. Campo `doctor_id` en tabla `users` como FK opcional
3. Cuando doctor hace login, su `doctor_id` determina qué pacientes/citas puede ver

**Criterio de completitud:** Usuario doctor vinculado a su registro profesional.

---

## Fase 5: Catálogo de Procedimientos

### Tarea 5.1: Migración y modelo de procedimientos

**Pasos:**
1. Crear migración `v005_procedures.rs` con tablas `procedures` y `procedure_price_history`
2. Implementar structs en `src-tauri/src/models/procedure.rs`
3. Repository con CRUD + versionamiento de precios
4. Seed inicial con procedimientos odontológicos comunes (20-30 registros)

**Criterio de completitud:** Tabla con catálogo seed y historial de precios funcional.

---

### Tarea 5.2: Tauri commands de procedimientos

**Pasos:**
1. Crear `src-tauri/src/commands/procedures.rs`
2. Commands: `create_procedure`, `update_procedure`, `list_procedures`, `search_procedures`, `update_price`
3. Al actualizar precio: guardar en historial y actualizar `base_price`

**Criterio de completitud:** CRUD con historial de precios automático.

---

### Tarea 5.3: UI del catálogo de procedimientos

**Pasos:**
1. Crear `src/features/procedures/pages/ProcedureListPage.tsx`
2. Tabla con: código CUPS, nombre, categoría, precio, estado
3. Filtro por categoría
4. Búsqueda por nombre o código
5. Crear `src/features/procedures/pages/ProcedureFormPage.tsx`

**Criterio de completitud:** Catálogo visual con búsqueda y filtros.

---

### Tarea 5.4: Gestión de descuentos

**Pasos:**
1. En el formulario de procedimiento: campo de descuento NO se configura aquí (es por cita)
2. En la UI de cita (Fase 6): selector de descuento por procedimiento (% o fijo)
3. Visualización: precio original tachado + precio final

**Criterio de completitud:** Lógica de descuento implementada para uso en citas.

---

## Fase 6: Módulo de Citas / Agenda

### Tarea 6.1: Migración de citas

**Pasos:**
1. Crear migración `v006_appointments.rs` con tablas `appointments` y `appointment_procedures`
2. Implementar structs en `src-tauri/src/models/appointment.rs`
3. Repository con CRUD + validación de solapamiento de horarios

**Criterio de completitud:** Tablas creadas con constraint de no solapamiento.

---

### Tarea 6.2: Tauri commands de citas

**Pasos:**
1. Crear `src-tauri/src/commands/appointments.rs`
2. Commands: `create_appointment`, `update_appointment`, `get_appointment`, `list_appointments`, `change_appointment_status`
3. Command `add_procedure_to_appointment`, `remove_procedure_from_appointment`
4. Cálculo automático de total (suma de procedimientos con descuentos aplicados)
5. Validación: no permitir solapamiento de horarios para el mismo doctor

**Criterio de completitud:** CRUD de citas con procedimientos múltiples y cálculo de total.

---

### Tarea 6.3: Vista de calendario

**Pasos:**
1. Crear `src/features/appointments/pages/AppointmentCalendarPage.tsx`
2. Vista día: bloques de hora con citas programadas
3. Vista semana: grid de 7 días con indicadores
4. Vista mes: resumen de citas por día
5. Código de color por estado de la cita
6. Click en slot vacío → crear cita. Click en cita → ver detalle.

**Criterio de completitud:** Calendario interactivo con las 3 vistas y navegación por fecha.

---

### Tarea 6.4: Formulario de creación/edición de cita

**Pasos:**
1. Crear `src/features/appointments/pages/AppointmentFormPage.tsx`
2. Selector de paciente (búsqueda autocompletada)
3. Selector de doctor
4. Date picker + time picker (inicio y fin)
5. Campo motivo/razón
6. Validación de disponibilidad en tiempo real

**Criterio de completitud:** Crear citas con validación de solapamiento antes de guardar.

---

### Tarea 6.5: Asociar procedimientos a una cita

**Pasos:**
1. Crear componente `ProcedureSelector.tsx` — busca del catálogo y agrega a la cita
2. Para cada procedimiento: cantidad, precio (prellenado), descuento opcional, diente asociado (opcional)
3. Resumen: subtotal, descuento global, total
4. Permitir agregar/quitar procedimientos mientras la cita está en progreso

**Criterio de completitud:** Multi-procedimiento funcional con cálculo dinámico de total.

---

### Tarea 6.6: Cambio de estado de cita

**Pasos:**
1. Implementar máquina de estados: scheduled → confirmed → in_progress → completed
2. Estados terminales: cancelled, no_show (desde scheduled o confirmed)
3. Botones de acción según estado actual
4. Registro de timestamp en cada cambio de estado
5. Solo doctor o master pueden marcar "completed"

**Criterio de completitud:** Flujo de estados con restricciones de rol.

---

### Tarea 6.7: Filtros y búsqueda de citas

**Pasos:**
1. Filtro por: doctor, paciente, estado, rango de fechas
2. Vista lista alternativa (tabla) para búsqueda avanzada
3. Indicadores: citas del día, próxima cita, citas pendientes

**Criterio de completitud:** Filtros funcionales en vista calendario y vista lista.

---

## Fase 7: Odontograma

### Tarea 7.1: Migración de odontogramas

**Pasos:**
1. Crear migración `v007_odontograms.rs` con tablas `odontograms` y `odontogram_findings`
2. Implementar structs en `src-tauri/src/models/odontogram.rs`
3. Repository con funciones: crear odontograma, agregar hallazgo, obtener por paciente

**Criterio de completitud:** Modelo de datos para odontogramas con hallazgos por cara.

---

### Tarea 7.2: Tauri commands de odontograma

**Pasos:**
1. Crear `src-tauri/src/commands/odontogram.rs`
2. Commands: `create_odontogram`, `add_finding`, `remove_finding`, `get_odontograms_by_patient`, `get_odontogram_detail`
3. Validar que solo Doctor puede crear/modificar odontogramas
4. Asociar odontograma a cita (opcional)

**Criterio de completitud:** API backend completa para gestión de odontogramas.

---

### Tarea 7.3: Geometría de dientes (canvas utils)

**Pasos:**
1. Crear `src/features/odontogram/utils/tooth-geometry.ts`
2. Definir coordenadas y paths para cada diente (32 permanentes + 20 temporales)
3. Cada diente con 5 regiones clickeables (caras)
4. Crear `src/features/odontogram/utils/fdi-nomenclature.ts` con mapeo FDI
5. Definir paleta de colores por hallazgo (estándar odontológico)

**Criterio de completitud:** Funciones de geometría que calculan posición y hitbox de cada cara de cada diente.

---

### Tarea 7.4: Componente OdontogramCanvas

**Pasos:**
1. Crear `src/features/odontogram/components/OdontogramCanvas.tsx`
2. Renderizar 32 dientes en disposición anatómica (arco superior + arco inferior)
3. Cada diente con 5 caras diferenciables visualmente
4. Click en cara → selección visual + evento
5. Colorear cara según hallazgo registrado
6. Tooltip con info del hallazgo al hover

**Criterio de completitud:** Canvas interactivo que muestra todos los dientes con sus hallazgos coloreados.

---

### Tarea 7.5: Panel de herramientas del odontograma

**Pasos:**
1. Crear `src/features/odontogram/components/ToolPanel.tsx`
2. Selector de hallazgo/estado (caries, obturación, ausente, corona, etc.)
3. Flujo: seleccionar hallazgo → click en cara → se aplica
4. Opción "diente completo" para estados que afectan todo el diente (ausente, corona)
5. Botón deshacer última acción

**Criterio de completitud:** Herramientas funcionales que aplican hallazgos al canvas.

---

### Tarea 7.6: Historial y exportación de odontogramas

**Pasos:**
1. Crear `src/features/odontogram/pages/OdontogramPage.tsx`
2. Selector de versión (inicial vs. evoluciones con fecha)
3. Comparación: odontograma inicial vs. actual (side by side)
4. Leyenda de convenciones visible
5. Exportar odontograma a PDF (captura del canvas + leyenda)
6. Toggle dentición permanente / temporal

**Criterio de completitud:** Historial navegable con exportación a PDF.

---

## Fase 8: Historia Clínica

### Tarea 8.1: Migración de historia clínica

**Pasos:**
1. Crear migración `v008_clinical_history.rs` con tablas `clinical_histories` y `evolutions`
2. Implementar structs en modelos
3. Repository con: crear historia, agregar evolución, obtener por paciente
4. Constraint: una sola historia clínica por paciente (UNIQUE on patient_id)

**Criterio de completitud:** Tablas con constraint y repository funcional.

---

### Tarea 8.2: Tauri commands de historia clínica

**Pasos:**
1. Crear `src-tauri/src/commands/clinical_history.rs`
2. Commands: `create_clinical_history`, `get_clinical_history`, `add_evolution`, `get_evolutions`
3. Auto-lock de evoluciones después de 24 horas (campo `is_locked`)
4. Solo Doctor puede crear/editar evoluciones
5. Numeración secuencial automática de evoluciones

**Criterio de completitud:** Historia con evoluciones secuenciales y bloqueo automático.

---

### Tarea 8.3: Apertura de historia clínica (frontend)

**Pasos:**
1. Crear `src/features/clinical-history/pages/ClinicalHistoryPage.tsx`
2. Formulario de apertura: motivo de consulta, enfermedad actual, antecedentes, examen clínico, diagnóstico CIE-10, plan de tratamiento
3. Solo se puede crear una vez por paciente (verificar existencia)
4. Campos de texto enriquecido (textarea con formato básico)

**Criterio de completitud:** Formulario de apertura funcional, no permite duplicados.

---

### Tarea 8.4: Evoluciones (registro por cita)

**Pasos:**
1. Crear `src/features/clinical-history/components/EvolutionForm.tsx`
2. Formato SOAP: Subjetivo, Objetivo, Análisis, Plan
3. Auto-asociar a la cita actual (si se accede desde una cita en progreso)
4. Registro automático de doctor y fecha/hora
5. Indicador visual de evolución bloqueada (> 24h)
6. Opción de crear adenda en evolución bloqueada (nuevo registro referenciando el original)

**Criterio de completitud:** Evoluciones SOAP con auto-lock y adendas.

---

### Tarea 8.5: Visualización completa de historia clínica

**Pasos:**
1. Timeline de evoluciones (cronológica, más reciente primero)
2. Cada evolución muestra: fecha, doctor, cita asociada, contenido SOAP
3. Filtro por rango de fechas
4. Exportación completa a PDF (datos de apertura + todas las evoluciones)
5. Indicador de total de evoluciones

**Criterio de completitud:** Vista completa exportable a PDF cumpliendo Resolución 1995/1999.

---

## Fase 9: Documentos del Paciente

### Tarea 9.1: Migración de documentos

**Pasos:**
1. Crear migración `v009_documents.rs` con tabla `documents`
2. Implementar struct y repository
3. Función para crear estructura de carpetas: `{base_path}/pacientes/{id}/documentos/{tipo}/`

**Criterio de completitud:** Tabla y función de gestión de filesystem.

---

### Tarea 9.2: Tauri commands de documentos

**Pasos:**
1. Crear `src-tauri/src/commands/documents.rs`
2. Commands: `upload_document`, `list_documents`, `get_document`, `delete_document`
3. `upload_document`: recibe bytes del archivo, guarda en filesystem, registra en BD
4. Crear `src-tauri/src/services/file_manager.rs` para operaciones de filesystem
5. Validación: tipos de archivo permitidos (JPG, PNG, WEBP, PDF), tamaño máximo 50 MB

**Criterio de completitud:** Upload y descarga de archivos funcional con validaciones.

---

### Tarea 9.3: UI de documentos del paciente

**Pasos:**
1. Crear `src/features/documents/components/DocumentGallery.tsx`
2. Vista grid para imágenes (thumbnails) + vista lista para PDFs
3. Filtro por tipo de documento
4. Botón de upload con drag & drop
5. Clasificación al subir: foto, radiografía, consentimiento, otro

**Criterio de completitud:** Galería visual con upload funcional.

---

### Tarea 9.4: Visualizador integrado

**Pasos:**
1. Crear `src/features/documents/components/ImageViewer.tsx` — zoom, rotación, pantalla completa
2. Crear `src/features/documents/components/PdfViewer.tsx` — visor PDF embebido
3. Modal de visualización al click en documento
4. Navegación entre documentos (anterior/siguiente)

**Criterio de completitud:** Visualización de imágenes y PDFs sin salir de la app.

---

### Tarea 9.5: Configuración de ruta de almacenamiento

**Pasos:**
1. En settings: campo para configurar `documents_base_path`
2. Botón "Seleccionar carpeta" usando diálogo nativo de Tauri
3. Al cambiar ruta: NO mover archivos existentes, solo aplica a nuevos
4. Mostrar espacio disponible en disco en la ruta seleccionada

**Criterio de completitud:** Ruta configurable con selector nativo de directorio.

---

## Fase 10: Consentimientos Informados

### Tarea 10.1: Migración de consentimientos

**Pasos:**
1. Crear migración `v010_consents.rs` con tabla `consents`
2. Implementar struct y repository
3. Crear directorio `public/consent-templates/` con plantillas HTML base

**Criterio de completitud:** Tabla y estructura de plantillas creada.

---

### Tarea 10.2: Plantillas de consentimiento

**Pasos:**
1. Crear plantillas HTML con placeholders: `{{patient_name}}`, `{{procedure_name}}`, `{{doctor_name}}`, `{{date}}`, etc.
2. Mínimo 10 plantillas (las listadas en RF-05)
3. Cada plantilla incluye: encabezado del consultorio, datos del paciente, descripción del procedimiento, riesgos, alternativas, declaración de consentimiento, espacio para firma
4. Plantillas editables desde la UI (futuro, no en v1 — solo edición de archivo)

**Criterio de completitud:** 10 plantillas HTML funcionales con placeholders.

---

### Tarea 10.3: Generación de PDF de consentimiento

**Pasos:**
1. Crear command `generate_consent_pdf`
2. Recibe: patient_id, procedure_id (opcional), template_name
3. Rellena placeholders con datos reales de la BD
4. Genera PDF usando `printpdf` (o alternativa: HTML → PDF con wkhtmltopdf embebido)
5. Guarda PDF en filesystem del paciente y registra en tabla `consents`

**Criterio de completitud:** PDF generado con datos reales, guardado y registrado.

---

### Tarea 10.4: Canvas de firma presencial

**Pasos:**
1. Crear `src/features/consents/components/SignatureCanvas.tsx`
2. Canvas HTML5 para captura de firma con stylus o dedo
3. Botones: limpiar, guardar
4. Al guardar: exporta como imagen PNG
5. Imagen de firma se incrusta en el PDF del consentimiento

**Criterio de completitud:** Firma capturada y embebida en PDF.

---

### Tarea 10.5: Integración con WhatsApp (link wa.me)

**Pasos:**
1. Crear command `generate_whatsapp_link`
2. Genera URL: `https://wa.me/57{celular}?text={mensaje_codificado}`
3. Mensaje predefinido: "Estimado/a {nombre}, adjunto encontrará su consentimiento informado para {procedimiento}. Por favor revíselo, fírmelo y envíe la foto de vuelta."
4. Botón en UI que abre el link en navegador del sistema
5. El usuario envía manualmente el PDF vía WhatsApp

**Criterio de completitud:** Link generado y abierto en navegador. Flujo documentado para el usuario.

---

### Tarea 10.6: Gestión de consentimientos (UI)

**Pasos:**
1. Crear `src/features/consents/pages/ConsentListPage.tsx` — lista por paciente
2. Estados visuales: pendiente (amarillo), enviado (azul), firmado (verde), expirado (gris)
3. Acción "Subir firmado" → abre upload de documento
4. Asociación consentimiento ↔ cita ↔ procedimiento
5. Validación: no permitir iniciar procedimiento sin consentimiento firmado (warning, no bloqueo)

**Criterio de completitud:** Flujo completo de generación → envío → recepción de firma.

---

## Fase 11: Facturación Básica

### Tarea 11.1: Migración de facturación

**Pasos:**
1. Crear migración `v011_billing.rs` con tablas `invoices` y `payments`
2. Implementar structs y repository
3. Función de numeración secuencial (desde settings `invoice_next_number`)

**Criterio de completitud:** Tablas con numeración secuencial automática.

---

### Tarea 11.2: Tauri commands de facturación

**Pasos:**
1. Crear `src-tauri/src/commands/billing.rs`
2. Commands: `create_invoice`, `add_payment`, `get_invoice`, `list_invoices_by_patient`, `get_patient_balance`
3. Auto-cálculo de estado: pending → partial (si hay abono) → paid (si total cubierto)
4. Asociar invoice a cita (los procedimientos de la cita son los ítems)

**Criterio de completitud:** Facturación con pagos parciales y estados automáticos.

---

### Tarea 11.3: UI de facturación

**Pasos:**
1. Crear `src/features/billing/pages/InvoiceDetailPage.tsx`
2. Detalle: datos consultorio, datos paciente, listado de procedimientos, descuentos, total
3. Sección de pagos: historial de abonos + formulario para registrar nuevo pago
4. Estado de cuenta del paciente (saldo pendiente total)
5. Crear desde la vista de cita completada (botón "Generar Recibo")

**Criterio de completitud:** Flujo de facturación end-to-end desde cita completada.

---

### Tarea 11.4: Exportación de recibo a PDF

**Pasos:**
1. Template de recibo: encabezado consultorio, datos paciente, tabla de procedimientos, totales, método de pago
2. Command `export_invoice_pdf`
3. Numeración visible en el PDF
4. Botón "Imprimir/Descargar PDF" en la vista del recibo

**Criterio de completitud:** PDF de recibo generado con formato profesional.

---

### Tarea 11.5: Reporte de ingresos básico

**Pasos:**
1. Crear `src/features/billing/pages/RevenueReportPage.tsx`
2. Filtro por rango de fechas
3. Resumen: total facturado, total cobrado, pendiente por cobrar
4. Listado de facturas en el período
5. Solo accesible por rol Master

**Criterio de completitud:** Reporte básico de ingresos con filtro por fechas.

---

## Fase 12: Backup y Configuración

### Tarea 12.1: Servicio de backup (backend)

**Pasos:**
1. Crear `src-tauri/src/services/backup_service.rs`
2. Función `create_backup()`: genera ZIP con archivo SQLite + carpeta de documentos
3. Nombre del ZIP: `backup_dental_YYYYMMDD_HHmmss.zip`
4. Función `restore_backup()`: descomprime ZIP, reemplaza BD y archivos
5. Verificación de integridad al restaurar (checksum o validación de BD)
6. Agregar dependencia `zip` en Cargo.toml

**Criterio de completitud:** Backup y restauración funcional con verificación.

---

### Tarea 12.2: Tauri commands de backup

**Pasos:**
1. Crear `src-tauri/src/commands/backup.rs`
2. Commands: `create_backup`, `restore_backup`, `list_backups`, `get_last_backup_date`
3. Diálogo nativo para seleccionar destino (backup) o archivo (restore)
4. Advertencia antes de restaurar: "Esto reemplazará TODOS los datos actuales"

**Criterio de completitud:** Commands con diálogos nativos y confirmación de restauración.

---

### Tarea 12.3: UI de backup y configuración general

**Pasos:**
1. Crear `src/features/settings/pages/SettingsPage.tsx`
2. Secciones:
   - Datos del consultorio (nombre, NIT, dirección, teléfono, logo)
   - Almacenamiento (ruta de documentos, ruta de backups)
   - Backup (manual + configuración de automático)
   - Seguridad (timeout de sesión, intentos de login)
3. Indicador: "Último backup: hace X días" con alerta si > 7 días
4. Botones: "Backup Ahora" y "Restaurar"

**Criterio de completitud:** Pantalla de configuración completa con backup manual funcional.

---

### Tarea 12.4: Backup automático (scheduler)

**Pasos:**
1. Implementar timer en Tauri que ejecuta backup según configuración (diario/semanal)
2. Ejecutar en segundo plano sin bloquear la UI
3. Notificación toast al completar: "Backup automático completado"
4. Si falla: notificación de error + registro en log
5. Solo ejecutar si la app está abierta al momento programado

**Criterio de completitud:** Backup automático configurable ejecutado en background.

---

## Fase 13: Pulido, Testing y Empaquetado

### Tarea 13.1: Log de auditoría completo

**Pasos:**
1. Revisar que TODAS las acciones CRUD registran en `audit_log`
2. Crear `src/features/settings/pages/AuditLogPage.tsx` (solo Master)
3. Filtros: por usuario, por entidad, por acción, por fecha
4. Tabla paginada con: fecha, usuario, acción, entidad, detalle

**Criterio de completitud:** Auditoría completa y consultable.

---

### Tarea 13.2: Manejo de errores y feedback al usuario

**Pasos:**
1. Revisar todos los commands: errores tipados con `thiserror`
2. Frontend: ErrorBoundary global + toasts para errores de operación
3. Mensajes de error traducidos al español y comprensibles
4. Loading states en todas las operaciones async
5. Confirmaciones antes de acciones destructivas (desactivar, cancelar)

**Criterio de completitud:** Ninguna operación falla silenciosamente. Todo error se muestra al usuario.

---

### Tarea 13.3: Tests unitarios en lógica crítica

**Pasos:**
1. Tests en Rust: validaciones de negocio, cálculo de totales, sistema de permisos
2. Tests: hash/verify de contraseñas, migraciones, solapamiento de citas
3. Tests frontend: componentes críticos (OdontogramCanvas interactions, cálculo de descuentos)
4. Mínimo: 80% de cobertura en servicios de negocio del backend

**Criterio de completitud:** Suite de tests ejecutable con `cargo test` y `pnpm test`.

---

### Tarea 13.4: Tema oscuro y accesibilidad

**Pasos:**
1. Implementar toggle dark mode (Tailwind dark: variant)
2. Persistir preferencia en settings
3. Verificar contraste en ambos temas
4. Labels en todos los inputs (accesibilidad)
5. Navegación por teclado funcional en formularios

**Criterio de completitud:** Dark mode funcional, contraste WCAG AA mínimo.

---

### Tarea 13.5: Empaquetado y distribución

**Pasos:**
1. Configurar `tauri.conf.json` para build de producción
2. Generar instalador Windows: `.msi` y `.exe` (NSIS)
3. Generar instalador macOS: `.dmg`
4. Configurar icono de la aplicación
5. Splash screen o loading al iniciar
6. Probar instalación limpia en Windows y macOS
7. Documentar proceso de instalación para usuario final

**Criterio de completitud:** Instaladores funcionales para Windows y macOS. Instalación sin dependencias externas.

---

## Orden de Dependencias

```
Fase 1 (Fundación)
  └── Fase 2 (Auth)
       ├── Fase 3 (Pacientes)
       │    ├── Fase 7 (Odontograma)
       │    ├── Fase 8 (Historia Clínica)
       │    └── Fase 9 (Documentos)
       ├── Fase 4 (Doctores)
       ├── Fase 5 (Procedimientos)
       │    └── Fase 6 (Citas) ──── requiere Pacientes + Doctores + Procedimientos
       │         ├── Fase 10 (Consentimientos)
       │         └── Fase 11 (Facturación)
       └── Fase 12 (Backup/Config) ── puede hacerse en paralelo desde Fase 2
            └── Fase 13 (Pulido) ── al final, cuando todo funciona
```

## Notas de Implementación

- **Empezar siempre por el backend** (migración → model → repo → command) y luego frontend.
- **No sobre-diseñar la UI** en primera iteración. Funcional primero, bonito después.
- **Cada fase debe dejar algo usable** — no avanzar a la siguiente sin que la actual funcione end-to-end.
- **Git:** un commit por tarea completada. Branch por fase si se prefiere.
