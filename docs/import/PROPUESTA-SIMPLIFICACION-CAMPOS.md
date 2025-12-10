# Propuesta de Simplificación de Campos CSV

## 📋 Resumen Ejecutivo

Simplificar la estructura de campos del CSV de importación de **64 campos actuales** a **58 campos** (eliminación de 6 campos redundantes), agrupando campos similares para mejorar la experiencia de usuario y mantenimiento del sistema.

---

## 🎯 Objetivos

1. **Claridad**: Reducir confusión sobre dónde colocar cada tipo de información
2. **Simplicidad**: Menos campos = más fácil de usar
3. **Mantenibilidad**: Estructura más limpia y fácil de mantener
4. **UX**: Mejorar experiencia de importación CSV

---

## 📊 Cambios Propuestos

### 1. ELIMINACIÓN: Campos de Auditoría de Formulario

| Campo Actual           | Acción          | Razón                                                 |
| ---------------------- | --------------- | ----------------------------------------------------- |
| `Hora de inicio`       | ❌ **ELIMINAR** | Solo útil para formularios web, sin valor para el DEA |
| `Hora de finalización` | ❌ **ELIMINAR** | Solo útil para formularios web, sin valor para el DEA |

**Justificación:**

- Estos campos son metadata del proceso de rellenado del formulario
- No aportan información sobre el DEA en sí
- En importaciones CSV manuales no tienen sentido
- Los campos `created_at` y `updated_at` ya existen en el modelo para auditoría

**Alternativa:**

- La auditoría se maneja automáticamente con `created_at`, `updated_at` y `AuditLog`

---

### 2. CLARIFICACIÓN: No Son Duplicados

| Campo                    | Propósito                                                        | Ejemplo                              | Mantener |
| ------------------------ | ---------------------------------------------------------------- | ------------------------------------ | -------- |
| `Número provisional DEA` | Identificador **interno** provisional antes de código definitivo | `1234`                               | ✅ SÍ    |
| `Referencia externa`     | Identificador del **sistema origen** para trazabilidad           | `"REF-API-2025-001"`, `"FORM-12345"` | ✅ SÍ    |

**Justificación:**

- **Número provisional**: Parte del flujo interno (provisional → definitivo)
- **Referencia externa**: Trazabilidad de múltiples fuentes de datos
- Tienen propósitos completamente diferentes
- Ambos son importantes para el sistema

---

### 3. SIMPLIFICACIÓN: Campos de Ubicación/Acceso/Comentarios

#### Estado Actual (7 campos):

| Campo Actual              | Ubicación en BD                     | Uso                          |
| ------------------------- | ----------------------------------- | ---------------------------- |
| `Descripción acceso`      | `AedLocation.access_description`    | Instrucciones de cómo llegar |
| `Referencias visibles`    | `AedLocation.visible_references`    | Puntos de referencia         |
| `Observaciones ubicación` | `AedLocation.location_observations` | Notas sobre ubicación        |
| `Advertencias acceso`     | `AedLocation.access_warnings`       | Restricciones de acceso      |
| `Comentario libre`        | ¿? (uso ambiguo)                    | Comentarios generales        |
| `Observaciones origen`    | `Aed.origin_observations`           | Notas del origen             |
| `Observaciones contacto`  | `AedResponsible.observations`       | Notas del responsable        |

#### Estado Propuesto (4 campos):

| Campo Nuevo               | Ubicación en BD                   | Visibilidad | Uso                                                                      |
| ------------------------- | --------------------------------- | ----------- | ------------------------------------------------------------------------ |
| `Instrucciones de acceso` | `AedLocation.access_instructions` | 🌍 Público  | Instrucciones completas (combina descripción, referencias, advertencias) |
| `Comentarios públicos`    | `AedLocation.public_notes`        | 🌍 Público  | Información adicional pública                                            |
| `Notas internas`          | `Aed.internal_notes`              | 🔒 Privado  | Notas privadas de gestión                                                |
| `Notas de validación`     | `Aed.validation_notes`            | 🔒 Privado  | Notas del proceso de validación                                          |

#### Mapeo de Migración:

```typescript
// Campos que se COMBINAN en "Instrucciones de acceso"
access_instructions = [
  access_description, // "Por entrada principal..."
  visible_references, // "Frente a la fuente"
  access_warnings, // "Requiere tarjeta"
]
  .filter(Boolean)
  .join(". ");

// Campos que se COMBINAN en "Comentarios públicos"
public_notes = [
  location_observations, // "Difícil acceso nocturno"
  comentario_libre, // "Instalado en 2025"
]
  .filter(Boolean)
  .join(". ");

// Campos que SE MANTIENEN separados (privados)
internal_notes = origin_observations || internal_notes;
validation_notes = validation_observations;
```

---

## 📈 Comparativa Detallada

### ❌ Antes (7 campos redundantes)

```
PÚBLICOS (visible en mapa):
1. access_description      → "Por entrada principal, ascensor A"
2. visible_references      → "Frente a recepción"
3. location_observations   → "Difícil acceso nocturno"
4. access_warnings         → "Requiere tarjeta"
5. comentario_libre        → "Instalado en 2025"

PRIVADOS (solo admin):
6. origin_observations     → "Importado desde sistema X"
7. validation_observations → "Verificado in situ"
```

**Problemas:**

- ❌ Usuario no sabe dónde poner cada cosa
- ❌ Campos se solapan conceptualmente
- ❌ Información se fragmenta innecesariamente
- ❌ Difícil de mantener

### ✅ Después (4 campos claros)

```
PÚBLICOS (visible en mapa):
1. access_instructions → Combina 1, 2, 4 (todo sobre cómo llegar)
2. public_notes       → Combina 3, 5 (información adicional pública)

PRIVADOS (solo admin):
3. internal_notes     → Notas privadas de gestión
4. validation_notes   → Notas del proceso de validación
```

**Beneficios:**

- ✅ Claridad: Usuario sabe exactamente dónde poner cada cosa
- ✅ Completo: Se mantiene toda la información
- ✅ Organizado: Separación clara público/privado
- ✅ Mantenible: Estructura simple y lógica

---

## 🗂️ Estructura Final Propuesta

### Campos Obligatorios (3)

- ✅ Propuesta de denominación
- ✅ Nombre de la vía
- ✅ Número de la vía

### Campos Muy Recomendados (6)

- ⭐ Coordenadas GPS (Latitud y Longitud)
- ⭐ Número provisional DEA
- ⭐ Tipo de establecimiento
- ⭐ Código postal
- ⭐ Tipo de vía

### Campos Para Diferenciar DEAs (4)

- 🏢 Planta
- 🏢 Ubicación específica
- 🏢 Instrucciones de acceso (nuevo)
- 🏢 Comentarios públicos (nuevo)

### Total de Campos: 58 (vs 64 actuales)

---

## 💾 Plan de Migración de Datos

### Fase 1: Migración de BD Existente

```sql
-- Migración de campos combinados
UPDATE aed_locations
SET
  access_instructions = CONCAT_WS('. ',
    NULLIF(access_description, ''),
    NULLIF(visible_references, ''),
    NULLIF(access_warnings, '')
  ),
  public_notes = CONCAT_WS('. ',
    NULLIF(location_observations, ''),
    -- comentario_libre se maneja en tabla Aed
  );

UPDATE aeds
SET
  public_notes = CONCAT_WS('. ',
    NULLIF(location.location_observations, ''),
    NULLIF(comentario_libre, '')
  ),
  internal_notes = COALESCE(origin_observations, internal_notes),
  validation_notes = validation_observations;
```

### Fase 2: Actualización de Schema

```prisma
model AedLocation {
  // NUEVOS campos simplificados
  access_instructions  String?  // Combina access_description + visible_references + access_warnings
  public_notes        String?  // Combina location_observations

  // DEPRECADOS (mantener temporalmente para migración)
  access_description   String?  @deprecated
  visible_references   String?  @deprecated
  location_observations String? @deprecated
  access_warnings      String?  @deprecated
}

model Aed {
  // NUEVOS campos simplificados
  public_notes        String?  // Información pública adicional
  internal_notes      String?  // Ya existe, se consolida
  validation_notes    String?  // Renombrado de validation_observations

  // DEPRECADOS
  origin_observations String?  @deprecated // Se integra en internal_notes
  validation_observations String? @deprecated // Renombrado a validation_notes
}
```

### Fase 3: Actualización de Importador

```typescript
// Mapeo en CsvParserAdapter
{
  // Campos eliminados - se ignoran
  'Hora de inicio': null,
  'Hora de finalización': null,

  // Campos consolidados
  'Descripción acceso': 'temp_access_desc',
  'Referencias visibles': 'temp_visible_ref',
  'Advertencias acceso': 'temp_access_warn',

  // Campos nuevos
  'Instrucciones de acceso': 'access_instructions',
  'Comentarios públicos': 'public_notes',
}

// Procesamiento
const accessInstructions = [
  row.temp_access_desc,
  row.temp_visible_ref,
  row.temp_access_warn
].filter(Boolean).join('. ');
```

---

## ✅ Ventajas de la Simplificación

### Para Usuarios

1. **Menos confusión**: Saben exactamente dónde poner cada información
2. **Más rápido**: Menos campos para rellenar
3. **Más claro**: Propósito de cada campo es evidente

### Para Desarrolladores

1. **Menos código**: Menos campos = menos validaciones, menos mappings
2. **Más mantenible**: Estructura más simple
3. **Mejor testing**: Menos casos edge

### Para el Sistema

1. **Base de datos más limpia**: Menos columnas redundantes
2. **Mejor performance**: Menos índices, menos joins
3. **Más escalable**: Estructura más simple = más fácil de extender

---

## ⚠️ Consideraciones

### Retrocompatibilidad

- Los campos antiguos se mantienen temporalmente como `@deprecated`
- Migración automática de datos existentes
- Importador acepta ambos formatos durante transición

### Timeline Propuesto

1. **Fase 1** (1 día): Actualizar documentación y CSV de ejemplo
2. **Fase 2** (1 día): Crear migración de BD y ejecutar
3. **Fase 3** (1 día): Actualizar importador para soportar ambos formatos
4. **Fase 4** (2 semanas): Periodo de transición
5. **Fase 5** (1 día): Eliminar campos deprecados

---

## 📝 Checklist de Implementación

### Documentación

- [x] Actualizar `csv-format-specification.md`
- [ ] Actualizar `README-PLANTILLA.md`
- [ ] Crear plantilla CSV actualizada
- [ ] Documentar proceso de migración

### Base de Datos

- [ ] Crear migración SQL
- [ ] Añadir nuevos campos
- [ ] Migrar datos existentes
- [ ] Marcar campos antiguos como deprecated
- [ ] Testear migración

### Código

- [ ] Actualizar schema de Prisma
- [ ] Actualizar importador CSV
- [ ] Actualizar CsvRow value object
- [ ] Actualizar servicios de dominio
- [ ] Actualizar tests

### Testing

- [ ] Tests unitarios de mapeo
- [ ] Tests de integración de importación
- [ ] Tests de migración de datos
- [ ] Validación manual con datos reales

### Deployment

- [ ] Backup de base de datos
- [ ] Ejecutar migración en staging
- [ ] Validar migración
- [ ] Ejecutar en producción
- [ ] Monitorear errores

---

## 🚀 Conclusión

Esta simplificación reduce la complejidad del sistema en un **~10%** (6 campos menos) mientras mejora significativamente la **claridad** y **usabilidad** del proceso de importación.

**Recomendación:** ✅ Implementar la simplificación

---

**Fecha:** 10 de Diciembre de 2025  
**Autor:** Sistema de Análisis  
**Estado:** ⏳ Pendiente de aprobación
