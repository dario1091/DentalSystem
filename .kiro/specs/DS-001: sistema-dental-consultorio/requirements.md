# Requisitos — DS-001: Sistema Dental Consultorio

## Información General

| Campo | Valor |
|-------|-------|
| Historia Jira | DS-001 |
| Proyecto | DentalSystem |
| Tipo | Aplicación de escritorio |
| Prioridad | Alta |
| Stack | Tauri v2 (Rust) + React 19 + TypeScript + SQLite |

## Descripción General

Sistema de gestión integral para consultorio odontológico de una sola unidad. Permite administrar pacientes, doctores, citas, odontogramas, documentos clínicos, consentimientos informados, y catálogo de procedimientos. Diseñado para cumplir la normatividad colombiana vigente en salud oral.

## Contexto Normativo Colombiano

| Norma | Aplica | Requisito Clave |
|-------|--------|-----------------|
| Resolución 1995/1999 | Historia Clínica | Integralidad, secuencialidad, disponibilidad. Retención 10 años mín. |
| Ley 35/1989 | Ética Odontológica | Consentimiento informado obligatorio antes de procedimientos |
| Ley 1581/2012 | Habeas Data | Autorización expresa para datos sensibles de salud |
| Resolución 3100/2019 | Habilitación | Registros obligatorios, talento humano documentado |
| Decreto 780/2016 | CUPS | Codificación de procedimientos odontológicos |

---

## Requisitos Funcionales

### RF-01: Módulo de Pacientes (CRUD)

**Descripción:** Gestión completa del registro de pacientes del consultorio.

**Campos obligatorios:**
- Datos personales: nombre completo, tipo y número de documento (CC, TI, CE, PP), fecha de nacimiento, género, estado civil
- Contacto: teléfono celular (WhatsApp), teléfono fijo (opcional), email (opcional), dirección de residencia
- Datos de salud: EPS (si aplica), alergias conocidas, medicamentos actuales, antecedentes médicos relevantes, grupo sanguíneo
- Responsable/acudiente: nombre, parentesco, teléfono (obligatorio para menores de edad)
- Autorización de tratamiento de datos personales (Ley 1581/2012): checkbox + fecha de aceptación
- Foto del paciente (opcional)

**Criterios de aceptación:**
- [ ] Crear, leer, actualizar y desactivar pacientes (soft delete — nunca borrado físico por norma)
- [ ] Búsqueda por nombre, documento o teléfono
- [ ] Validación de documento único (no duplicados)
- [ ] Registro de fecha de creación y última modificación
- [ ] Indicador visual de paciente activo/inactivo
- [ ] Exportación de ficha del paciente a PDF

---

### RF-02: Módulo de Odontograma

**Descripción:** Representación gráfica interactiva de la dentadura del paciente usando nomenclatura FDI (estándar en Colombia).

**Funcionalidades:**
- Canvas interactivo con los 32 dientes permanentes (nomenclatura FDI: cuadrantes 1-4)
- Opción de dentición temporal (cuadrantes 5-8) para pacientes pediátricos
- Cada diente dividido en 5 caras: vestibular, lingual/palatina, mesial, distal, oclusal/incisal
- Estados por cara/diente: sano, caries, obturación, fractura, ausente, corona, endodoncia, implante, extracción indicada, prótesis fija/removible

**Criterios de aceptación:**
- [ ] Visualización gráfica de la dentadura completa
- [ ] Selección de diente y cara con click/tap
- [ ] Aplicar hallazgo/estado con código de color estandarizado
- [ ] Historial de odontogramas por paciente (no sobrescribir, crear nueva versión)
- [ ] Odontograma inicial vs. odontograma de evolución
- [ ] Leyenda visible con convenciones de colores
- [ ] Impresión/exportación a PDF del odontograma

---

### RF-03: Historia Clínica

**Descripción:** Registro secuencial e integral de las atenciones realizadas al paciente, cumpliendo Resolución 1995/1999.

**Componentes:**
- Apertura de historia clínica (una sola vez por paciente)
- Motivo de consulta
- Enfermedad actual
- Antecedentes personales y familiares
- Examen clínico extraoral e intraoral
- Diagnóstico (CIE-10)
- Plan de tratamiento
- Evoluciones por cada cita (secuenciales, con fecha y firma del profesional)

**Criterios de aceptación:**
- [ ] Una historia clínica por paciente, con evoluciones secuenciales
- [ ] Cada evolución ligada a una cita específica
- [ ] Campos de texto enriquecido para narrativas clínicas
- [ ] Registro automático de fecha, hora y profesional que atiende
- [ ] Historia clínica NO editable después de 24 horas (solo adendas)
- [ ] Exportación completa a PDF
- [ ] Numeración secuencial de evoluciones

---

### RF-04: Módulo de Documentos del Paciente

**Descripción:** Almacenamiento y gestión de documentos clínicos asociados al paciente.

**Tipos de documentos:**
- Fotografías clínicas (intraorales, extraorales)
- Radiografías (periapicales, panorámicas, cefalométricas)
- Consentimientos informados firmados
- Autorización de datos personales
- Otros documentos (remisiones, resultados de laboratorio)

**Almacenamiento:** Filesystem organizado en `/data/pacientes/{id}/documentos/{tipo}/` con referencia (path) en base de datos.

**Criterios de aceptación:**
- [ ] Subir archivos (imágenes: JPG, PNG, WEBP; documentos: PDF)
- [ ] Clasificación por tipo de documento
- [ ] Visualizador integrado de imágenes (zoom, rotación)
- [ ] Visualizador de PDF embebido
- [ ] Asociación documento-cita (opcional)
- [ ] Fecha de carga y descripción del documento
- [ ] Ruta base de almacenamiento configurable desde ajustes
- [ ] Límite de tamaño por archivo: 50 MB

---

### RF-05: Consentimientos Informados

**Descripción:** Generación, firma y gestión de consentimientos informados según Ley 35/1989.

**Plantillas requeridas (mínimo):**
- Consentimiento general de tratamiento odontológico
- Consentimiento para exodoncia
- Consentimiento para endodoncia
- Consentimiento para cirugía oral
- Consentimiento para ortodoncia
- Consentimiento para blanqueamiento dental
- Consentimiento para prótesis dental
- Consentimiento para periodoncia
- Consentimiento para implantes dentales
- Consentimiento para sedación/anestesia

**Flujo de firma:**
1. Sistema genera PDF del consentimiento con datos del paciente y procedimiento pre-llenados
2. Se genera link de WhatsApp (`wa.me/{celular}?text={mensaje}`) con instrucción para el paciente
3. El documento se puede enviar como archivo adjunto vía WhatsApp (manual por el usuario)
4. El paciente firma en su dispositivo (firma digital en canvas touch o firma manual + foto)
5. El paciente devuelve el documento firmado
6. El profesional sube el consentimiento firmado al sistema (RF-04)

**Alternativa presencial:** Firma en pantalla táctil del equipo del consultorio (canvas de firma).

**Criterios de aceptación:**
- [ ] Catálogo de plantillas de consentimiento editables
- [ ] Auto-llenado de datos del paciente en la plantilla
- [ ] Generación de PDF del consentimiento
- [ ] Generación de link WhatsApp con mensaje predefinido
- [ ] Canvas de firma para firma presencial en pantalla
- [ ] Registro de fecha y método de firma (presencial/remota)
- [ ] Asociación consentimiento-cita-procedimiento
- [ ] Consentimiento firmado almacenado como documento del paciente

---

### RF-06: Módulo de Doctores (CRUD)

**Descripción:** Gestión de los profesionales del consultorio.

**Campos:**
- Nombre completo
- Tipo y número de documento
- Registro profesional (tarjeta profesional)
- Especialidad (odontología general, ortodoncia, endodoncia, etc.)
- Universidad de egreso
- Teléfono y email
- Estado (activo/inactivo)
- Firma digitalizada (imagen para documentos)

**Criterios de aceptación:**
- [ ] CRUD completo de doctores
- [ ] Validación de registro profesional único
- [ ] Asociación doctor-cita para trazabilidad
- [ ] Firma digitalizada para incluir en documentos generados
- [ ] Soft delete (no borrado físico)

---

### RF-07: Módulo de Citas / Agenda

**Descripción:** Gestión de la agenda del consultorio (una sola unidad odontológica).

**Funcionalidades:**
- Vista de calendario (día, semana, mes)
- Creación de cita: paciente, doctor, fecha, hora inicio, hora fin, motivo
- Una cita puede incluir MÚLTIPLES procedimientos
- Estados de cita: programada, confirmada, en atención, completada, cancelada, no asistió

**Criterios de aceptación:**
- [ ] CRUD de citas con validación de disponibilidad (no solapamiento)
- [ ] Asociar múltiples procedimientos a una sola cita
- [ ] Cambio de estado con registro de fecha/hora
- [ ] Vista de calendario interactivo
- [ ] Filtro por doctor, paciente, estado, rango de fechas
- [ ] Indicador visual de estado en el calendario
- [ ] Registro de observaciones/notas por cita
- [ ] Cálculo automático del valor total (suma de procedimientos - descuentos)

---

### RF-08: Catálogo de Procedimientos

**Descripción:** Listado maestro de procedimientos odontológicos con precios.

**Campos:**
- Código CUPS (cuando aplique)
- Nombre del procedimiento
- Descripción breve
- Categoría (operatoria, endodoncia, cirugía, ortodoncia, periodoncia, prótesis, estética, diagnóstico)
- Precio base
- Estado (activo/inactivo)

**Criterios de aceptación:**
- [ ] CRUD de procedimientos
- [ ] Búsqueda por nombre o código CUPS
- [ ] Filtro por categoría
- [ ] Precio editable sin perder historial (versionamiento de precios)
- [ ] Aplicar descuento porcentual o fijo por procedimiento en la cita
- [ ] Descuento global por cita (aplica a todos los procedimientos)
- [ ] Visualización de precio original vs. precio con descuento

---

### RF-09: Módulo de Usuarios y Roles

**Descripción:** Control de acceso al sistema con roles diferenciados.

**Roles:**
| Rol | Permisos |
|-----|----------|
| Master (administrador) | Acceso total. Configuración del sistema. CRUD de usuarios. Reportes. |
| Doctor | Ver/editar sus pacientes y citas. Crear evoluciones. Generar consentimientos. Ver procedimientos. |
| Auxiliar | Agendar citas. Registrar pacientes. Subir documentos. NO puede editar historia clínica ni odontograma. |

**Criterios de aceptación:**
- [ ] Login con usuario y contraseña
- [ ] Contraseñas hasheadas (bcrypt/argon2)
- [ ] Sesión persistente hasta logout explícito o timeout configurable
- [ ] CRUD de usuarios (solo Master)
- [ ] Asignación de rol por usuario
- [ ] Restricción de acceso a módulos según rol
- [ ] Registro de auditoría: quién hizo qué y cuándo (log de acciones)
- [ ] Cambio de contraseña obligatorio en primer login
- [ ] Bloqueo después de N intentos fallidos

---

### RF-10: Backup y Restauración

**Descripción:** Respaldo de la base de datos y archivos del sistema.

**Criterios de aceptación:**
- [ ] Backup manual desde el menú (genera archivo .zip con BD + carpeta de documentos)
- [ ] Backup automático configurable (diario/semanal)
- [ ] Restauración desde archivo de backup
- [ ] Ruta de destino de backups configurable
- [ ] Notificación visual cuando el último backup tiene más de 7 días
- [ ] Integridad verificada al restaurar

---

### RF-11: Facturación Básica (Pacientes Particulares)

**Descripción:** Generación de recibos/facturas para pacientes particulares.

**Campos del recibo:**
- Datos del consultorio (nombre, NIT, dirección, teléfono)
- Datos del paciente
- Listado de procedimientos realizados con precios
- Descuentos aplicados
- Total a pagar
- Método de pago (efectivo, transferencia, tarjeta, mixto)
- Abonos y saldo pendiente

**Criterios de aceptación:**
- [ ] Generación de recibo/factura asociada a cita
- [ ] Registro de pagos parciales (abonos)
- [ ] Historial de pagos por paciente
- [ ] Estado de cuenta del paciente (saldo pendiente)
- [ ] Exportación de recibo a PDF
- [ ] Numeración secuencial de recibos
- [ ] Datos del consultorio configurables en ajustes

---

## Requisitos No Funcionales

### RNF-01: Rendimiento

- Inicio de la aplicación en menos de 3 segundos
- Navegación entre módulos sin lag perceptible (< 200ms)
- Búsquedas con respuesta en menos de 500ms para hasta 10,000 pacientes
- Carga de imágenes/documentos con indicador de progreso

### RNF-02: Almacenamiento

- Base de datos: SQLite (archivo único, portable)
- Imágenes y documentos: filesystem local con ruta configurable
- Estructura de carpetas: `/data/pacientes/{id}/documentos/{tipo}/{archivo}`
- Sin dependencia de conexión a internet para funcionalidades core

### RNF-03: Seguridad

- Datos en reposo: BD SQLite con cifrado (SQLCipher o equivalente en Rust)
- Contraseñas: hash con Argon2id
- Sesiones con timeout configurable
- Log de auditoría inmutable (append-only)
- Cumplimiento Ley 1581/2012: datos sensibles protegidos

### RNF-04: Usabilidad

- Interfaz intuitiva para personal no técnico
- Responsive dentro de la ventana (mínimo 1024x768)
- Tema claro por defecto, tema oscuro opcional
- Atajos de teclado para operaciones frecuentes
- Mensajes de error comprensibles para el usuario final

### RNF-05: Portabilidad

- Aplicación de escritorio: Windows 10+ y macOS 12+
- Instalador para cada plataforma (.msi/.exe para Windows, .dmg para macOS)
- Sin dependencias externas de runtime (todo embebido en el binario)
- Datos portables (copiar carpeta de datos a otro equipo = funciona)

### RNF-06: Mantenibilidad

- Código fuente organizado en arquitectura modular (features/módulos)
- Separación clara frontend/backend vía Tauri commands
- Migraciones de BD versionadas y reversibles
- Tests unitarios en lógica de negocio crítica

### RNF-07: Retención de Datos (Normativa)

- Historias clínicas: retención mínima 10 años (3 activos + 7 archivo)
- Consentimientos informados: retención mínima 10 años
- Datos del paciente: no eliminación física, solo desactivación
- Backup de datos debe cubrir el período completo de retención

---

## Restricciones

| Restricción | Detalle |
|-------------|---------|
| Una sola unidad | El sistema NO maneja múltiples sillas/unidades simultáneas |
| Solo particulares | No se integra con EPS ni genera RIPS |
| Offline-first | Toda funcionalidad core opera sin internet |
| WhatsApp limitado | Solo genera link `wa.me` — envío manual por el usuario |
| Monousuario simultáneo | No se requiere concurrencia multi-terminal (1 equipo) |

---

## Glosario

| Término | Definición |
|---------|-----------|
| FDI | Fédération Dentaire Internationale — sistema de nomenclatura dental (cuadrantes 1-4 permanentes, 5-8 temporales) |
| CUPS | Clasificación Única de Procedimientos en Salud (Colombia) |
| CIE-10 | Clasificación Internacional de Enfermedades, 10ª revisión |
| Odontograma | Diagrama gráfico del estado de la dentadura del paciente |
| Soft delete | Desactivación lógica sin eliminar el registro de la BD |
| Consentimiento informado | Documento legal donde el paciente acepta un procedimiento con conocimiento de riesgos |
