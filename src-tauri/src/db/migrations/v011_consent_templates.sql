-- Editable consent templates stored in DB
CREATE TABLE IF NOT EXISTS consent_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- Seed default templates
INSERT OR IGNORE INTO consent_templates (key, name, content) VALUES
('general', 'Consentimiento General de Tratamiento',
'DECLARACIÓN DE CONSENTIMIENTO INFORMADO

Yo, el/la paciente identificado(a) anteriormente, declaro que:

1. He sido informado(a) sobre mi condición de salud oral actual.
2. Se me ha explicado el tratamiento propuesto, sus beneficios y riesgos.
3. Entiendo las alternativas de tratamiento disponibles.
4. Se me ha informado sobre las posibles complicaciones.
5. He tenido la oportunidad de hacer preguntas y han sido respondidas.
6. Entiendo que el resultado del tratamiento no puede ser garantizado.

AUTORIZO al profesional de salud oral a realizar el procedimiento descrito, incluyendo procedimientos adicionales que se consideren necesarios durante el curso del tratamiento.

Declaro que he leído y comprendido este documento en su totalidad.'),

('endodoncia', 'Consentimiento para Endodoncia',
'CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE ENDODONCIA

Se me ha explicado que requiero un tratamiento de conducto (endodoncia) que consiste en la remoción del tejido pulpar (nervio) del diente.

RIESGOS Y COMPLICACIONES POSIBLES:
• Fractura del instrumento dentro del conducto
• Perforación de la raíz
• Dolor o inflamación postoperatoria
• Necesidad de retratamiento
• Posible pérdida del diente a pesar del tratamiento
• Cambio de coloración del diente tratado

Entiendo que después del tratamiento se requiere una restauración (corona) para proteger el diente de fracturas.

AUTORIZO la realización del procedimiento descrito.'),

('exodoncia', 'Consentimiento para Extracción Dental',
'CONSENTIMIENTO INFORMADO PARA EXTRACCIÓN DENTAL

Se me ha explicado que requiero la extracción de una o más piezas dentales.

RIESGOS Y COMPLICACIONES POSIBLES:
• Dolor, inflamación y sangrado postoperatorio
• Infección del sitio quirúrgico (alveolitis)
• Fractura de la raíz o del hueso alveolar
• Comunicación oroantral (dientes superiores)
• Lesión de nervios (parestesia labial o lingual)
• Lesión de dientes adyacentes

INDICACIONES POSTOPERATORIAS:
• No escupir ni usar pajilla por 24 horas
• Aplicar hielo las primeras 24 horas
• Dieta blanda y fría las primeras 48 horas
• Tomar los medicamentos prescritos

AUTORIZO la realización del procedimiento descrito.'),

('cirugia_oral', 'Consentimiento para Cirugía Oral',
'CONSENTIMIENTO INFORMADO PARA CIRUGÍA ORAL

Se me ha explicado que requiero un procedimiento quirúrgico oral.

RIESGOS Y COMPLICACIONES POSIBLES:
• Dolor, inflamación y sangrado postoperatorio
• Infección de la herida quirúrgica
• Lesión de estructuras nerviosas
• Necesidad de procedimientos adicionales
• Cicatrización anormal

AUTORIZO la realización del procedimiento quirúrgico descrito.'),

('implantes', 'Consentimiento para Implantes Dentales',
'CONSENTIMIENTO INFORMADO PARA IMPLANTES DENTALES

Se me ha explicado que requiero la colocación de implante(s) dental(es).

RIESGOS Y COMPLICACIONES POSIBLES:
• Rechazo o no osteointegración del implante
• Infección periimplantaria
• Lesión de nervios o estructuras adyacentes
• Perforación del seno maxilar
• Necesidad de injerto óseo adicional
• Fractura del implante

Entiendo que el proceso completo puede durar varios meses y requiere múltiples citas.

AUTORIZO la realización del procedimiento descrito.'),

('ortodoncia', 'Consentimiento para Ortodoncia',
'CONSENTIMIENTO INFORMADO PARA TRATAMIENTO DE ORTODONCIA

Se me ha explicado que requiero tratamiento de ortodoncia para corregir la posición de mis dientes.

RIESGOS Y COMPLICACIONES POSIBLES:
• Reabsorción radicular
• Descalcificación del esmalte
• Irritación de tejidos blandos
• Dolor y molestias durante el ajuste
• Recidiva tras el tratamiento
• Duración mayor a la estimada

Entiendo que debo mantener excelente higiene oral durante el tratamiento.

AUTORIZO el inicio del tratamiento de ortodoncia.'),

('blanqueamiento', 'Consentimiento para Blanqueamiento',
'CONSENTIMIENTO INFORMADO PARA BLANQUEAMIENTO DENTAL

Se me ha explicado que el procedimiento consiste en aclarar el color de mis dientes.

RIESGOS Y COMPLICACIONES POSIBLES:
• Sensibilidad dental transitoria
• Irritación gingival
• Resultado variable según el caso
• Necesidad de mantenimiento periódico
• Las restauraciones existentes no cambian de color

AUTORIZO la realización del blanqueamiento dental.'),

('protesis', 'Consentimiento para Prótesis Dental',
'CONSENTIMIENTO INFORMADO PARA PRÓTESIS DENTAL

Se me ha explicado que requiero la elaboración de una prótesis dental (fija o removible).

RIESGOS Y COMPLICACIONES POSIBLES:
• Período de adaptación con molestias
• Posible desgaste de dientes pilares
• Necesidad de ajustes posteriores
• Fractura de la prótesis
• Alteración temporal del habla

Entiendo que debo asistir a controles periódicos para verificar el estado de la prótesis.

AUTORIZO la elaboración e instalación de la prótesis dental.'),

('periodoncia', 'Consentimiento para Tratamiento Periodontal',
'CONSENTIMIENTO INFORMADO PARA TRATAMIENTO PERIODONTAL

Se me ha explicado que padezco enfermedad periodontal y requiero tratamiento.

RIESGOS Y COMPLICACIONES POSIBLES:
• Sensibilidad dental aumentada
• Recesión gingival
• Movilidad dental temporal
• Necesidad de mantenimiento periódico
• Posible pérdida de piezas con pronóstico desfavorable

Entiendo que debo mantener controles periódicos y excelente higiene oral.

AUTORIZO el inicio del tratamiento periodontal.'),

('radiografia', 'Consentimiento para Toma de Radiografías',
'CONSENTIMIENTO INFORMADO PARA TOMA DE RADIOGRAFÍAS

Se me ha explicado que es necesaria la toma de radiografías para el diagnóstico y plan de tratamiento.

INFORMACIÓN:
• La dosis de radiación es mínima y segura
• Se utilizan protectores de plomo
• El beneficio diagnóstico supera el riesgo

CONTRAINDICACIONES:
• Informar si existe posibilidad de embarazo
• Informar sobre tratamientos de radioterapia previos

AUTORIZO la toma de las radiografías necesarias.');
