# Sistema de Sincronización por Batches

## Visión General

Sistema de sincronización incremental diseñado para procesar grandes volúmenes de datos (4000+ registros) en Vercel Functions sin exceder timeouts.

## Características

### ⏱️ Limitaciones de Timeout

- **Default**: 30 segundos
- **Sync endpoint**: 100 segundos (configurado en `vercel.json`)
- **Batch size**: 100 registros por invocación

### 🔄 Flujo de Sincronización

```
POST /sync (start)
  ↓
Procesa 100 registros
  ↓
Responde: {hasMore: true, progress: 2.5%}
  ↓
Frontend/Script auto-continúa
  ↓
POST /sync (continueBatchId)
  ↓
Procesa siguientes 100
  ↓
Responde: {hasMore: true, progress: 5%}
  ↓
... (repite ~40 veces para 4000 registros)
  ↓
POST /sync (continueBatchId)
  ↓
Procesa últimos 100
  ↓
Responde: {hasMore: false, progress: 100%}
```

## API

### POST /api/admin/data-sources/[id]/sync

Inicia o continúa una sincronización.

**Request Body:**

```json
{
  "continueBatchId": "optional-batch-id",
  "batchSize": 100,
  "dryRun": false,
  "forceFullSync": false
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "batchId": "xxx",
    "stats": {
      "totalRecords": 100,
      "created": 95,
      "updated": 5,
      "skipped": 0,
      "failed": 0
    },
    "progress": {
      "total": 4000,
      "processed": 100,
      "percentage": 2,
      "hasMore": true,
      "status": "IN_PROGRESS"
    }
  },
  "message": "Batch procesado: 100/4000 registros (2%)"
}
```

### Comportamiento Automático

1. **Primera invocación sin `continueBatchId`**:
   - Verifica si hay batch IN_PROGRESS
   - Si existe, lo continúa automáticamente
   - Si no, crea nuevo batch

2. **Invocación con `continueBatchId`**:
   - Verifica que el batch existe y está IN_PROGRESS
   - Continúa desde el último checkpoint

3. **Límite de registros**:
   - Procesa máximo `batchSize` registros (default: 100)
   - Guarda checkpoint cada 50 registros
   - Responde inmediatamente después de procesar el batch

## Uso desde Frontend

### Opción 1: Polling Manual

```typescript
async function syncDataSource(dataSourceId: string) {
  let hasMore = true;
  let batchId: string | undefined;

  while (hasMore) {
    const response = await fetch(`/api/admin/data-sources/${dataSourceId}/sync`, {
      method: "POST",
      body: JSON.stringify({
        continueBatchId: batchId,
        batchSize: 100,
      }),
    });

    const result = await response.json();
    batchId = result.data.batchId;
    hasMore = result.data.progress.hasMore;

    console.log(`Progress: ${result.data.progress.percentage}%`);

    // Actualizar UI con progreso
    updateProgressBar(result.data.progress.percentage);

    // Pequeña pausa entre invocaciones
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("Sync completed!");
}
```

### Opción 2: Auto-continuación en Background (Recomendado)

El frontend solo inicia la sincronización y hace polling del estado:

```typescript
// Iniciar sync
const initResponse = await fetch(`/api/admin/data-sources/${id}/sync`, {
  method: "POST",
  body: JSON.stringify({ batchSize: 100 }),
});

const { data } = await initResponse.json();
const batchId = data.batchId;

// Polling del estado cada 3 segundos
const interval = setInterval(async () => {
  const status = await fetch(`/api/admin/data-sources/${id}/sync`);
  const { data } = await status.json();

  updateProgressBar(data.progress?.percentage || 0);

  if (data.status !== "IN_PROGRESS") {
    clearInterval(interval);
    console.log("Sync completed!");
  }
}, 3000);
```

## Sistema de Checkpoints

Los checkpoints se guardan automáticamente cada 50 registros procesados:

- **Propósito**: Permitir recuperación ante fallos
- **Frecuencia**: Cada 50 registros
- **Almacenamiento**: Tabla `import_checkpoint`
- **Uso**: Al continuar un batch, se retoma desde el último checkpoint

## Ventajas

✅ **Escalable**: Sin límite de registros
✅ **Resistente a fallos**: Los checkpoints permiten reanudar
✅ **Económico**: Timeout de 100s vs 300s ahorra costes
✅ **Transparente**: El frontend muestra progreso en tiempo real
✅ **Automático**: Continuación automática de batches en progreso

## Configuración

### vercel.json

```json
{
  "functions": {
    "src/app/api/admin/data-sources/[id]/sync/route.ts": {
      "maxDuration": 100
    }
  }
}
```

### Parámetros Ajustables

- `batchSize`: Registros por invocación (default: 100)
- `checkpointFrequency`: Cada cuántos registros guardar checkpoint (default: 50)
- `heartbeatIntervalMs`: Intervalo de heartbeat (default: 10000ms)

## Monitoreo

### Logs

```
📥 Starting sync for data source: xxx
📦 Created import batch: yyy
📊 Total records in source: 4000
📈 Progress: 100 records processed
⏹️ Reached max records limit: 100
✅ Sync completed
```

### Base de Datos

```sql
-- Ver progreso de un batch
SELECT
  id,
  status,
  total_records,
  last_checkpoint_index,
  (last_checkpoint_index + 1) * 100.0 / total_records as progress_pct
FROM import_batch
WHERE data_source_id = 'xxx'
ORDER BY created_at DESC;
```

## Troubleshooting

### Batch atascado en IN_PROGRESS

Si un batch queda en IN_PROGRESS sin completarse:

```typescript
// Forzar nuevo batch
await fetch(`/api/admin/data-sources/${id}/sync`, {
  method: "POST",
  body: JSON.stringify({
    forceFullSync: true, // Ignora checkpoints y crea nuevo batch
  }),
});
```

### Timeout en procesamiento

Si incluso 100 registros causan timeout:

1. Reducir `batchSize` a 50 o menos
2. Verificar que no hay operaciones pesadas en el procesamiento
3. Revisar logs de errores en Vercel

## Mejoras Futuras

- [ ] Webhook para notificar al completar
- [ ] Cron job para auto-continuar batches abandonados
- [ ] Dashboard de monitoreo de sincronizaciones activas
- [ ] Paralelización de múltiples batches (con lock)
