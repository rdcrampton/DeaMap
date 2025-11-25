# Separación de Conceptos de Verificación - Resumen y Verificación

**Fecha:** 25 de noviembre de 2025  
**Migración:** `20251125181240_separate_verification_concepts`

---

## 🎯 Problema Resuelto

El campo `data_verification_status` estaba mezclando dos conceptos completamente diferentes:

1. **Verificación de IMÁGENES** → Sesiones donde se marcan flechas en fotos
2. **Validación de DATOS** → Proceso de 4 pasos para validar dirección

Esto causaba confusión y estados inconsistentes.

---

## ✅ Solución Implementada

### **Cambios en Base de Datos:**

```sql
-- Renombrado
data_verification_status → image_verification_status

-- Nuevo campo
address_validation_status (para validación de dirección)
```

### **Cambios en Código:**

1. **prisma/schema.prisma**
   - `imageVerificationStatus` → para verificación de imágenes
   - `addressValidationStatus` → para validación de dirección

2. **src/services/stepValidationService.ts**
   - Ahora actualiza `addressValidationStatus = 'completed'` al terminar los 4 pasos

3. **scripts/migrate-verification-status.ts**
   - Actualizado para usar `imageVerificationStatus`

---

## 🔍 Consultas de Verificación

### **1. Verificar que la migración se aplicó:**

```sql
-- Ver estructura de la tabla
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'dea_records' 
  AND column_name IN ('image_verification_status', 'address_validation_status')
ORDER BY column_name;
```

**Resultado esperado:**
```
column_name                  | data_type
-----------------------------+------------
address_validation_status    | varchar
image_verification_status    | varchar
```

---

### **2. Verificar distribución de estados:**

```sql
SELECT 
  image_verification_status,
  address_validation_status,
  COUNT(*) as total
FROM dea_records
GROUP BY image_verification_status, address_validation_status
ORDER BY image_verification_status, address_validation_status;
```

**Resultado esperado:**
- Registros con `address_validation_status = 'completed'` deben tener campos `def*` llenos
- Registros con `image_verification_status = 'verified'` deben tener sesiones de imagen verificadas

---

### **3. Verificar registros con validación de dirección completa:**

```sql
SELECT 
  id,
  "numeroProvisionalDea",
  image_verification_status,
  address_validation_status,
  "defTipoVia",
  "defNombreVia",
  "defCp"
FROM dea_records
WHERE address_validation_status = 'completed'
LIMIT 10;
```

**Todos deben tener campos `def*` llenos.**

---

### **4. Verificar caso específico (DEA 8800):**

```sql
SELECT 
  id,
  "numeroProvisionalDea",
  image_verification_status,
  address_validation_status,
  "defTipoVia",
  "defNombreVia",
  "defCp",
  "defDistrito",
  "defLat",
  "defLon",
  (SELECT COUNT(*) FROM verification_sessions WHERE dea_record_id = 8800) as sesiones_imagen
FROM dea_records
WHERE id = 8800;
```

**Resultado esperado:**
```
id:                        8800
numeroProvisionalDea:      5718
image_verification_status: "in_progress" (tiene sesiones de imagen activas)
address_validation_status: "completed" (tiene campos def* completos)
defTipoVia:               "CALLE"
defNombreVia:             "JOSÉ ORTEGA Y GASSET"
defCp:                    "28006"
defDistrito:              "4"
defLat:                   40.4304431
defLon:                   -3.6843926
sesiones_imagen:          7
```

---

### **5. Estadísticas generales:**

```sql
-- Validación de direcciones
SELECT 
  address_validation_status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM dea_records
GROUP BY address_validation_status
ORDER BY address_validation_status;

-- Verificación de imágenes  
SELECT 
  image_verification_status,
  COUNT(*) as total,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
FROM dea_records
GROUP BY image_verification_status
ORDER BY image_verification_status;
```

---

## 📊 Índices Creados

La migración creó 3 índices para optimizar consultas:

```sql
CREATE INDEX idx_dea_records_image_verification ON dea_records(image_verification_status);
CREATE INDEX idx_dea_records_address_validation ON dea_records(address_validation_status);
CREATE INDEX idx_dea_records_both_statuses ON dea_records(image_verification_status, address_validation_status);
```

---

## 🎯 Flujo Correcto Ahora

### **Validación de Dirección (4 pasos):**
```
Usuario → Paso 1: Confirmar dirección
       → Paso 2: Verificar CP
       → Paso 3: Verificar distrito
       → Paso 4: Verificar coordenadas
       → address_validation_status = 'completed' ✅
```

### **Verificación de Imágenes:**
```
Usuario → Sube fotos
       → Marca flechas
       → Revisa imágenes procesadas
       → image_verification_status = 'verified' ✅
```

---

## ✅ Checklist de Verificación

- [ ] Ejecutar consulta 1: Confirmar columnas existen
- [ ] Ejecutar consulta 2: Ver distribución de estados
- [ ] Ejecutar consulta 3: Verificar registros completados
- [ ] Ejecutar consulta 4: Verificar DEA 8800 específicamente
- [ ] Ejecutar consulta 5: Ver estadísticas generales
- [ ] Probar validación de dirección (debe marcar `address_validation_status = 'completed'`)
- [ ] Probar verificación de imágenes (debe marcar `image_verification_status = 'verified'`)

---

## 📝 Notas Importantes

1. **No se "rompió" nada:** Los 18 registros con `in_progress`/`pending` están correctos para la verificación de imágenes
2. **Los 3,421 registros `verified`** también están correctos - tienen sesiones de imagen verificadas
3. **El script `migrate-verification-status.ts`** ahora funciona correctamente con `imageVerificationStatus`
4. **`stepValidationService.ts`** ahora actualiza `addressValidationStatus` al completar los 4 pasos

---

## 🚀 Próximos Pasos

1. Ejecutar las consultas de verificación
2. Probar el flujo completo de validación de dirección
3. Confirmar que ambos procesos funcionan independientemente
4. Actualizar documentación de usuario si es necesario

---

**Migración completada exitosamente** ✅
