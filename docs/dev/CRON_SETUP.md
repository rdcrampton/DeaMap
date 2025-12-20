# Configuración del Sistema de Cron Jobs

## ⚡ Setup Rápido

### 1. Generar CRON_SECRET

```bash
# En Windows (Git Bash o WSL):
openssl rand -base64 32

# O en PowerShell:
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes((New-Guid).ToString()))

# Output ejemplo:
# 8X9kL2mN5pQ7rS1tU3vW4xY6zA8bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1z
```

### 2. Añadir a Variables de Entorno Locales

**Archivo**: `.env.local`

```env
# Cron Secret (solo en desarrollo local para testing)
CRON_SECRET=8X9kL2mN5pQ7rS1tU3vW4xY6zA8bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1z
```

⚠️ **Importante**: NO hacer commit de `.env.local` (ya está en `.gitignore`)

### 3. Configurar en Vercel (Production)

#### Opción A: Desde Vercel Dashboard

1. Ir a [Vercel Dashboard](https://vercel.com/dashboard)
2. Seleccionar proyecto → **Settings** → **Environment Variables**
3. Añadir nueva variable:
   - **Name**: `CRON_SECRET`
   - **Value**: (pegar el secret generado)
   - **Environment**: Seleccionar todos (Production, Preview, Development)
4. Click **Save**
5. Redesplegar el proyecto

#### Opción B: Desde CLI

```bash
# Instalar Vercel CLI si no lo tienes
npm i -g vercel

# Login
vercel login

# Añadir variable de entorno
vercel env add CRON_SECRET

# Seguir el prompt:
# - Pegar el valor del secret
# - Seleccionar: Production, Preview, Development
# - Confirmar

# Redesplegar
vercel --prod
```

## 🧪 Testing Local

### 1. Iniciar servidor de desarrollo

```bash
npm run dev
```

### 2. Verificar health check

```bash
# En otra terminal
curl http://localhost:3000/api/cron/process-waiting-jobs

# Respuesta esperada:
{
  "success": true,
  "message": "Cron endpoint is healthy",
  "waitingJobs": 0,
  "jobs": []
}
```

### 3. Simular ejecución del cron (con auth)

```bash
# Windows PowerShell
$headers = @{
    "Authorization" = "Bearer 8X9kL2mN5pQ7rS1tU3vW4xY6zA8bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1z"
    "Content-Type" = "application/json"
}
Invoke-RestMethod -Uri http://localhost:3000/api/cron/process-waiting-jobs -Method POST -Headers $headers

# Git Bash / Linux / macOS
curl -X POST http://localhost:3000/api/cron/process-waiting-jobs \
  -H "Authorization: Bearer 8X9kL2mN5pQ7rS1tU3vW4xY6zA8bC0dE1fG2hI3jK4lM5nO6pQ7rS8tU9vW0xY1z" \
  -H "Content-Type: application/json"
```

### 4. Crear un job de prueba

```bash
# 1. Iniciar una sincronización desde la UI
# Ir a: http://localhost:3000/admin/data-sources/[id]
# Click en "Ejecutar Sincronización"

# 2. El job se quedará en WAITING después del primer chunk

# 3. El cron lo detectará y continuará automáticamente
```

## 🚀 Despliegue en Vercel

### Pre-deployment Checklist

- [ ] `CRON_SECRET` configurado en Vercel Environment Variables
- [ ] `vercel.json` tiene configuración de cron
- [ ] Código compilado sin errores: `npm run build`
- [ ] Tests pasando: `npm test`

### Deploy

```bash
# Commit cambios
git add .
git commit -m "feat: add cron job system for batch processing"

# Push a main
git push origin main

# Vercel desplegará automáticamente
```

### Post-deployment Verification

```bash
# 1. Verificar endpoint de cron
curl https://your-app.vercel.app/api/cron/process-waiting-jobs

# 2. Ver logs en Vercel Dashboard
# Ir a: Deployments → [latest] → Functions → /api/cron/process-waiting-jobs

# 3. Verificar que el cron esté activo
# Ir a: Project Settings → Cron Jobs
# Debe aparecer: /api/cron/process-waiting-jobs - Every 1 minute
```

## 🐛 Troubleshooting

### Error: "Unauthorized"

**Síntoma**:

```json
{ "success": false, "error": "Unauthorized" }
```

**Causas posibles**:

1. `CRON_SECRET` no configurado en `.env.local`
2. Header `Authorization` incorrecto
3. Secret no coincide

**Solución**:

```bash
# 1. Verificar que existe en .env.local
cat .env.local | grep CRON_SECRET

# 2. Verificar header (debe ser exactamente):
Authorization: Bearer <tu-secret-aquí>

# 3. Reiniciar servidor de desarrollo
# Ctrl+C y luego npm run dev
```

### Error: "No waiting jobs found"

**Síntoma**: Cron ejecuta pero no procesa jobs

**Verificación**:

```sql
-- Conectar a base de datos
-- Verificar estado de los jobs
SELECT id, name, status, processed_records, total_records
FROM batch_jobs
WHERE status = 'WAITING'
ORDER BY created_at DESC;
```

**Si no hay jobs en WAITING**:

1. El job puede estar en otro estado (IN_PROGRESS, COMPLETED, etc.)
2. Iniciar una nueva sincronización desde la UI

### Cron no se ejecuta en local

**Nota**: En desarrollo local, el cron **NO se ejecuta automáticamente**.
Solo Vercel ejecuta el cron en producción.

**Para testing local**: Llamar manualmente al endpoint con curl (ver sección Testing Local).

### Cron no se ejecuta en Vercel

**Verificar**:

1. **Cron configurado en vercel.json**

   ```json
   "crons": [{ "path": "/api/cron/process-waiting-jobs", "schedule": "* * * * *" }]
   ```

2. **Plan de Vercel**: Cron jobs requieren plan Pro o superior
   - Free plan: NO soporta cron jobs
   - Pro plan: Sí soporta cron jobs

3. **Variables de entorno**: `CRON_SECRET` debe estar en Vercel

4. **Logs de Vercel**: Revisar errores en Dashboard

## 📊 Monitoreo

### Logs importantes

```typescript
// Inicio del cron
⏰ [Cron] Starting batch job processing...

// Jobs encontrados
📋 [Cron] Found 2 waiting jobs

// Procesando job
🔄 [Cron] Processing job abc-123 (Sync: DEAs Madrid)

// Progreso del orchestrator
📦 [Orchestrator] Processing chunk #1 at index 60 (75s remaining)
✅ [Orchestrator] Chunk #1 complete: 30 records in 2840ms

// Resultado final
🏁 [Cron] Batch processing complete: 2/2 jobs successful in 48750ms
```

### Métricas clave

- **Processed**: Número de jobs procesados
- **Successful**: Jobs completados sin errores
- **Failed**: Jobs con errores
- **Duration**: Tiempo de ejecución (debe ser < 60s)

## 🔐 Seguridad

### Rotar CRON_SECRET

```bash
# 1. Generar nuevo secret
openssl rand -base64 32

# 2. Actualizar en Vercel
vercel env rm CRON_SECRET
vercel env add CRON_SECRET
# (pegar nuevo valor)

# 3. Actualizar en .env.local
# Editar manualmente el archivo

# 4. Redesplegar
vercel --prod

# 5. Reiniciar servidor local
npm run dev
```

### Buenas prácticas

- ✅ Rotar secret cada 3-6 meses
- ✅ No compartir el secret públicamente
- ✅ Usar secrets diferentes para dev/prod
- ✅ Monitorear logs por accesos no autorizados

## 📚 Recursos

- [Documentación Completa](./batch-job-cron-system.md)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [Batch Job System](./batch-job-system.md)

---

**Última actualización**: 2025-12-20
