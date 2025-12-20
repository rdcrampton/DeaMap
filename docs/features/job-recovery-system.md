# Sistema de Recuperación de Jobs Bloqueados

## 📋 Resumen

Sistema completo para detectar, recuperar y gestionar batch jobs bloqueados o atascados, siguiendo principios SOLID y DDD.

## 🎯 Problema Resuelto

Los jobs de sincronización pueden quedarse atascados en estado `IN_PROGRESS` sin heartbeat, bloqueando nuevas sincronizaciones. Este sistema proporciona:

1. **Detección automática** de jobs atascados
2. **Recuperación automática** mediante casos de uso
3. **Recuperación manual** mediante API y UI
4. **Monitoreo de salud** del sistema de jobs

## 🏗️ Arquitectura (DDD + SOLID)

### Capa de Dominio

**Entidad: `BatchJob`**

- `isStuck`: Propiedad computada que detecta si un job está atascado
- `timeSinceLastHeartbeat`: Tiempo desde el último heartbeat
- `forceReset(reason)`: Método para forzar reset (admin action)
- `recoverFromStuck()`: Método para recuperación automática

### Capa de Aplicación

**Casos de Uso:**

1. **`RecoverStuckJobsUseCase`**
   - Responsabilidad: Detectar y recuperar jobs atascados automáticamente
   - Input: `stuckThresholdMs`, `maxJobsToRecover`, `dryRun`
   - Output: Lista de jobs recuperados
   - Principio SOLID: SRP, DIP

2. **`ForceResetJobUseCase`**
   - Responsabilidad: Forzar reset de un job específico (acción de admin)
   - Input: `jobId`, `reason`, `performedBy`
   - Output: Job reseteado
   - Principio SOLID: SRP, DIP

3. **`GetJobsHealthUseCase`**
   - Responsabilidad: Obtener métricas de salud del sistema
   - Output: Métricas, issues, recomendaciones
   - Principio SOLID: SRP, DIP, OCP

### Capa de Infraestructura

**Endpoints API:**

- `POST /api/admin/jobs/recover` - Recuperación automática
- `POST /api/admin/jobs/[jobId]/force-reset` - Reset forzado
- `GET /api/admin/jobs/health` - Health check

## 🚀 Uso

### 1. Script de Recuperación Inmediata

```bash
# Recuperar un job específico
npx tsx scripts/fix-stuck-job.ts [jobId]

# Recuperar todos los jobs atascados automáticamente
npx tsx scripts/fix-stuck-job.ts
```

### 2. API Endpoints

#### Recuperar Jobs Automáticamente

```bash
POST /api/admin/jobs/recover
Content-Type: application/json

{
  "maxJobsToRecover": 10,
  "dryRun": false
}
```

#### Forzar Reset de un Job

```bash
POST /api/admin/jobs/[jobId]/force-reset
Content-Type: application/json

{
  "reason": "Job stuck without heartbeat for 30 minutes"
}
```

#### Health Check

```bash
GET /api/admin/jobs/health
```

## 📊 Criterios de Detección

Un job se considera **atascado** cuando:

1. Estado: `IN_PROGRESS` o `RESUMING`
2. Sin heartbeat por más de `5x heartbeatIntervalMs` (por defecto: 2.5 minutos)
3. O sin heartbeat después de 3 minutos desde el inicio

## 🔄 Flujo de Recuperación

```
Job Atascado (IN_PROGRESS)
        ↓
Detectar (isStuck = true)
        ↓
Recuperar (recoverFromStuck())
        ↓
Estado → INTERRUPTED
        ↓
Puede reanudarse con /continue
```

## 🎨 UI Futura (TODO)

En `/admin/data-sources/[id]`:

- [ ] Badge de estado del job actual
- [ ] Indicador de heartbeat en tiempo real
- [ ] Botón "Forzar Reset" (si está atascado)
- [ ] Botón "Recuperar Automáticamente"
- [ ] Panel de métricas de salud
- [ ] Historial de sincronizaciones

## ✅ Beneficios

1. **No Breaking Changes**: Compatible con código existente
2. **SOLID**: Cada clase tiene una responsabilidad única
3. **DDD**: Lógica en el dominio, orquestación en aplicación
4. **Testeable**: Fácil crear mocks y tests unitarios
5. **Observable**: Logs y métricas para debugging
6. **Resiliente**: Auto-recuperación + manual

## 📝 Ejemplos de Uso

### Ejemplo 1: Recuperación Automática con Script

```bash
$ npx tsx scripts/fix-stuck-job.ts

🔍 Buscando jobs atascados automáticamente...
────────────────────────────────────────────────────────────
⚠️  Se encontraron 1 job(s) atascado(s):

   1. Job ID: f10e1e4a-7779-4c86-a86b-8d8a5df50fce
      Nombre: Sync: SAMUR Madrid
      Estado: IN_PROGRESS
      Sin heartbeat por: 1847 segundos

🔧 Procediendo con la recuperación automática...
────────────────────────────────────────────────────────────
✅ 1 job(s) recuperado(s) exitosamente

   1. Sync: SAMUR Madrid
      Job ID: f10e1e4a-7779-4c86-a86b-8d8a5df50fce
      Estado anterior: IN_PROGRESS
      Recuperado en: 19/12/2025, 14:37:05
```

### Ejemplo 2: Forzar Reset desde API

```typescript
const response = await fetch('/api/admin/jobs/f10e1e4a.../force-reset', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reason: 'Job stuck for 30+ minutes without progress'
  })
});

// Response:
{
  "success": true,
  "data": {
    "jobId": "f10e1e4a...",
    "name": "Sync: SAMUR Madrid",
    "previousStatus": "IN_PROGRESS",
    "newStatus": "INTERRUPTED",
    "canResume": true
  },
  "message": "Job successfully reset from IN_PROGRESS to INTERRUPTED. It can now be resumed."
}
```

## 🔐 Seguridad

- Todos los endpoints requieren rol `ADMIN`
- Audit trail: quién ejecutó el reset y cuándo
- Metadata preservada para debugging

## 🧪 Testing

```typescript
// Test: Detectar job atascado
test("should detect stuck job", () => {
  const job = createJobWithOldHeartbeat();
  expect(job.isStuck).toBe(true);
});

// Test: Recuperar job atascado
test("should recover stuck job", async () => {
  const useCase = new RecoverStuckJobsUseCase(mockRepository);
  const result = await useCase.execute();
  expect(result.recoveredJobs.length).toBe(1);
});

// Test: Force reset
test("should force reset job", async () => {
  const useCase = new ForceResetJobUseCase(mockRepository);
  const result = await useCase.execute({
    jobId: "test-id",
    reason: "Test",
    performedBy: "admin",
  });
  expect(result.success).toBe(true);
  expect(result.job.status).toBe("INTERRUPTED");
});
```

## 📚 Referencias

- Entidad: `src/batch/domain/entities/BatchJob.ts`
- Casos de Uso: `src/batch/application/use-cases/`
- Endpoints: `src/app/api/admin/jobs/`
- Script: `scripts/fix-stuck-job.ts`
