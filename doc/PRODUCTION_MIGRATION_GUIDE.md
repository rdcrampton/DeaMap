# Guía de Migración a Producción - DEA Analizer

**Fecha de creación:** 25 de noviembre de 2025  
**Estado:** Probado en local exitosamente

---

## 📋 Resumen Ejecutivo

Este documento describe el proceso completo para aplicar las migraciones de base de datos y scripts de migración de datos en el servidor de producción.

---

## ✅ Migraciones Aplicadas

### 1. Migraciones de Schema (Prisma)

| Migración | Estado | Descripción |
|-----------|--------|-------------|
| `20250108172000_change_verification_ids_to_cuid` | ✅ Aplicada | Cambia IDs a CUID |
| `20250906113832_init_with_verification_status` | ✅ Aplicada | Estructura base de tablas |
| `20251008203220_add_image_selection_fields` | ✅ Aplicada | Campos de selección de imágenes |
| `20251030191040_add_performance_indexes` | ✅ Aplicada | Índices de performance (8 índices) |

### 2. Scripts de Migración de Datos

| Script | Estado | Descripción |
|--------|--------|-------------|
| `migrate-verification-status.ts` | ✅ Aplicado | Actualiza estados de verificación |

---

## 🎯 Proceso para Producción

### Paso 1: Backup de la Base de Datos

```bash
# Crear backup completo de producción
pg_dump -h <host_prod> -U <user> -d dea_madrid -F c -b -v -f backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump
```

### Paso 2: Verificar Estado Actual

```bash
# Conectarse al servidor de producción
ssh <servidor_produccion>

# Verificar migraciones
npm run migrate:status
```

### Paso 3: Marcar Migraciones Aplicadas (Si las Tablas Ya Existen)

Si la BD de producción ya tiene las tablas pero Prisma no tiene registro:

```bash
npx prisma migrate resolve --applied 20250108172000_change_verification_ids_to_cuid
npx prisma migrate resolve --applied 20250906113832_init_with_verification_status
npx prisma migrate resolve --applied 20251008203220_add_image_selection_fields
```

### Paso 4: Aplicar Índices de Performance

**Opción A: Con psql (RECOMENDADO - usa CONCURRENTLY)**

```bash
# Aplicar índices sin bloquear tablas
psql -h <host> -U <user> -d dea_madrid -f prisma/migrations/20251030191040_add_performance_indexes/migration.sql

# Marcar migración como aplicada
npx prisma migrate resolve --applied 20251030191040_add_performance_indexes
```

**Opción B: Con Prisma (solo si el archivo NO usa CONCURRENTLY)**

```bash
npm run migrate:deploy
```

### Paso 5: Verificar Migraciones

```bash
# Debe mostrar: "Database schema is up to date!"
npm run migrate:status
```

### Paso 6: Migración de Estados

```bash
# Vista previa (siempre ejecutar primero)
npx tsx scripts/migrate-verification-status.ts --dry-run --verbose

# Si todo se ve bien, aplicar
npx tsx scripts/migrate-verification-status.ts --verbose
```

### Paso 7: Verificación Post-Migración

```bash
# Verificar estados
psql -h <host> -U <user> -d dea_madrid << 'EOF'
SELECT 
    status, 
    COUNT(*) 
FROM verification_sessions 
GROUP BY status;

SELECT 
    data_verification_status, 
    COUNT(*) 
FROM dea_records 
GROUP BY data_verification_status;
EOF
```

---

## 📊 Resultados Esperados

### Estados en verification_sessions

- `pending`: ~123
- `in_progress`: ~28
- `verified`: ~3,472
- `discarded`: ~1

### Estados en dea_records

- `pending`: ~1
- `in_progress`: ~17
- `verified`: ~3,421
- `discarded`: ~0

---

## 🔧 Índices de Performance Creados

### Verification Sessions (4 índices)
- `idx_verification_sessions_status`
- `idx_verification_sessions_dea_status`
- `idx_verification_sessions_status_dea_id`
- `idx_verification_sessions_completed`

### DEA Records (1 índice)
- `idx_dea_records_foto1_not_null`

### DEA Address Validations (3 índices)
- `idx_dea_validations_status_filter`
- `idx_dea_address_validations_status_dea_id`
- `idx_dea_address_validations_dea_record_id_status`

---

## ⚠️ Consideraciones Importantes

### Antes de Ejecutar en Producción

1. ✅ **Backup completo** de la BD
2. ✅ **Horario de bajo tráfico** recomendado
3. ✅ **Ejecutar dry-run** del script de estados primero
4. ✅ **Verificar que DATABASE_URL** apunta a producción

### Durante la Ejecución

- Los índices CONCURRENTLY no bloquean tablas
- El script de estados tarda ~2-3 minutos (3,439 DEAs)
- Monitorear logs para detectar errores

### Después de la Ejecución

- Verificar conteos de estados
- Probar la aplicación
- Monitorear performance de queries

---

## 🚨 Rollback (En Caso de Problema)

Si algo sale mal:

```bash
# 1. Restaurar backup
pg_restore -h <host> -U <user> -d dea_madrid -v backup_pre_migration_YYYYMMDD_HHMMSS.dump

# 2. Verificar integridad
npm run migrate:status

# 3. Regenerar cliente Prisma
npm run db:generate
```

---

## 📝 Cambios Aplicados

### Migración de Estados

- **completed → verified**: Estados de sesiones completadas
- **cancelled → pending**: Estados de sesiones canceladas
- **Sincronización**: Estado de cada DEA refleja su mejor sesión de verificación
- **Prioridad**: verified > in_progress > pending > discarded

---

## 🎯 Verificación de Éxito

### Checklist Final

- [ ] Todas las migraciones marcadas como aplicadas
- [ ] 8 índices de performance creados
- [ ] Estados actualizados correctamente
- [ ] Aplicación funciona correctamente
- [ ] No hay errores en logs
- [ ] Performance de queries mejorada

---

## 📞 Contacto

Si encuentras problemas durante la migración:
1. Revisar logs de este proceso
2. Verificar backup está disponible
3. Contactar con el equipo de desarrollo

---

**Última actualización:** 25 de noviembre de 2025  
**Versión:** 1.0  
**Probado en:** Local (exitoso)  
**Estado:** Listo para aplicar en producción
