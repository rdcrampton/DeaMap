-- Separar conceptos de verificación: Imágenes vs Dirección
-- ============================================================
-- 
-- PROBLEMA RESUELTO:
-- El campo data_verification_status estaba mezclando dos conceptos diferentes:
-- 1. Verificación de IMÁGENES (sesiones de verificación)
-- 2. Validación de DATOS de dirección (proceso de 4 pasos)
--
-- SOLUCIÓN:
-- - Renombrar data_verification_status → image_verification_status
-- - Crear nuevo campo address_validation_status para validación de datos
-- ============================================================

-- 1. Renombrar columna existente para reflejar su uso real
ALTER TABLE dea_records 
  RENAME COLUMN data_verification_status TO image_verification_status;

-- 2. Crear nueva columna para validación de dirección
ALTER TABLE dea_records 
  ADD COLUMN address_validation_status VARCHAR(20) DEFAULT 'pending' NOT NULL;

-- 3. Poblar address_validation_status basándose en campos def* completos
UPDATE dea_records 
SET address_validation_status = 'completed'
WHERE 
  "defTipoVia" IS NOT NULL 
  AND "defNombreVia" IS NOT NULL 
  AND "defCp" IS NOT NULL 
  AND "defDistrito" IS NOT NULL 
  AND "defLat" IS NOT NULL 
  AND "defLon" IS NOT NULL;

-- 4. Actualizar timestamp para registros modificados
UPDATE dea_records 
SET "updatedAt" = NOW()
WHERE address_validation_status = 'completed';

-- 5. Crear índices para optimizar consultas
CREATE INDEX idx_dea_records_image_verification ON dea_records(image_verification_status);
CREATE INDEX idx_dea_records_address_validation ON dea_records(address_validation_status);
CREATE INDEX idx_dea_records_both_statuses ON dea_records(image_verification_status, address_validation_status);
