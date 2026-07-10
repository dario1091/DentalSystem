# Diseño Técnico — DS-001: Sistema Dental Consultorio

## Stack Tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Shell/Runtime | Tauri v2 | 2.x | Desktop nativo, binario pequeño (~10MB), acceso a filesystem y SQLite vía Rust |
| Frontend | React 19 | 19.x | Componentes declarativos, ecosistema maduro, Signals-ready |
| Lenguaje FE | TypeScript | 5.x | Tipado estricto, mejor DX y refactoring |
| Estilos | Tailwind CSS 4 | 4.x | Utility-first, consistente, rápido para prototipar UI clínica |
| Bundler | Vite | 6.x | HMR rápido, integración nativa con Tauri |
| Base de datos | SQLite | 3.x | Embebida, portable, cero configuración, archivo único |
| ORM/Query | rusqlite | latest | Bindings nativos de SQLite para Rust, tipado seguro |
| PDF | printpdf (Rust) | latest | Generación de PDF sin dependencias externas |
| Canvas dental | HTML5 Canvas + React | - | Odontograma interactivo con renderizado custom |
| Iconos | Lucide React | latest | Iconset consistente, tree-shakeable |

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        TAURI SHELL                           │
│                    (Proceso principal Rust)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐     ┌──────────────────────────────┐  │
│  │   SQLite DB     │     │   Filesystem Manager         │  │
│  │  (rusqlite +    │     │  (documentos, imágenes,      │  │
│  │   migrations)   │     │   backups)                   │  │
│  └────────┬────────┘     └──────────────┬───────────────┘  │
│           │                              │                   │
│  ┌────────┴──────────────────────────────┴───────────────┐  │
│  │              TAURI COMMANDS (API interna)              │  │
│  │  - patients::*    - appointments::*                   │  │
│  │  - doctors::*     - procedures::*                     │  │
│  │  - odontogram::*  - consents::*                       │  │
│  │  - documents::*   - billing::*                        │  │
│  │  - auth::*        - backup::*                         │  │
│  │  - settings::*    - audit::*                          │  │
│  └────────────────────────────┬──────────────────────────┘  │
│                               │ IPC (JSON serialized)        │
├───────────────────────────────┼─────────────────────────────┤
│                               │                              │
│  ┌────────────────────────────┴──────────────────────────┐  │
│  │               FRONTEND (WebView)                       │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐  │  │
│  │  │   Pages/     │  │   Shared/    │  │   Store/   │  │  │
│  │  │   Features   │  │   Components │  │   State    │  │  │
│  │  └──────────────┘  └──────────────┘  └────────────┘  │  │
│  │                                                        │  │
│  │  React 19 + TypeScript + Tailwind CSS 4 + Vite        │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Estructura del Proyecto

```
DentalSystem/
├── src-tauri/                    # Backend Rust (Tauri)
│   ├── src/
│   │   ├── main.rs              # Entry point
│   │   ├── lib.rs               # Configuración Tauri app
│   │   ├── commands/            # Tauri commands (API)
│   │   │   ├── mod.rs
│   │   │   ├── patients.rs
│   │   │   ├── doctors.rs
│   │   │   ├── appointments.rs
│   │   │   ├── odontogram.rs
│   │   │   ├── clinical_history.rs
│   │   │   ├── documents.rs
│   │   │   ├── consents.rs
│   │   │   ├── procedures.rs
│   │   │   ├── billing.rs
│   │   │   ├── auth.rs
│   │   │   ├── backup.rs
│   │   │   ├── settings.rs
│   │   │   └── audit.rs
│   │   ├── db/                  # Capa de datos
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs    # Pool/conexión SQLite
│   │   │   ├── migrations/     # Migraciones versionadas
│   │   │   │   ├── mod.rs
│   │   │   │   ├── v001_initial_schema.rs
│   │   │   │   └── ...
│   │   │   └── repositories/   # Queries por entidad
│   │   │       ├── mod.rs
│   │   │       ├── patient_repo.rs
│   │   │       ├── doctor_repo.rs
│   │   │       ├── appointment_repo.rs
│   │   │       └── ...
│   │   ├── models/             # Structs de dominio
│   │   │   ├── mod.rs
│   │   │   ├── patient.rs
│   │   │   ├── doctor.rs
│   │   │   ├── appointment.rs
│   │   │   ├── odontogram.rs
│   │   │   ├── procedure.rs
│   │   │   └── ...
│   │   ├── services/           # Lógica de negocio
│   │   │   ├── mod.rs
│   │   │   ├── pdf_generator.rs
│   │   │   ├── backup_service.rs
│   │   │   ├── file_manager.rs
│   │   │   └── auth_service.rs
│   │   └── errors.rs           # Error types centralizados
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
├── src/                          # Frontend React
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Router + Layout principal
│   ├── features/               # Módulos por feature
│   │   ├── patients/
│   │   │   ├── pages/
│   │   │   │   ├── PatientListPage.tsx
│   │   │   │   ├── PatientDetailPage.tsx
│   │   │   │   └── PatientFormPage.tsx
│   │   │   ├── components/
│   │   │   │   ├── PatientCard.tsx
│   │   │   │   ├── PatientSearchBar.tsx
│   │   │   │   └── PatientDocuments.tsx
│   │   │   ├── hooks/
│   │   │   │   └── usePatients.ts
│   │   │   └── types.ts
│   │   ├── odontogram/
│   │   │   ├── pages/
│   │   │   ├── components/
│   │   │   │   ├── OdontogramCanvas.tsx
│   │   │   │   ├── ToothSelector.tsx
│   │   │   │   └── LegendPanel.tsx
│   │   │   ├── hooks/
│   │   │   ├── utils/
│   │   │   │   ├── tooth-geometry.ts
│   │   │   │   └── fdi-nomenclature.ts
│   │   │   └── types.ts
│   │   ├── clinical-history/
│   │   ├── appointments/
│   │   ├── doctors/
│   │   ├── procedures/
│   │   ├── consents/
│   │   ├── billing/
│   │   ├── documents/
│   │   ├── settings/
│   │   └── auth/
│   ├── shared/                  # Componentes compartidos
│   │   ├── components/
│   │   │   ├── ui/             # Componentes base (Button, Input, Modal, Table...)
│   │   │   ├── layout/        # Shell, Sidebar, Header
│   │   │   └── feedback/      # Toast, Loading, ErrorBoundary
│   │   ├── hooks/
│   │   │   ├── useTauriCommand.ts
│   │   │   └── useAuth.ts
│   │   └── utils/
│   │       ├── date-format.ts
│   │       └── validators.ts
│   ├── store/                   # Estado global (si se necesita)
│   │   └── auth-store.ts
│   └── styles/
│       └── globals.css          # Tailwind base + custom tokens
├── public/
│   └── consent-templates/      # Plantillas HTML de consentimientos
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
└── .kiro/
    └── specs/
        └── DS-001: sistema-dental-consultorio/
```

---

## Modelo de Datos (SQLite)

### Diagrama Entidad-Relación (simplificado)

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   patients   │──1:N──│  appointments    │──N:1──│   doctors    │
└──────┬───────┘       └────────┬─────────┘       └──────────────┘
       │                        │
       │ 1:N                    │ 1:N
       │                        │
┌──────┴───────┐       ┌───────┴──────────┐
│ odontograms  │       │ appointment_     │
│              │       │ procedures       │──N:1──┌──────────────┐
└──────────────┘       └──────────────────┘       │  procedures  │
       │                                          └──────────────┘
       │ 1:N
┌──────┴───────┐       ┌──────────────────┐
│ odontogram_  │       │ clinical_history │──N:1── patients
│ findings     │       └────────┬─────────┘
└──────────────┘                │ 1:N
                        ┌───────┴──────────┐
                        │   evolutions     │──N:1── appointments
                        └──────────────────┘

┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│  documents   │──N:1──│    patients      │──1:N──│   consents   │
└──────────────┘       └──────────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│    users     │──N:1──│     roles        │       │  audit_log   │
└──────────────┘       └──────────────────┘       └──────────────┘

┌──────────────┐       ┌──────────────────┐
│   invoices   │──1:N──│   payments       │
└──────────────┘       └──────────────────┘
```

### Tablas Principales

```sql
-- Pacientes
CREATE TABLE patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL CHECK(document_type IN ('CC','TI','CE','PP','RC')),
    document_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    gender TEXT NOT NULL CHECK(gender IN ('M','F','O')),
    marital_status TEXT,
    phone TEXT NOT NULL,
    phone_secondary TEXT,
    email TEXT,
    address TEXT,
    eps TEXT,
    blood_type TEXT CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
    allergies TEXT,
    current_medications TEXT,
    medical_history TEXT,
    guardian_name TEXT,
    guardian_relationship TEXT,
    guardian_phone TEXT,
    photo_path TEXT,
    data_consent INTEGER NOT NULL DEFAULT 0,
    data_consent_date TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Doctores
CREATE TABLE doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_type TEXT NOT NULL,
    document_number TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    professional_license TEXT NOT NULL UNIQUE,
    specialty TEXT NOT NULL,
    university TEXT,
    phone TEXT NOT NULL,
    email TEXT,
    signature_path TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Procedimientos (catálogo)
CREATE TABLE procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cups_code TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    base_price REAL NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Historial de precios
CREATE TABLE procedure_price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    procedure_id INTEGER NOT NULL REFERENCES procedures(id),
    price REAL NOT NULL,
    effective_from TEXT NOT NULL,
    effective_to TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Citas
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    doctor_id INTEGER NOT NULL REFERENCES doctors(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' 
        CHECK(status IN ('scheduled','confirmed','in_progress','completed','cancelled','no_show')),
    reason TEXT,
    notes TEXT,
    discount_type TEXT CHECK(discount_type IN ('percentage','fixed')),
    discount_value REAL DEFAULT 0,
    total_amount REAL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Procedimientos por cita (N:M)
CREATE TABLE appointment_procedures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    appointment_id INTEGER NOT NULL REFERENCES appointments(id),
    procedure_id INTEGER NOT NULL REFERENCES procedures(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL,
    discount_type TEXT CHECK(discount_type IN ('percentage','fixed')),
    discount_value REAL DEFAULT 0,
    final_price REAL NOT NULL,
    tooth_number TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Odontogramas
CREATE TABLE odontograms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    type TEXT NOT NULL CHECK(type IN ('initial','evolution')),
    appointment_id INTEGER REFERENCES appointments(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Hallazgos del odontograma
CREATE TABLE odontogram_findings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    odontogram_id INTEGER NOT NULL REFERENCES odontograms(id),
    tooth_number TEXT NOT NULL,
    face TEXT CHECK(face IN ('vestibular','lingual','mesial','distal','occlusal','incisal','full')),
    finding TEXT NOT NULL,
    color_code TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Historia clínica
CREATE TABLE clinical_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL UNIQUE REFERENCES patients(id),
    chief_complaint TEXT,
    present_illness TEXT,
    personal_history TEXT,
    family_history TEXT,
    extraoral_exam TEXT,
    intraoral_exam TEXT,
    diagnosis TEXT,
    diagnosis_cie10 TEXT,
    treatment_plan TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Evoluciones (entradas secuenciales de historia clínica)
CREATE TABLE evolutions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clinical_history_id INTEGER NOT NULL REFERENCES clinical_histories(id),
    appointment_id INTEGER REFERENCES appointments(id),
    doctor_id INTEGER NOT NULL REFERENCES doctors(id),
    sequence_number INTEGER NOT NULL,
    subjective TEXT,
    objective TEXT,
    assessment TEXT,
    plan TEXT,
    notes TEXT,
    is_locked INTEGER NOT NULL DEFAULT 0,
    locked_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Documentos
CREATE TABLE documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    type TEXT NOT NULL CHECK(type IN ('photo','xray','consent','authorization','lab_result','other')),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Consentimientos informados
CREATE TABLE consents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    procedure_id INTEGER REFERENCES procedures(id),
    template_name TEXT NOT NULL,
    generated_pdf_path TEXT,
    signed_pdf_path TEXT,
    signature_method TEXT CHECK(signature_method IN ('in_person','remote','manual')),
    signed_at TEXT,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK(status IN ('pending','sent','signed','expired')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Usuarios
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('master','doctor','auxiliary')),
    doctor_id INTEGER REFERENCES doctors(id),
    display_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    failed_login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    last_login TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Log de auditoría
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Facturas/Recibos
CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_number TEXT NOT NULL UNIQUE,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    subtotal REAL NOT NULL,
    discount REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK(status IN ('pending','partial','paid','cancelled')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pagos
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash','transfer','card','mixed')),
    reference TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Configuración del sistema
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Decisiones Arquitectónicas

### DA-01: Tauri v2 sobre Electron

| Criterio | Tauri | Electron |
|----------|-------|----------|
| Tamaño binario | ~10-15 MB | ~150+ MB |
| RAM en uso | ~30-50 MB | ~150-300 MB |
| Backend | Rust (nativo, seguro) | Node.js |
| Acceso a sistema | Nativo vía Rust | Limitado |
| SQLite | rusqlite (compilado) | better-sqlite3 (addon) |

**Decisión:** Tauri v2. El consultorio probablemente tiene un equipo modesto. Menos RAM, arranque rápido, binario pequeño.

### DA-02: Filesystem para documentos (no BLOB en SQLite)

**Problema:** Radiografías panorámicas: 5-15 MB. CBCT: 50-100+ MB. SQLite se degrada con BLOBs grandes y el backup se vuelve inmanejable.

**Decisión:** Archivos en filesystem con estructura organizada. BD solo guarda la referencia (path relativo). La ruta base es configurable.

**Beneficios:**
- BD liviana y rápida
- Backup incremental posible (solo archivos nuevos)
- Acceso directo a archivos si se necesita migrar
- Visualización sin cargar todo en memoria

### DA-03: Canvas HTML5 para odontograma (no SVG, no librería externa)

**Justificación:** 
- Control total sobre la geometría y colores de cada diente
- Interactividad precisa (click en cara específica)
- No dependemos de librerías de terceros que pueden dejar de mantenerse
- Rendimiento superior para actualización parcial del canvas

### DA-04: Generación de PDF en Rust (backend)

**Justificación:**
- `printpdf` genera PDF sin dependencias externas ni headless browser
- Los consentimientos usan plantillas con placeholders que se llenan desde la BD
- La generación es rápida y no bloquea la UI
- El PDF se guarda en filesystem y se referencia en BD

### DA-05: Sin ORM — queries SQL directos con rusqlite

**Justificación:**
- ORMs en Rust (Diesel, SeaORM) añaden complejidad de compilación significativa
- Para una BD con ~15 tablas, queries directos son manejables
- Repositorios tipados con structs dan seguridad sin overhead de ORM
- Migraciones manuales versionadas dan control total

### DA-06: Autenticación local (no tokens JWT)

**Justificación:**
- Aplicación de escritorio monousuario-simultáneo
- No hay servidor HTTP ni API REST expuesta
- Sesión = estado en memoria del proceso Tauri
- Hash de contraseña con Argon2id + verificación en cada acción sensible

### DA-07: Arquitectura Frontend por Features (Screaming Architecture)

**Justificación:**
- Cada módulo es autocontenido: pages, components, hooks, types
- Fácil de navegar: "¿dónde está la lógica de citas?" → `features/appointments/`
- Escala sin crear carpetas genéricas desbordadas
- Shared solo para lo genuinamente transversal (UI kit, layout, utils)

---

## Flujos Críticos

### Flujo de Cita con Múltiples Procedimientos

```
1. Auxiliar agenda cita (paciente + doctor + fecha/hora + motivo)
2. Doctor inicia atención → estado "in_progress"
3. Doctor selecciona procedimientos realizados del catálogo
4. Sistema calcula subtotal
5. Doctor/Auxiliar aplica descuento (por procedimiento o global)
6. Doctor registra evolución en historia clínica
7. Doctor actualiza odontograma (si aplica)
8. Doctor marca cita como "completed"
9. Sistema genera factura/recibo
10. Auxiliar registra pago (total o abono)
```

### Flujo de Consentimiento Informado

```
1. Doctor selecciona plantilla de consentimiento
2. Sistema auto-llena datos: paciente, procedimiento, doctor, fecha
3. Opciones:
   a) Firma presencial: canvas en pantalla → captura imagen → PDF firmado
   b) Firma remota: genera PDF → genera link WhatsApp → envía manual → 
      paciente firma → paciente devuelve → auxiliar sube documento firmado
4. Consentimiento queda asociado a paciente + cita + procedimiento
```

### Flujo de Backup

```
1. Manual: usuario presiona "Generar Backup"
2. Sistema crea ZIP con: archivo SQLite + carpeta completa de documentos
3. ZIP se guarda en ruta configurada
4. Automático: mismo proceso ejecutado por scheduler interno (configurable)
5. Restauración: usuario selecciona ZIP → sistema verifica integridad → reemplaza BD y archivos
```

---

## Seguridad

| Aspecto | Implementación |
|---------|---------------|
| Contraseñas | Argon2id con salt aleatorio |
| Sesión | Estado en memoria, timeout configurable (default: 30 min inactividad) |
| Datos sensibles | BD cifrada con SQLCipher (evaluar `rusqlite` feature `bundled-sqlcipher`) |
| Auditoría | Tabla append-only, no editable desde la UI |
| Permisos | Verificación en cada Tauri command antes de ejecutar |
| Archivos | Paths sanitizados, no se exponen rutas absolutas al frontend |

---

## Configuración del Sistema (settings)

| Clave | Valor Default | Descripción |
|-------|---------------|-------------|
| `clinic_name` | - | Nombre del consultorio |
| `clinic_nit` | - | NIT del consultorio |
| `clinic_address` | - | Dirección |
| `clinic_phone` | - | Teléfono |
| `clinic_logo_path` | - | Logo para documentos |
| `documents_base_path` | `./data` | Ruta base para almacenamiento de archivos |
| `backup_path` | `./backups` | Ruta de destino de backups |
| `backup_auto_enabled` | `false` | Backup automático habilitado |
| `backup_auto_frequency` | `daily` | Frecuencia (daily/weekly) |
| `session_timeout_minutes` | `30` | Timeout de inactividad |
| `max_login_attempts` | `5` | Intentos antes de bloqueo |
| `invoice_next_number` | `1` | Siguiente número de factura |

---

## Dependencias Principales (Cargo.toml)

```toml
[dependencies]
tauri = { version = "2", features = ["shell-open"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.31", features = ["bundled"] }
argon2 = "0.5"
chrono = { version = "0.4", features = ["serde"] }
printpdf = "0.7"
uuid = { version = "1", features = ["v4"] }
zip = "2"
tokio = { version = "1", features = ["full"] }
thiserror = "1"
log = "0.4"
env_logger = "0.11"
```

## Dependencias Frontend (package.json)

```json
{
  "dependencies": {
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "react-router-dom": "7.x",
    "@tauri-apps/api": "2.x",
    "@tauri-apps/plugin-dialog": "2.x",
    "@tauri-apps/plugin-fs": "2.x",
    "lucide-react": "0.x",
    "date-fns": "4.x",
    "zustand": "5.x"
  },
  "devDependencies": {
    "typescript": "5.x",
    "vite": "6.x",
    "@vitejs/plugin-react": "4.x",
    "tailwindcss": "4.x",
    "@tailwindcss/vite": "4.x"
  }
}
```
