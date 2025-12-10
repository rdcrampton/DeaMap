# Especificación del Formato CSV para Importación de DEAs

## 📋 Tabla de Contenidos

1. [Configuración del Archivo](#configuración-del-archivo)
2. [Campos Obligatorios](#campos-obligatorios)
3. [Especificación Completa de Campos](#especificación-completa-de-campos)
4. [Ejemplos de Valores](#ejemplos-de-valores)
5. [Validaciones](#validaciones)
6. [Casos Especiales](#casos-especiales)

---

## Configuración del Archivo

```
Formato: CSV (Comma-Separated Values)
Separador: punto y coma (;)
Codificación: UTF-8 con BOM
Primera fila: Encabezados (nombres exactos)
Formato decimal: punto (.) para números decimales
Líneas vacías: se ignoran automáticamente
```

---

## Campos Obligatorios

Para que un registro sea válido, **DEBE** contener como mínimo:

| Campo                       | Descripción                                  |
| --------------------------- | -------------------------------------------- |
| `Propuesta de denominación` | Nombre del establecimiento donde está el DEA |
| `Nombre de la vía`          | Nombre de la calle/avenida/plaza             |
| `Número de la vía`          | Número del inmueble                          |

**Nota:** Aunque solo estos 3 campos son obligatorios, se recomienda encarecidamente proporcionar más información para mejorar la calidad de los datos y la detección de duplicados.

---

## Especificación Completa de Campos

### SECCIÓN 1: Identificación y Metadatos

#### `Id`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Descripción:** Identificador único del registro en el sistema origen
- **Ejemplo:** "1", "ABC-123", "FORM-2025-001"
- **Uso:** Trazabilidad del origen del registro

#### `Número provisional DEA`

- **Tipo:** Número entero
- **Obligatorio:** No (pero muy recomendado)
- **Formato:** Solo dígitos
- **Ejemplo:** "1234", "5678"
- **Importancia:** ⭐⭐⭐ **Suma +15 puntos en detección de duplicados**
- **Uso:** Identificador provisional antes de asignar código definitivo
- **Nota:** Se usa internamente antes de generar el código definitivo

#### `Código DEA`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `##-####` (distrito-secuencial)
- **Ejemplo:** "01-1234", "21-0056"
- **Uso:** Código oficial definitivo del DEA

#### `Referencia externa`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Ejemplo:** "REF-API-2025-001", "LEGACY-1234", "FORM-12345"
- **Uso:** Referencia del sistema externo de origen (APIs, formularios, legacy)
- **Nota:** Diferente del número provisional - este es para trazabilidad de origen

---

### SECCIÓN 2: Información del Establecimiento

#### `Propuesta de denominación`

- **Tipo:** Texto libre
- **Obligatorio:** ✅ **SÍ**
- **Longitud:** 1-500 caracteres
- **Ejemplo:** "Hospital General de Madrid", "Farmacia García"
- **Importancia:** ⭐⭐⭐⭐⭐ **Suma +30 puntos en detección de duplicados**
- **Notas:**
  - Es el nombre que aparecerá en el mapa
  - Debe ser descriptivo y único
  - Evitar abreviaturas poco claras

#### `Tipo de establecimiento`

- **Tipo:** Texto (lista cerrada)
- **Obligatorio:** No (pero muy recomendado)
- **Valores permitidos:**
  - Hospital
  - Centro de salud
  - Farmacia
  - Centro comercial
  - Instalación deportiva
  - Polideportivo
  - Edificio administrativo
  - Centro educativo
  - Estación de transporte
  - Hotel
  - Restaurante
  - Empresa privada
  - Centro cultural
  - Residencia
  - Otro
- **Importancia:** ⭐⭐ **Suma +10 puntos en detección de duplicados**
- **Ejemplo:** "Hospital", "Farmacia", "Polideportivo"

#### `Titularidad`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Valores comunes:** "Pública", "Privada", "Concertada", "Mixta"
- **Ejemplo:** "Pública - Comunidad de Madrid"
- **Uso:** Propiedad general del DEA

#### `Titularidad del local`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Ejemplo:** "Ayuntamiento de Madrid", "Empresa privada"
- **Uso:** Propiedad específica del inmueble

#### `Uso del local`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Ejemplo:** "Sanitario", "Comercial", "Deportivo", "Administrativo"
- **Uso:** Uso principal del local

#### `Observaciones origen`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 2000 caracteres
- **Ejemplo:** "Importado desde sistema municipal 2025"
- **Uso:** Notas sobre el origen de los datos

---

### SECCIÓN 3: Dirección

#### `Tipo de vía`

- **Tipo:** Texto (lista cerrada)
- **Obligatorio:** No (pero recomendado)
- **Valores permitidos:**
  - Calle
  - Avenida
  - Plaza
  - Paseo
  - Ronda
  - Camino
  - Carretera
  - Glorieta
  - Travesía
  - Callejón
  - Costanilla
  - Cuesta
- **Importancia:** ⭐⭐⭐ **Parte de dirección (+25 puntos si coincide completa)**
- **Ejemplo:** "Calle", "Avenida", "Plaza"

#### `Nombre de la vía`

- **Tipo:** Texto libre
- **Obligatorio:** ✅ **SÍ**
- **Longitud:** 1-200 caracteres
- **Importancia:** ⭐⭐⭐⭐⭐ **Parte de dirección (+25 puntos si coincide completa)**
- **Ejemplo:** "Mayor", "Gran Vía", "del Sol"
- **Notas:** No incluir el tipo de vía aquí (usar campo separado)

#### `Número de la vía`

- **Tipo:** Texto alfanumérico
- **Obligatorio:** ✅ **SÍ**
- **Formato:** Libre (admite "s/n", "bis", etc.)
- **Importancia:** ⭐⭐⭐⭐⭐ **Parte de dirección (+25 puntos si coincide completa)**
- **Ejemplo:** "14", "23 bis", "s/n", "1-3"
- **Notas:** Usar "s/n" para sin número

#### `Complemento de dirección`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 200 caracteres
- **Ejemplo:** "Edificio A", "Puerta 3", "Local 2", "Km 5"
- **Uso:** Información adicional de la dirección

#### `Código postal`

- **Tipo:** Texto numérico
- **Obligatorio:** No (pero muy recomendado)
- **Formato:** 5 dígitos
- **Importancia:** ⭐⭐⭐ **Suma +5 puntos en duplicados + fallback búsqueda**
- **Ejemplo:** "28001", "28080"
- **Notas:** Usado como fallback si no hay coordenadas GPS

#### `Ciudad`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Ejemplo:** "Madrid", "Barcelona", "Valencia"
- **Uso:** Nombre de la ciudad

#### `Código ciudad`

- **Tipo:** Texto numérico
- **Obligatorio:** No
- **Formato:** Código INE
- **Ejemplo:** "079" (Madrid), "08019" (Barcelona)
- **Uso:** Código oficial INE de la ciudad

#### `Distrito`

- **Tipo:** Texto libre o código
- **Obligatorio:** No
- **Ejemplo:** "Centro", "01", "Chamberí"
- **Uso:** Distrito administrativo

---

### SECCIÓN 4: Ubicación Específica y Acceso

#### `Planta`

- **Tipo:** Texto libre
- **Obligatorio:** No (pero recomendado para edificios multipiso)
- **Importancia:** ⭐⭐⭐⭐ **CRÍTICO: Resta -20 puntos si es diferente**
- **Ejemplo:** "Planta 3", "Planta Baja", "Sótano -1", "Baja"
- **Uso:** Permite múltiples DEAs en mismo edificio
- **Notas:**
  - Esencial para edificios con varios DEAs
  - Evita falsos positivos en detección de duplicados

#### `Ubicación específica`

- **Tipo:** Texto libre
- **Obligatorio:** No (pero recomendado)
- **Longitud:** Hasta 500 caracteres
- **Importancia:** ⭐⭐⭐⭐ **CRÍTICO: Resta -20 puntos si es diferente**
- **Ejemplo:** "Botiquín principal", "Pista 1", "Sala de emergencias", "Recepción"
- **Uso:** Permite múltiples DEAs en mismo complejo
- **Notas:**
  - Muy importante en polideportivos (pista 1, pista 5, etc.)
  - Importante en hospitales (urgencias, planta 3, etc.)

#### `Instrucciones de acceso`

- **Tipo:** Texto libre
- **Obligatorio:** No (pero muy recomendado)
- **Longitud:** Hasta 2000 caracteres
- **Importancia:** ⭐⭐⭐ **Resta -15 puntos si es diferente**
- **Ejemplo:** "Por entrada principal, ascensor A hasta planta 3, girar a la derecha. Frente a recepción de urgencias. Requiere tarjeta de acceso fuera de horario."
- **Uso:** Instrucciones completas de cómo llegar al DEA
- **Notas:**
  - Combina descripción de acceso, referencias visibles y advertencias
  - Ser específico, claro y completo
  - Incluir cualquier restricción o requisito de acceso
  - Información pública visible en el mapa

#### `Comentarios públicos`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 2000 caracteres
- **Ejemplo:** "Instalado en enero 2025. Acceso libre en horario de apertura. Personal formado disponible."
- **Uso:** Información adicional pública sobre el DEA
- **Notas:**
  - Visible para el público en general
  - Evitar información sensible o privada
  - Información que ayude a los ciudadanos

---

### SECCIÓN 5: Coordenadas GPS

#### `Coordenadas-Latitud (norte)`

- **Tipo:** Número decimal
- **Obligatorio:** No (pero muy muy recomendado)
- **Formato:** Decimal con punto (.)
- **Rango:** -90 a 90 (positivo para hemisferio norte)
- **Precisión:** Mínimo 6 decimales recomendado
- **Importancia:** ⭐⭐⭐⭐⭐ **CRÍTICO: Suma +20 puntos + búsqueda espacial**
- **Ejemplo:** "40.416775" (Madrid), "41.385064" (Barcelona)
- **Notas:**
  - Esencial para detección de duplicados eficiente
  - Permite búsqueda en radio de 100 metros
  - Si no hay coordenadas, se usa código postal (menos eficiente)

#### `Coordenadas-Longitud (oeste, por lo tanto, negativa)`

- **Tipo:** Número decimal
- **Obligatorio:** No (pero muy muy recomendado)
- **Formato:** Decimal con punto (.)
- **Rango:** -180 a 180 (negativo para hemisferio oeste)
- **Precisión:** Mínimo 6 decimales recomendado
- **Importancia:** ⭐⭐⭐⭐⭐ **CRÍTICO: Suma +20 puntos + búsqueda espacial**
- **Ejemplo:** "-3.703790" (Madrid), "2.173403" (Barcelona)
- **Notas:**
  - En España siempre negativo (hemisferio oeste)
  - Debe proporcionarse junto con latitud

#### `Precisión coordenadas`

- **Tipo:** Texto
- **Obligatorio:** No
- **Valores sugeridos:** "GPS", "Aproximada", "Manual", "Google Maps", "Estimada"
- **Ejemplo:** "GPS", "Aproximada - Google Maps"
- **Uso:** Indica la fiabilidad de las coordenadas

---

### SECCIÓN 6: Horarios

#### `Horario de apertura del establecimiento`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 500 caracteres
- **Ejemplo:** "De lunes a viernes de 9:00 a 21:00. Sábados de 10:00 a 14:00. Domingos cerrado."
- **Uso:** Descripción general en texto libre

#### `Hora de APERTURA de lunes a viernes`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `HH:MM` (24 horas)
- **Ejemplo:** "09:00", "08:30", "00:00" (si 24h)
- **Notas:** Usar "00:00" y "23:59" para 24 horas

#### `Hora de CIERRE de lunes a viernes`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `HH:MM` (24 horas)
- **Ejemplo:** "21:00", "22:30", "23:59" (si 24h)

#### `Hora de APERTURA los sábados`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `HH:MM` o "Cerrado"
- **Ejemplo:** "10:00", "09:00", "Cerrado"

#### `Hora de CIERRE los sábados`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `HH:MM` o "Cerrado"
- **Ejemplo:** "14:00", "20:00", "Cerrado"

#### `Hora de APERTURA los domingos`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `HH:MM` o "Cerrado"
- **Ejemplo:** "Cerrado", "10:00"

#### `Hora de CIERRE los domingos`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** `HH:MM` o "Cerrado"
- **Ejemplo:** "Cerrado", "14:00"

#### `¿Tiene vigilante 24 horas al día que pueda facilitar el desfibrilador en caso necesario aunque esté cerrado?`

- **Tipo:** Booleano (Sí/No)
- **Obligatorio:** No
- **Valores aceptados:** "Sí", "Si", "Yes", "No", "1", "0"
- **Ejemplo:** "Sí", "No"
- **Uso:** Indica si hay vigilancia 24h

#### `Acceso restringido`

- **Tipo:** Booleano (Sí/No)
- **Obligatorio:** No
- **Valores aceptados:** "Sí", "Si", "Yes", "No"
- **Ejemplo:** "Sí", "No"
- **Uso:** Indica si requiere autorización de acceso

#### `Festivos como día laborable`

- **Tipo:** Booleano (Sí/No)
- **Obligatorio:** No
- **Valores aceptados:** "Sí", "Si", "Yes", "No"
- **Ejemplo:** "Sí", "No"
- **Uso:** Indica si en festivos tiene horario de día laborable

#### `Cerrado en festivos`

- **Tipo:** Booleano (Sí/No)
- **Obligatorio:** No
- **Valores aceptados:** "Sí", "Si", "Yes", "No"
- **Ejemplo:** "Sí", "No"
- **Uso:** Indica si cierra en festivos

#### `Cerrado en agosto`

- **Tipo:** Booleano (Sí/No)
- **Obligatorio:** No
- **Valores aceptados:** "Sí", "Si", "Yes", "No"
- **Ejemplo:** "Sí", "No"
- **Uso:** Indica si cierra en el mes de agosto

#### `Excepciones horario`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 500 caracteres
- **Ejemplo:** "Cerrado del 1 al 15 de agosto", "Abierto festivos de zona"
- **Uso:** Excepciones especiales al horario regular

---

### SECCIÓN 7: Responsable

#### `Nombre`

- **Tipo:** Texto libre
- **Obligatorio:** No (pero recomendado)
- **Longitud:** 1-200 caracteres
- **Ejemplo:** "Juan García López", "María Rodríguez"
- **Uso:** Nombre del responsable del DEA

#### `Correo electrónico`

- **Tipo:** Email
- **Obligatorio:** No (pero recomendado)
- **Formato:** email@dominio.com
- **Ejemplo:** "contacto@hospital.com", "emergencias@ayuntamiento.es"
- **Validación:** Formato email válido
- **Uso:** Email de contacto principal

#### `Teléfono`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** Libre (admite varios formatos)
- **Ejemplo:** "+34 912345678", "912 34 56 78", "912345678"
- **Uso:** Teléfono de contacto principal

#### `Teléfono alternativo`

- **Tipo:** Texto
- **Obligatorio:** No
- **Formato:** Libre
- **Ejemplo:** "+34 612345678", "612 34 56 78"
- **Uso:** Teléfono de contacto secundario

#### `Organización`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 200 caracteres
- **Ejemplo:** "Hospital General de Madrid", "Ayuntamiento de Madrid", "Farmacia López S.L."
- **Uso:** Entidad u organización responsable

#### `Cargo`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 100 caracteres
- **Ejemplo:** "Director", "Responsable Seguridad", "Gerente", "Coordinador"
- **Uso:** Posición del responsable

#### `Departamento`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 100 caracteres
- **Ejemplo:** "Emergencias", "Mantenimiento", "Administración"
- **Uso:** Departamento al que pertenece

#### `Observaciones contacto`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 500 caracteres
- **Ejemplo:** "Disponible de 9 a 17h de lunes a viernes", "Contactar preferiblemente por email"
- **Uso:** Notas sobre disponibilidad

#### `Notas responsable`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 500 caracteres
- **Ejemplo:** "Solicitar cita previa", "Solo atención urgencias"
- **Uso:** Información adicional del responsable

---

### SECCIÓN 8: Imágenes

#### `Foto 1` a `Foto 6`

- **Tipo:** URL
- **Obligatorio:** No
- **Formato:** URL completa (http:// o https://)
- **Longitud:** Hasta 500 caracteres
- **Ejemplo:**
  - "https://sharepoint.empresa.com/sites/deas/images/foto1.jpg"
  - "https://drive.google.com/file/d/abc123/view"
- **Formatos aceptados:** .jpg, .jpeg, .png, .webp
- **Uso sugerido:**
  - Foto 1: Imagen frontal del DEA
  - Foto 2: Imagen de la ubicación/contexto
  - Foto 3: Imagen del acceso
  - Foto 4: Imagen de señalización
  - Foto 5: Imagen de contexto amplio
  - Foto 6: Imagen de placa identificativa
- **Notas especiales:**
  - Si son URLs de SharePoint, requieren autenticación
  - Se descargarán y almacenarán en AWS S3
  - Se aplicará detección de rostros y difuminado automático

---

### SECCIÓN 9: Estado y Validación

#### `Estado`

- **Tipo:** Texto (enum)
- **Obligatorio:** No
- **Valores permitidos:**
  - `DRAFT` - Borrador
  - `PENDING_REVIEW` - Pendiente de revisión
  - `PUBLISHED` - Publicado
  - `INACTIVE` - Inactivo
  - `REJECTED` - Rechazado
- **Ejemplo:** "PUBLISHED", "DRAFT"
- **Por defecto:** "DRAFT"
- **Uso:** Estado actual del DEA en el sistema

#### `Requiere atención`

- **Tipo:** Booleano (Sí/No)
- **Obligatorio:** No
- **Valores aceptados:** "Sí", "Si", "Yes", "No"
- **Ejemplo:** "Sí", "No"
- **Por defecto:** "No"
- **Uso:** Marca el DEA para revisión manual

#### `Motivo atención`

- **Tipo:** Texto libre
- **Obligatorio:** No (obligatorio si "Requiere atención" = Sí)
- **Longitud:** Hasta 500 caracteres
- **Ejemplo:** "Coordenadas aproximadas, requiere verificación", "Faltan imágenes"
- **Uso:** Razón por la que requiere atención

#### `Observaciones validación`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 1000 caracteres
- **Ejemplo:** "Verificado in situ el 15/01/2025", "Pendiente contacto con responsable"
- **Uso:** Notas del proceso de validación

#### `Notas internas`

- **Tipo:** Texto libre
- **Obligatorio:** No
- **Longitud:** Hasta 2000 caracteres
- **Ejemplo:** "Pendiente contacto con responsable", "Coordenadas validadas con GPS profesional"
- **Uso:** Notas de uso interno, no visibles públicamente

#### `Fecha publicación`

- **Tipo:** Fecha y hora (ISO 8601)
- **Obligatorio:** No
- **Formato:** `YYYY-MM-DDTHH:MM:SS`
- **Ejemplo:** "2025-01-15T00:00:00"
- **Uso:** Fecha en la que se publicó el DEA

---

## Ejemplos de Valores

### Hospital con vigilancia 24h

```
Propuesta de denominación: Hospital General de Madrid
Tipo de establecimiento: Hospital
Tipo de vía: Calle
Nombre de la vía: Mayor
Número de la vía: 14
Código postal: 28001
Planta: Planta 3
Ubicación específica: Sala de emergencias
Coordenadas-Latitud (norte): 40.416775
Coordenadas-Longitud (oeste, por lo tanto, negativa): -3.703790
¿Tiene vigilante 24 horas...?: Sí
Hora de APERTURA de lunes a viernes: 00:00
Hora de CIERRE de lunes a viernes: 23:59
```

### Farmacia con horario comercial

```
Propuesta de denominación: Farmacia García
Tipo de establecimiento: Farmacia
Tipo de vía: Avenida
Nombre de la vía: Gran Vía
Número de la vía: 45
Código postal: 28013
Ubicación específica: Entrada principal
Hora de APERTURA de lunes a viernes: 09:00
Hora de CIERRE de lunes a viernes: 21:00
Hora de APERTURA los sábados: 10:00
Hora de CIERRE los sábados: 14:00
Hora de APERTURA los domingos: Cerrado
Hora de CIERRE los domingos: Cerrado
```

### Polideportivo con múltiples DEAs

```
Propuesta de denominación: Polideportivo Municipal Norte - Pista 1
Tipo de establecimiento: Polideportivo
Ubicación específica: Pista 1
Planta: Planta Baja
---
Propuesta de denominación: Polideportivo Municipal Norte - Pista 5
Tipo de establecimiento: Polideportivo
Ubicación específica: Pista 5
Planta: Planta Baja
---
Propuesta de denominación: Polideportivo Municipal Norte - Botiquín
Tipo de establecimiento: Polideportivo
Ubicación específica: Botiquín principal
Planta: Planta 1
```

---

## Validaciones

### Validaciones Automáticas

1. **Campos Obligatorios**
   - Se verifica que existan: nombre, calle y número
   - Error si falta alguno de estos campos

2. **Formato de Coordenadas**
   - Latitud: -90 a 90
   - Longitud: -180 a 180
   - Formato: decimal con punto
   - Advertencia si están fuera de rango España

3. **Formato de Email**
   - Validación de formato email@dominio.com
   - Error si el formato es inválido

4. **Formato de Horarios**
   - Validación de formato HH:MM
   - Advertencia si no cumple formato

5. **URLs de Imágenes**
   - Validación de formato URL
   - Advertencia si no es accesible

### Validaciones de Negocio

1. **Detección de Duplicados**
   - Sistema automático de scoring 0-100 puntos
   - ≥80 puntos: Duplicado confirmado (se rechaza)
   - 60-79 puntos: Posible duplicado (se marca para revisión)
   - <60 puntos: No es duplicado (se importa)

2. **Validación de Dirección**
   - Se verifica contra base de datos oficial de viales
   - Se sugieren correcciones si hay errores
   - Se calculan coordenadas si faltan

3. **Coherencia de Horarios**
   - Advertencia si hora cierre < hora apertura
   - Advertencia si 24h pero horarios específicos

---

## Casos Especiales

### Mismo Edificio, Múltiples Plantas

```
IMPORTANTE: Usar campo "Planta" diferente para cada DEA

Correcto:
- DEA 1: Planta: "Planta 3"
- DEA 2: Planta: "Planta 7"
Resultado: Se importan ambos (penalty -20 por planta diferente)

Incorrecto:
- DEA 1: Planta: vacío
- DEA 2: Planta: vacío
Resultado: Se detecta como duplicado (score >80)
```

### Polideportivos y Complejos Grandes

```
IMPORTANTE: Usar campo "Ubicación específica" diferente

Correcto:
- DEA 1: Ubicación específica: "Pista 1"
- DEA 2: Ubicación específica: "Pista 5"
- DEA 3: Ubicación específica: "Botiquín"
Resultado: Se importan todos (penalty -20 por ubicación diferente)
```

### Sin Coordenadas GPS

```
Si no hay coordenadas, el sistema:
1. Busca por código postal (menos eficiente)
2. Si no hay código postal, busca en toda la BD (muy lento)

Recomendación: SIEMPRE proporcionar coordenadas GPS
```

### URLs de SharePoint

```
Las URLs de SharePoint requieren autenticación:
- El sistema pedirá cookies de sesión
- Las cookies se limpian automáticamente tras la importación
- Las imágenes se descargan y almacenan en AWS S3
```

### Números de Vía Especiales

```
Aceptados:
- "s/n" (sin número)
- "14 bis"
- "1-3" (rango)
- "Km 5" (carreteras)
```

---

##
