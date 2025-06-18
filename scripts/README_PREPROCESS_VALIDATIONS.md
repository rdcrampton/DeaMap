# Script de Pre-procesamiento de Validaciones de Direcciones

Este directorio contiene el script unificado para pre-procesar y validar direcciones de registros DEA contra la base de datos oficial de Madrid.

## Script Disponible

### `preprocess-address-validations.ts`
Script unificado y configurable para procesamiento de validaciones de direcciones.

**Uso básico (100 registros por defecto):**
```bash
npx tsx scripts/preprocess-address-validations.ts
```

**Uso avanzado:**
```bash
# Procesar todos los registros pendientes
npx tsx scripts/preprocess-address-validations.ts --no-limit

# Procesar solo 500 registros
npx tsx scripts/preprocess-address-validations.ts --limit=500

# Usar lotes de 10 registros en lugar de 5
npx tsx scripts/preprocess-address-validations.ts --batch-size=10

# Combinar opciones
npx tsx scripts/preprocess-address-validations.ts --limit=1000 --batch-size=8
```

**Parámetros disponibles:**
- `--limit=N`: Limita el número de registros a procesar (por defecto: 100)
- `--no-limit`: Procesa todos los registros pendientes sin límite
- `--batch-size=N`: Tamaño del lote de procesamiento paralelo (por defecto: 5)

## Funcionamiento

### Lógica de Selección de Registros

El script procesa únicamente registros que:

1. **No tienen validación previa**: Registros DEA sin entrada en `dea_address_validations`
2. **Necesitan reprocesamiento**: Registros marcados con `needsReprocessing = true`
3. **Tienen errores recuperables**: Registros con errores pero menos de 3 reintentos

### Proceso de Validación

Para cada registro DEA:

1. **Extracción de datos**: Se obtienen tipo de vía, nombre, número, código postal, distrito y coordenadas
2. **Validación con Madrid**: Se consulta la base de datos oficial de direcciones de Madrid
3. **Análisis de resultados**: Se evalúa la coincidencia y se asigna un estado
4. **Almacenamiento**: Se guardan los resultados en `dea_address_validations`

### Estados de Validación

- `valid`: Dirección encontrada y validada correctamente
- `needs_review`: Dirección encontrada pero requiere revisión manual
- `invalid`: Dirección no encontrada o con errores graves

## Estadísticas y Monitoreo

El script proporciona información detallada:

### Durante la Ejecución
- Configuración inicial (límite, tamaño de lote, reintentos)
- Análisis de registros pendientes
- Progreso por lotes
- Tiempo de procesamiento por registro
- Errores en tiempo real

### Resumen Final
- Total de registros procesados exitosamente
- Número de errores
- Tiempo total y promedio por registro
- Velocidad de procesamiento (registros/minuto) - solo para lotes grandes
- Distribución por estados de validación
- Progreso total del sistema

## Ejemplos de Salida

### Ejecución por defecto (100 registros):
```
🌙 === INICIO PRE-PROCESAMIENTO DE VALIDACIONES ===
⏰ Timestamp: 2025-06-12T08:27:04.307Z
⚙️  Configuración:
   Límite: 100 registros
   Tamaño de lote: 5
   Máximo reintentos: 3

🔍 Analizando registros pendientes...
📊 Estado actual:
   Total registros DEA: 1535
   Ya procesados: 300
   Necesitan reprocesamiento: 0
   Sin procesar: 1235
📦 Encontrados 100 registros para procesar en este lote

📦 Procesando lote 1/20 (5 registros)
✅ DEA 1151: 21290ms
✅ DEA 1157: 42482ms
...

📊 === RESUMEN FINAL ===
✅ Exitosos: 100
❌ Fallidos: 0
⏱️  Tiempo total: 148903ms (148.9s)
📈 Promedio por registro: 1489ms
🚀 Velocidad: 40.1 registros/min

📈 Estadísticas de validaciones:
  needs_review: 35 registros
  valid: 65 registros

🎯 Progreso total del sistema: 26.1% (400/1535 registros)
```

### Ejecución sin límites:
```
🌙 === INICIO PRE-PROCESAMIENTO DE VALIDACIONES ===
⚙️  Configuración:
   Límite: Sin límite
   Tamaño de lote: 5
   Máximo reintentos: 3

📦 Encontrados 1235 registros para procesar

📦 Procesando lote 1/247 (5 registros)
📈 Progreso: 0.4% (1/247 lotes)
...
📈 Progreso: 100.0% (247/247 lotes)

🎯 Progreso total del sistema: 100.0% (1535/1535 registros)
```

## Consideraciones de Rendimiento

### Tiempos de Procesamiento
- **Primer registro de cada lote**: ~20-40 segundos (inicialización de conexiones)
- **Registros subsiguientes**: ~60-300ms por registro
- **Promedio general**: ~1.5 segundos por registro

### Optimizaciones
- Procesamiento en paralelo por lotes
- Reutilización de conexiones de base de datos
- Pausas entre lotes para evitar saturación
- Manejo eficiente de errores y reintentos
- Logging adaptativo según el tamaño del procesamiento

## Casos de Uso Comunes

### Procesamiento Incremental (Recomendado)
```bash
# Procesar 100 registros cada vez
npx tsx scripts/preprocess-address-validations.ts
```
Ideal para:
- Ejecuciones regulares
- Pruebas y validación
- Evitar saturar el sistema

### Procesamiento Masivo
```bash
# Procesar todos los registros pendientes
npx tsx scripts/preprocess-address-validations.ts --no-limit
```
Ideal para:
- Procesamiento inicial completo
- Recuperación después de errores masivos
- Migración de datos

### Procesamiento Personalizado
```bash
# Lotes más grandes para mayor velocidad
npx tsx scripts/preprocess-address-validations.ts --no-limit --batch-size=10

# Cantidad específica para pruebas
npx tsx scripts/preprocess-address-validations.ts --limit=50 --batch-size=3
```

## Solución de Problemas

### Error: "No se reconoce tsx"
```bash
# Instalar tsx globalmente
npm install -g tsx

# O usar npx
npx tsx scripts/preprocess-address-validations.ts
```

### Error: "Database connection failed"
- Verificar que la base de datos esté ejecutándose
- Comprobar las variables de entorno en `.env`
- Asegurar que Prisma esté configurado correctamente

### Registros que no se procesan
- Verificar que no tengan ya una validación exitosa
- Comprobar si están marcados como `needsReprocessing = false`
- Revisar si han superado el límite de reintentos

### Script se detiene inesperadamente
- Verificar conexión a internet (necesaria para validación con Madrid)
- Comprobar memoria disponible para lotes grandes
- Revisar logs de errores en la consola

## Mantenimiento

### Reprocesar Registros con Errores
Para marcar registros fallidos para reprocesamiento:

```sql
UPDATE dea_address_validations 
SET needs_reprocessing = true, 
    retry_count = 0 
WHERE error_message IS NOT NULL;
```

### Limpiar Validaciones
Para eliminar todas las validaciones y empezar de nuevo:

```sql
DELETE FROM dea_address_validations;
```

### Verificar Estado del Sistema
Para ver el estado actual del sistema:

```sql
SELECT 
  overall_status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM dea_address_validations 
GROUP BY overall_status
ORDER BY count DESC;
```

### Verificar Registros Pendientes
Para ver cuántos registros faltan por procesar:

```sql
SELECT 
  (SELECT COUNT(*) FROM dea_records) as total_records,
  (SELECT COUNT(*) FROM dea_address_validations WHERE needs_reprocessing = false) as processed,
  (SELECT COUNT(*) FROM dea_address_validations WHERE needs_reprocessing = true) as needs_reprocessing,
  (SELECT COUNT(*) FROM dea_records) - 
  (SELECT COUNT(*) FROM dea_address_validations) as pending;
```

## Automatización

### Cron Job para Procesamiento Regular
Para automatizar el procesamiento cada hora:

```bash
# Editar crontab
crontab -e

# Añadir línea (ajustar rutas según tu sistema)
0 * * * * cd /ruta/a/tu/proyecto && npx tsx scripts/preprocess-address-validations.ts >> /var/log/dea-validation.log 2>&1
```

### Script de Monitoreo
Para crear un script que monitoree el progreso:

```bash
#!/bin/bash
# monitor-validation.sh

echo "Estado de validaciones DEA - $(date)"
echo "=================================="

# Conectar a la base de datos y mostrar estadísticas
psql $DATABASE_URL -c "
SELECT 
  'Total registros' as tipo, COUNT(*) as cantidad 
FROM dea_records
UNION ALL
SELECT 
  'Procesados', COUNT(*) 
FROM dea_address_validations WHERE needs_reprocessing = false
UNION ALL
SELECT 
  'Pendientes', COUNT(*) 
FROM dea_records WHERE id NOT IN (SELECT dea_record_id FROM dea_address_validations)
ORDER BY tipo;
"
