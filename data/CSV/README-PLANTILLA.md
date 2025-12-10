# 📊 Plantilla de Importación CSV - DEAs Madrid

Este directorio contiene plantillas y ejemplos para la importación masiva de DEAs (Desfibriladores Externos Automáticos).

## 📁 Archivos Disponibles

### 1. `plantilla-importacion-deas-ejemplos.csv`

Archivo CSV con **10 ejemplos reales** que cubren diferentes tipos de establecimientos y casos de uso.

### 2. Documentación Completa

Ver: `/docs/import/csv-format-specification.md` para especificación detallada de todos los campos.

---

## 🎯 Ejemplos Incluidos en la Plantilla

### Ejemplo 1: Hospital con Vigilancia 24h

**Escenario:** Hospital público con acceso 24/7 y personal de urgencias disponible siempre.

- ✅ Coordenadas GPS precisas
- ✅ Número provisional DEA
- ✅ Horario 24 horas
- ✅ Vigilancia 24h
- ✅ Múltiples fotos
- ✅ Estado: PUBLISHED

**Puntos clave:**

- Planta específica definida (Planta 3)
- Descripción detallada del acceso
- Información completa del responsable

---

### Ejemplo 2: Farmacia con Horario Comercial

**Escenario:** Farmacia privada con horario comercial estándar.

- ✅ Coordenadas GPS
- ✅ Horario de lunes a sábado
- ✅ Cerrado domingos
- ✅ Cierre en agosto
- ⚠️ Estado: DRAFT (pendiente validación)

**Puntos clave:**

- Sin planta especificada (local a pie de calle)
- Horarios comerciales normales
- Cierra en festivos

---

### Ejemplo 3: Centro Comercial

**Escenario:** Centro comercial con horario extendido, abierto todos los días.

- ✅ Coordenadas GPS precisas
- ✅ Vigilancia 24h (personal seguridad)
- ✅ Abierto 7 días a la semana
- ⚠️ Estado: PENDING_REVIEW
- ⚠️ Requiere atención: pendiente verificación

**Puntos clave:**

- Ubicación en zona pública del centro
- Acceso libre en horario de apertura
- Excepciones en festivos específicos

---

### Ejemplos 4, 5 y 6: Polideportivo con Múltiples DEAs

**Escenario:** Complejo deportivo con **3 DEAs en diferentes ubicaciones**.

#### 🏃 Polideportivo - Pista 1

- Planta Baja
- Ubicación específica: "Pista cubierta 1"
- Junto a botiquín de pista

#### 🏃 Polideportivo - Pista 5

- Planta Baja
- Ubicación específica: "Pista cubierta 5"
- Junto a botiquín de pista

#### 🏃 Polideportivo - Botiquín Principal

- Planta 1
- Ubicación específica: "Botiquín principal"
- Acceso restringido (solicitar en recepción)

**Importancia de este ejemplo:**

```
✅ CORRECTO: Usar campos "Planta" y "Ubicación específica" diferentes
   - Sistema detecta que NO son duplicados (penalty -20 por diferencias)
   - Se importan los 3 DEAs correctamente

❌ INCORRECTO: Dejar campos vacíos
   - Sistema detectaría como duplicados (score >80)
   - Se rechazarían 2 de los 3 registros
```

**Coordenadas:**

- Los 3 tienen las MISMAS coordenadas (mismo edificio)
- Las diferencias en "Planta" y "Ubicación específica" evitan duplicados

---

### Ejemplo 7: Centro de Salud

**Escenario:** Centro de salud público con urgencias 24h.

- ✅ Coordenadas GPS
- ✅ Horario administrativo + urgencias 24h
- ✅ Personal sanitario entrenado
- ✅ Estado: PUBLISHED

**Puntos clave:**

- Horario mixto: administrativo en horario laboral, urgencias 24h
- Verificado por Inspección Sanitaria
- Accesible para todo el público

---

### Ejemplos 8 y 9: Edificio Administrativo - Múltiples Plantas

**Escenario:** Edificio administrativo con **2 DEAs en plantas diferentes**.

#### 🏢 Edificio - Planta 2

- Planta: "Planta 2"
- Ubicación: "Pasillo central, junto a ascensores"

#### 🏢 Edificio - Planta 5

- Planta: "Planta 5"
- Ubicación: "Pasillo central, junto a ascensores"

**Importancia de este ejemplo:**

```
✅ Mismo edificio, mismas coordenadas GPS
✅ Campo "Planta" diferente → NO son duplicados
✅ Se importan ambos correctamente

Detección de duplicados:
- Nombre similar: +30
- Dirección igual: +25
- Coordenadas iguales: +20
- Planta diferente: -20
= Score: ~55 → NO ES DUPLICADO ✅
```

**Características:**

- Acceso restringido (requiere identificación)
- Horario administrativo
- Cerrado en agosto

---

### Ejemplo 10: Hotel - Datos Legacy sin Coordenadas

**Escenario:** Datos migrados de sistema antiguo SIN coordenadas GPS exactas.

- ❌ Sin coordenadas GPS (solo latitud aproximada)
- ⚠️ Requiere atención: visita para tomar coordenadas
- ⚠️ Estado: PENDING_REVIEW

**Importancia de este ejemplo:**

```
⚠️ SIN COORDENADAS GPS:
- Sistema busca por código postal (menos eficiente)
- Mayor riesgo de no detectar duplicados
- Requiere revisión manual

Recomendación: SIEMPRE proporcionar coordenadas GPS precisas
```

---

## 🔍 Detección de Duplicados - Casos Demostrados

### ✅ Caso 1: Mismo Polideportivo, Diferentes Ubicaciones

```
Polideportivo - Pista 1 vs Polideportivo - Pista 5

Score de duplicado:
+ Nombre similar (0.9): +27
+ Dirección igual: +25
+ Coordenadas iguales (0m): +20
+ CP igual: +5
- Ubicación específica diferente: -20
= 57 puntos → NO DUPLICADO ✅
```

### ✅ Caso 2: Mismo Edificio, Diferentes Plantas

```
Edificio Planta 2 vs Edificio Planta 5

Score de duplicado:
+ Nombre similar (0.95): +28.5
+ Dirección igual: +25
+ Coordenadas iguales (0m): +20
+ CP igual: +5
- Planta diferente: -20
= 58.5 puntos → NO DUPLICADO ✅
```

---

## 📋 Campos Obligatorios Mínimos

Para que un registro sea válido:

```
✅ Propuesta de denominación
✅ Nombre de la vía
✅ Número de la vía
```

## ⭐ Campos Altamente Recomendados

Para optimizar la detección de duplicados:

```
⭐ Coordenadas GPS (Latitud y Longitud) → +20 puntos + búsqueda eficiente
⭐ Número provisional DEA → +15 puntos
⭐ Tipo de establecimiento → +10 puntos
⭐ Código postal → +5 puntos + fallback búsqueda
⭐ Tipo de vía → Parte de dirección (+25 puntos)
```

## 🎨 Campos para Diferenciar en Mismo Edificio

```
🏢 Planta → -20 puntos si diferente
🏢 Ubicación específica → -20 puntos si diferente
🏢 Descripción acceso → -15 puntos si diferente
🏢 Referencias visibles → -10 puntos si diferente
```

---

## 🚀 Cómo Usar la Plantilla

### Opción 1: Copiar y Modificar Ejemplos

1. Abrir `plantilla-importacion-deas-ejemplos.csv`
2. Copiar la fila de ejemplo más similar a tu caso
3. Modificar los valores según tus datos
4. Eliminar ejemplos que no uses

### Opción 2: Crear desde Cero

1. Copiar la línea de encabezados (primera línea)
2. Añadir tus registros línea por línea
3. Asegurarte de incluir los campos obligatorios

### Opción 3: Plantilla Vacía

```csv
Id;Hora de inicio;Hora de finalización;Número provisional DEA;Código DEA;Referencia externa;Propuesta de denominación;Tipo de establecimiento;Titularidad;Titularidad del local;Uso del local;Observaciones origen;Tipo de vía;Nombre de la vía;Número de la vía;Complemento de dirección;Código postal;Ciudad;Código ciudad;Distrito;Planta;Ubicación específica;Descripción acceso;Referencias visibles;Observaciones ubicación;Advertencias acceso;Comentario libre;Coordenadas-Latitud (norte);Coordenadas-Longitud (oeste, por lo tanto, negativa);Precisión coordenadas;Horario de apertura del establecimiento;Hora de APERTURA de lunes a viernes;Hora de CIERRE de lunes a viernes;Hora de APERTURA los sábados;Hora de CIERRE los sábados;Hora de APERTURA los domingos;Hora de CIERRE los domingos;¿Tiene vigilante 24 horas al día que pueda facilitar el desfibrilador en caso necesario aunque esté cerrado?;Acceso restringido;Festivos como día laborable;Cerrado en festivos;Cerrado en agosto;Excepciones horario;Nombre;Correo electrónico;Teléfono;Teléfono alternativo;Organización;Cargo;Departamento;Observaciones contacto;Notas responsable;Foto 1;Foto 2;Foto 3;Foto 4;Foto 5;Foto 6;Estado;Requiere atención;Motivo atención;Observaciones validación;Notas internas;Fecha publicación

```

---

## ⚙️ Configuración del Archivo

```
Separador: punto y coma (;)
Codificación: UTF-8 con BOM (Byte Order Mark)
Primera fila: Encabezados (obligatorio)
Formato decimal: punto (.) para coordenadas
Formato fecha: ISO 8601 (YYYY-MM-DDTHH:MM:SS)
```

**Nota sobre codificación:**

- El archivo de ejemplo usa **UTF-8 con BOM** para compatibilidad con Excel
- Esto asegura que caracteres especiales (ñ, tildes, etc.) se muestren correctamente
- Excel reconoce automáticamente el archivo como UTF-8 gracias al BOM

---

## ✅ Checklist Pre-Importación

Antes de importar tu CSV, verifica:

- [ ] El archivo usa punto y coma (;) como separador
- [ ] La primera línea contiene los encabezados exactos
- [ ] Todos los registros tienen los 3 campos obligatorios
- [ ] Las coordenadas GPS usan punto (.) como decimal
- [ ] Las coordenadas de longitud son negativas (España está al oeste)
- [ ] Los horarios están en formato HH:MM (24 horas)
- [ ] Los campos booleanos usan "Sí" o "No"
- [ ] Has incluido "Planta" y/o "Ubicación específica" si hay múltiples DEAs
- [ ] Las URLs de imágenes son completas (http:// o https://)
- [ ] Has revisado que no haya campos truncados

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Duplicados detectados pero no son duplicados"

**Causa:** Falta especificar "Planta" o "Ubicación específica"
**Solución:** Añadir información que diferencie las ubicaciones

### Problema 2: "Coordenadas inválidas"

**Causa:** Usar coma (,) en lugar de punto (.)
**Solución:** Cambiar formato: `40,416775` → `40.416775`

### Problema 3: "Importación muy lenta"

**Causa:** Faltan coordenadas GPS y código postal
**Solución:** Añadir coordenadas GPS (búsqueda 100x más rápida)

### Problema 4: "URLs de SharePoint no funcionan"

**Causa:** Requieren autenticación
**Solución:** El sistema pedirá cookies de autenticación durante la importación

### Problema 5: "Registros marcados para revisión"

**Causa:** Score de duplicado entre 60-79 (posible duplicado)
**Solución:** Revisar en `/verify/duplicates` y confirmar o rechazar

---

## 📚 Documentación Adicional

- **Especificación completa:** `/docs/import/csv-format-specification.md`
- **Detección de duplicados:** `/docs/features/duplicate-detection.md`
- **Sistema de recuperación:** `/docs/dev/import-recovery-system.md`

---

## 💡 Tips y Mejores Prácticas

1. **Coordenadas GPS Precisas**
   - Usar Google Maps o GPS profesional
   - Mínimo 6 decimales de precisión
   - Validar que corresponden a la ubicación real

2. **Nombres Descriptivos**
   - Incluir tipo de establecimiento si ayuda a identificar
   - Ejemplo: "Polideportivo Norte - Pista 1" mejor que "Poli Norte"

3. **Ubicaciones Específicas**
   - Ser muy específico en edificios grandes
   - Ejemplo: "Botiquín Pista 3" mejor que "Botiquín"

4. **Múltiples DEAs en Mismo Sitio**
   - SIEMPRE especificar diferencias en "Planta" o "Ubicación específica"
   - Usar nombres distintos que indiquen la ubicación

5. **Imágenes**
   - Proporcionar al menos 2 fotos (frontal + ubicación)
   - URLs accesibles públicamente o con autenticación SharePoint
   - Formato: JPG, PNG o WebP

6. **Horarios**
   - Ser preciso con horarios de apertura/cierre
   - Indicar excepciones (festivos, agosto, etc.)
   - Si 24h: usar "00:00" a "23:59"

7. **Información de Contacto**
   - Proporcionar email y teléfono funcional
   - Indicar horario de disponibilidad
   - Actualizar si cambia el responsable

---

## 🎓 Ejemplos de Uso por Tipo

### Hospital / Centro de Salud

```
- Usar: "Hospital", "Centro de salud"
- Planta: Especificar siempre
- Ubicación específica: "Urgencias", "Planta 3", etc.
- Horario: Puede ser 24h o mixto
- Vigilancia 24h: Generalmente "Sí"
```

### Farmacia

```
- Usar: "Farmacia"
- Planta: Generalmente vacío (local en calle)
- Horario: Comercial con cierre domingos
- Cerrado en agosto: Común que "Sí"
```

### Polideportivo / Instalación Deportiva

```
- Usar: "Polideportivo", "Instalación deportiva"
- Múltiples DEAs: MUY IMPORTANTE especificar ubicación
- Ubicación específica: "Pista 1", "Pista 5", "Botiquín"
- Horario: Variable, cierre en agosto común
```

### Centro Comercial

```
- Usar: "Centro comercial"
- Planta: Especificar
- Ubicación específica: "Zona restauración", "Información", etc.
- Horario: Extendido, 7 días semana
- Vigilancia 24h: Generalmente "Sí"
```

### Edificio Administrativo

```
- Usar: "Edificio administrativo"
- Planta: SIEMPRE especificar
- Acceso restringido: Generalmente "Sí"
- Horario: Laboral, cerrado fines de semana
- Cerrado en agosto: Común que "Sí"
```

---

## ⚡ Importación Rápida vs. Importación Completa

### Importación Mínima (Solo Obligatorios)

```
Propuesta de denominación;Nombre de la vía;Número de la vía
Hospital General;Mayor;14
```

⚠️ Funciona pero: Sin detección eficiente de duplicados

### Importación Recomendada

```
Propuesta de denominación;Tipo de establecimiento;Tipo de vía;Nombre de la vía;Número de la vía;Código postal;Coordenadas-Latitud (norte);Coordenadas-Longitud (oeste, por lo tanto, negativa)
Hospital General;Hospital;Calle;Mayor;14;28001;40.416775;-3.703790
```

✅ Detección de duplicados óptima

### Importación Completa

```
Todos los campos relevantes según el tipo de establecimiento
```

✅ Máxima calidad de datos + mejor experiencia de usuario

---

## 📞 Soporte

Para dudas sobre el formato CSV:

- Consultar: `/docs/import/csv-format-specification.md`
- Revisar ejemplos en: `plantilla-importacion-deas-ejemplos.csv`

---

**Última actualización:** Enero 2025  
**Versión:** 1.0
