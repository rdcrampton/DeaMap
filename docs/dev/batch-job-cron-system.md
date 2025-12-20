# Sistema de Cron Jobs para Batch Processing

## 📋 Descripción General

Sistema automatizado que procesa jobs en estado `WAITING` mediante Vercel Cron Jobs, eliminando la necesidad de intervención manual o polling desde el frontend.

## 🏗️ Arquitectura

```
Vercel Cron (cada 1 minuto)
    ↓
POST /api/cron/process-waiting-jobs
    ↓
Repository.findWaitingJobs(limit: 5)
    ↓
Para cada job → Orchestrator.continue(jobId)
    ↓
Process Multi-Chunk (hasta 90 segundos)
    - Procesa ~20-25 chunks por invocación
    - ~600-750 registros por minuto
    - Guarda checkpoint después de cada chunk
    ↓
Job → WAITING (si hasMore) o COMPLETED
    ↓
Cron lo retoma en el siguiente minuto
```

## ⚙️ Componentes

### 1. Cron Endpoint

**Archivo**: `src/app/api/cron/process-waiting-jobs/route.ts`

**Funciones**:

- `POST`: Procesa jobs en WAITING
- `GET`: Health check + status de jobs waiting

**Seguridad**:

- Protegido con `CRON_SECRET` de Vercel
- Solo Vercel Cron puede invocar el endpoint

### 2. Repository Method

**Archivo**: `src/batch/infrastructure/repositories/PrismaBatchJobRepository.ts`

```typescript
async findWaitingJobs(limit: number = 10): Promise<BatchJob[]>
```

Busca jobs en estado `WAITING` ordenados por:

1. `last_heartbeat` ASC (prioriza jobs sin actividad reciente)
2. `created_at` ASC (luego por antigüedad)

### 3. Multi-Chunk Processing

**Archivo**: `src/batch/application/orchestrator/BatchJobOrchestrator.ts`

```typescript
private async processChunks(
  job: BatchJob,
  processor: IBatchJobProcessor,
  startIndex: number
): Promise<ChunkExecutionResult>
```

**Características**:

- Loop interno que procesa múltiples chunks
- Timeout con safety buffer de 10 segundos
- Estimación inteligente de tiempo para próximo chunk
- Logging detallado del progreso

## 📊 Rendimiento

### Configuración Actual

```typescript
// Por invocación del cron (60 segundos):
- Timeout efectivo: 50 segundos (10s buffer)
- Chunks por invocación: ~20-25 chunks
- Registros por invocación: ~600-750 registros
- Jobs procesados: hasta 5 jobs en paralelo

// Para 10,676 registros:
- Total invocaciones cron: ~15 invocaciones
- Tiempo estimado: ~15 minutos
- Intervalo cron: 1 minuto
```

### Comparación con Sistema Anterior

| Métrica             | Anterior (Manual) | Nuevo (Cron)    |
| ------------------- | ----------------- | --------------- |
| Invocaciones HTTP   | 356               | ~15             |
| Tiempo total        | Infinito (manual) | ~15 minutos     |
| Intervención manual | Sí (356 clicks)   | No              |
| Resiliente a fallos | No                | Sí (auto-retry) |
| Checkpoints         | Cada chunk        | Cada chunk      |

## 🔧 Configuración

### 1. Variables de Entorno

**Archivo**: `.env` o `.env.local`

```env
# Cron Secret para Vercel (genera uno aleatorio)
CRON_SECRET=your-random-secret-here
```

**Generar secret**:

```bash
openssl rand -base64 32
```

### 2. Vercel Configuration

**Archivo**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/process-waiting-jobs",
      "schedule": "* * * * *"
    }
  ],
  "functions": {
    "src/app/api/cron/process-waiting-jobs/route.ts": {
      "maxDuration": 60
    }
  }
}
```

**Formato del schedule** (cron expression):

```
* * * * *
│ │ │ │ │
│ │ │ │ └─ Día de la semana (0-7, 0 y 7 = Domingo)
│ │ │ └─── Mes (1-12)
│ │ └───── Día del mes (1-31)
│ └─────── Hora (0-23)
└───────── Minuto (0-59)

Ejemplos:
* * * * *      → Cada minuto
*/5 * * * *    → Cada 5 minutos
0 * * * *      → Cada hora
0 0 * * *      → Cada día a medianoche
```

### 3. Vercel Dashboard

1. Ir a **Project Settings** → **Environment Variables**
2. Añadir `CRON_SECRET` con valor generado
3. Aplicar a todos los entornos (Production, Preview, Development)
4. Redesplegar para aplicar cambios

## 🚀 Despliegue

### En Vercel

```bash
# 1. Commit cambios
git add .
git commit -m "feat: add cron job system for batch processing"
git push origin main

# 2. Vercel detectará la configuración de cron automáticamente
# 3. El cron se activará después del despliegue
```

### Verificar Cron Activo

```bash
# Health check
curl https://your-domain.vercel.app/api/cron/process-waiting-jobs

# Respuesta esperada:
{
  "success": true,
  "message": "Cron endpoint is healthy",
  "waitingJobs": 0,
  "jobs": []
}
```

## 📈 Monitoreo

### Logs en Vercel

1. Ir a **Deployments** → seleccionar deployment
2. Click en **Functions** → `/api/cron/process-waiting-jobs`
3. Ver logs en tiempo real

**Logs típicos**:

```
⏰ [Cron] Starting batch job processing...
📋 [Cron] Found 1 waiting jobs
🔄 [Cron] Processing job abc-123 (Sync: DEAs Madrid)
📦 [Orchestrator] Processing chunk #1 at index 60 (75s remaining)
✅ [Orchestrator] Chunk #1 complete: 30 records in 2840ms
🏁 [Orchestrator] Multi-chunk session complete: 20 chunks, 600 records
✅ [Cron] Job abc-123 processed: 660/10676 (6%) in 48500ms
🏁 [Cron] Batch processing complete: 1/1 jobs successful in 48750ms
```

### Métricas en Vercel

- **Invocations**: Número de veces que se ejecutó el cron
- **Duration**: Tiempo promedio de ejecución
- **Errors**: Errores durante la ejecución
- **Success Rate**: Porcentaje de ejecuciones exitosas

## 🐛 Troubleshooting

### El cron no se ejecuta

**Causa**: CRON_SECRET no configurado
**Solución**:

```bash
# 1. Generar secret
openssl rand -base64 32

# 2. Añadir a Vercel Environment Variables
CRON_SECRET=<generated-secret>

# 3. Redesplegar
```

### Jobs no se procesan

**Verificar**:

1. Estado del job en DB: `SELECT * FROM batch_jobs WHERE status = 'WAITING'`
2. Logs del cron en Vercel Dashboard
3. Health check endpoint: `GET /api/cron/process-waiting-jobs`

**Solución común**:

```sql
-- Si un job está stuck, resetear manualmente
UPDATE batch_jobs
SET status = 'WAITING', last_heartbeat = NOW()
WHERE id = 'job-id-here';
```

### Timeout del cron

**Síntoma**: Cron se detiene a los 60 segundos
**Causa**: Límite de Vercel (60s para crons en plan Pro)
**Solución**: El sistema está diseñado para esto, el job volverá a WAITING y el siguiente cron lo retomará

### Muchos jobs en WAITING

**Causa**: Alta carga o jobs lentos
**Solución**:

```json
// Aumentar el límite de jobs procesados por cron
const waitingJobs = await repository.findWaitingJobs(10); // de 5 a 10
```

## 🔒 Seguridad

### Protección del Endpoint

1. **Authorization Header**: Vercel añade automáticamente

   ```
   Authorization: Bearer ${CRON_SECRET}
   ```

2. **Validación en el endpoint**:

   ```typescript
   const authHeader = request.headers.get("authorization");
   if (authHeader !== `Bearer ${CRON_SECRET}`) {
     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
   }
   ```

3. **Rate Limiting**: Vercel limita a 1 ejecución por minuto

### Buenas Prácticas

- ✅ Usar secrets aleatorios de alta entropía
- ✅ Nunca exponer CRON_SECRET en el código
- ✅ Rotar el secret periódicamente
- ✅ Monitorear logs para detectar accesos no autorizados

## 📚 Referencias

- [Vercel Cron Jobs Documentation](https://vercel.com/docs/cron-jobs)
- [Cron Expression Guide](https://crontab.guru/)
- Batch Job System: `docs/dev/batch-job-system.md`

## 🎯 Roadmap Futuro

- [ ] Dashboard para monitoreo de cron jobs
- [ ] Alertas por email/Slack si fallan jobs
- [ ] Métricas de rendimiento en tiempo real
- [ ] Configuración dinámica del schedule
- [ ] Priorización de jobs por importancia
- [ ] Límite de reintentos automáticos

---

**Creado**: 2025-12-20
**Última actualización**: 2025-12-20
**Mantenedor**: Sistema de Batch Processing
