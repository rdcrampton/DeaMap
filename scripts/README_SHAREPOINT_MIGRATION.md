# Migración de Imágenes SharePoint → S3

Este script migra automáticamente todas las imágenes almacenadas en SharePoint a Amazon S3, actualizando las URLs en la base de datos.

## 🎯 Funcionalidad

- **Identifica** registros DEA con URLs de SharePoint en `foto1` y `foto2`
- **Descarga** imágenes usando cookies de autenticación de tu sesión
- **Sube** imágenes a S3 con nombres únicos y estructura organizada
- **Actualiza** URLs en la base de datos automáticamente
- **Reporta** estadísticas detalladas del proceso

## 📋 Requisitos Previos

### 1. Variables de Entorno

Asegúrate de tener configuradas estas variables en tu `.env.local`:

```env
# AWS S3 (ya configuradas)
AWS_REGION=tu-region
AWS_ACCESS_KEY_ID=tu-access-key
AWS_SECRET_ACCESS_KEY=tu-secret-key
AWS_S3_BUCKET_NAME=tu-bucket

# SharePoint Cookies (nueva - ver instrucciones abajo)
SHAREPOINT_COOKIES="FedAuth=...; rtFa=...; SPOIDCRL=..."
```

### 2. Extraer Cookies de SharePoint

#### Paso a Paso:

1. **Abre tu navegador** y ve a SharePoint donde puedes ver las imágenes
2. **Abre las herramientas de desarrollador** (F12)
3. **Ve a la pestaña Application** (Chrome) o **Storage** (Firefox)
4. **Selecciona Cookies** en el panel izquierdo
5. **Busca el dominio** `madrid-my.sharepoint.com`
6. **Copia las cookies importantes**:
   - `FedAuth` (la más importante)
   - `rtFa` 
   - `SPOIDCRL`
   - Cualquier otra que empiece con `SP` o `Fed`

#### Formato de las Cookies:

```env
SHAREPOINT_COOKIES="FedAuth=77u/PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4...; rtFa=...; SPOIDCRL=..."
```

**⚠️ Importante**: 
- Las cookies expiran (normalmente en 24-48 horas)
- Mantén las cookies seguras (no las subas a git)
- Si el script falla con errores 401/403, actualiza las cookies

## 🚀 Uso del Script

### Opción 1: Modo Prueba (Recomendado primero)

```bash
# Ejecutar sin hacer cambios reales
npx tsx scripts/migrate-sharepoint-to-s3.ts --dry-run
```

### Opción 2: Migración Completa

```bash
# Migrar todas las imágenes de SharePoint
npx tsx scripts/migrate-sharepoint-to-s3.ts
```

### Opción 3: Migración Específica

```bash
# Migrar solo registros específicos por ID
npx tsx scripts/migrate-sharepoint-to-s3.ts --ids 1,2,3,4,5
```

### Opción 4: Configurar Tamaño de Lote

```bash
# Procesar en lotes más pequeños (por defecto: 5)
npx tsx scripts/migrate-sharepoint-to-s3.ts --batch-size 3
```

### Combinando Opciones

```bash
# Prueba con registros específicos
npx tsx scripts/migrate-sharepoint-to-s3.ts --dry-run --ids 1,2,3

# Migración real con lotes pequeños
npx tsx scripts/migrate-sharepoint-to-s3.ts --batch-size 2
```

## 📊 Salida del Script

### Durante la Ejecución:

```
🚀 Iniciando migración de imágenes SharePoint → S3
📋 Modo: MIGRACIÓN REAL
📊 Encontrados 150 registros totales
📊 25 registros tienen imágenes de SharePoint

📦 Procesando lote 1/5
📈 Progreso: 0/25 registros procesados

🔄 Procesando DEA 1001 (ID: 1)
📸 Migrando foto1...
📥 Descargando imagen de SharePoint: https://madrid-my.sharepoint.com/personal/hernandeztal_madrid_es...
✅ Imagen descargada exitosamente (2.1 MB)
📤 Subiendo a S3: original/sharepoint-migration-1-foto1-1702834567890.jpg
✅ Imagen subida exitosamente a S3: https://tu-bucket.s3.region.amazonaws.com/original/...
✅ Foto1 migrada: https://tu-bucket.s3.region.amazonaws.com/original/...
✅ Base de datos actualizada para DEA 1001
```

### Estadísticas Finales:

```
🎉 ¡Migración completada!

📊 ESTADÍSTICAS FINALES:
📋 Total de registros analizados: 150
📋 Registros con SharePoint: 25
📸 Imágenes procesadas: 45
✅ Imágenes migradas exitosamente: 43
❌ Imágenes con errores: 2
💾 Registros actualizados en BD: 24

❌ ERRORES ENCONTRADOS:
1. DEA 1005 foto2: Timeout: La descarga de la imagen tardó más de 30 segundos
2. DEA 1010 foto1: Error HTTP 404: Not Found
```

## 🏗️ Estructura de Archivos en S3

Las imágenes se suben con esta estructura:

```
tu-bucket/
└── original/
    ├── sharepoint-migration-1-foto1-1702834567890.jpg
    ├── sharepoint-migration-1-foto2-1702834567891.png
    ├── sharepoint-migration-2-foto1-1702834567892.jpeg
    └── ...
```

**Formato del nombre**: `sharepoint-migration-{deaId}-{foto1|foto2}-{timestamp}.{extension}`

## ⚙️ Características Técnicas

### Procesamiento en Lotes
- **Tamaño por defecto**: 5 registros por lote
- **Pausa entre lotes**: 2 segundos
- **Pausa entre registros**: 500ms
- **Evita sobrecargar** SharePoint y S3

### Manejo de Errores
- **Timeout**: 30 segundos por imagen
- **Reintentos**: Continúa con la siguiente imagen si una falla
- **Logging detallado**: Registra todos los errores para revisión
- **Transacciones seguras**: Solo actualiza BD si la migración es exitosa

### Validaciones
- **URLs de SharePoint**: Verifica que sean URLs válidas de SharePoint
- **Tipos de archivo**: Acepta JPG, PNG, GIF, WebP, BMP
- **Tamaño de archivo**: Sin límite específico (depende de S3)
- **Variables de entorno**: Verifica que estén configuradas antes de empezar

## 🔧 Troubleshooting

### Error: "SHAREPOINT_COOKIES no está configurado"
```bash
# Solución: Añadir cookies al .env.local
echo 'SHAREPOINT_COOKIES="FedAuth=...; rtFa=..."' >> .env.local
```

### Error: "Error HTTP 401: Unauthorized"
- **Causa**: Cookies expiradas o inválidas
- **Solución**: Extraer nuevas cookies del navegador

### Error: "Error HTTP 404: Not Found"
- **Causa**: La imagen ya no existe en SharePoint
- **Solución**: El script continúa con las siguientes imágenes

### Error: "Timeout: La descarga tardó más de 30 segundos"
- **Causa**: Imagen muy grande o conexión lenta
- **Solución**: El script continúa automáticamente

### Error: "Cannot find module 'tsx'"
```bash
# Instalar tsx globalmente
npm install -g tsx

# O usar npx
npx tsx scripts/migrate-sharepoint-to-s3.ts
```

## 🔒 Seguridad

### Cookies
- **No subir a git**: Añadir `.env.local` al `.gitignore`
- **Renovar regularmente**: Las cookies expiran
- **Acceso limitado**: Solo funcionan con tu cuenta

### S3
- **Permisos mínimos**: Solo necesita `PutObject` y `PutObjectAcl`
- **Objetos públicos**: Las imágenes se hacen públicas para lectura
- **Estructura organizada**: Todas en carpeta `/original/`

## 📈 Optimización

### Para Muchas Imágenes (>100)
```bash
# Usar lotes más pequeños
npx tsx scripts/migrate-sharepoint-to-s3.ts --batch-size 3
```

### Para Imágenes Grandes
- El script maneja automáticamente timeouts
- Las imágenes grandes pueden tardar más
- El progreso se muestra en tiempo real

### Para Conexiones Lentas
- Reduce el `batch-size` a 2 o 3
- El script tiene pausas automáticas entre lotes

## 🔄 Rollback

Si necesitas revertir los cambios:

```sql
-- Ejemplo de rollback manual (ajustar según necesidades)
UPDATE dea_records 
SET foto1 = 'URL_ORIGINAL_SHAREPOINT', 
    foto2 = 'URL_ORIGINAL_SHAREPOINT'
WHERE foto1 LIKE '%sharepoint-migration%' 
   OR foto2 LIKE '%sharepoint-migration%';
```

**Recomendación**: Hacer backup de la BD antes de la migración masiva.

## 📝 Logs y Monitoreo

El script proporciona logging detallado:
- ✅ **Éxitos**: URLs migradas correctamente
- ❌ **Errores**: Problemas específicos con cada imagen
- 📊 **Progreso**: Lotes procesados y tiempo estimado
- 📈 **Estadísticas**: Resumen completo al final

## 🔍 Verificación Post-Migración

Después de completar la migración, usa el script de verificación para comprobar que todas las URLs de S3 funcionan:

### Verificar Imágenes Migradas

```bash
# Verificar solo imágenes migradas de SharePoint
npm run verify-s3

# O usando tsx directamente
npx tsx scripts/verify-s3-migration.ts
```

### Opciones de Verificación

```bash
# Verificar todas las imágenes de S3 (no solo las migradas)
npx tsx scripts/verify-s3-migration.ts --all-s3

# Verificar registros específicos
npx tsx scripts/verify-s3-migration.ts --ids 1,2,3,4,5

# Usar lotes más grandes para verificación rápida
npx tsx scripts/verify-s3-migration.ts --batch-size 20
```

### Salida de Verificación

```
🔍 Iniciando verificación de imágenes migradas a S3
📋 Verificando: Solo imágenes migradas de SharePoint
📊 Encontrados 25 registros totales
📊 25 registros tienen imágenes de S3

🔍 Verificando DEA 1001 (ID: 1)
📸 Verificando foto1: https://tu-bucket.s3.region.amazonaws.com/original/sharepoint-migration...
✅ Foto1 accesible (2.1 MB)
📸 Verificando foto2: https://tu-bucket.s3.region.amazonaws.com/original/sharepoint-migration...
✅ Foto2 accesible (1.8 MB)

🎉 ¡Verificación completada!

📊 ESTADÍSTICAS FINALES:
📋 Total de registros analizados: 25
📋 Registros con S3: 25
📸 Imágenes verificadas: 45
✅ Imágenes funcionando: 45
❌ Imágenes con problemas: 0
📈 Tasa de éxito: 100.0%

🎉 ¡Todas las imágenes están funcionando correctamente!
```

## 🎯 Próximos Pasos

Después de la migración y verificación exitosa:

1. **✅ Verificar** que las nuevas URLs de S3 funcionan (usando el script de verificación)
2. **Actualizar** cualquier caché o CDN si es necesario
3. **Monitorear** el uso de S3 y costos
4. **Considerar** eliminar imágenes de SharePoint (opcional)

## 💡 Tips

- **Ejecuta primero** con `--dry-run` para ver qué se va a migrar
- **Migra en horarios** de poco tráfico para evitar impacto
- **Monitorea** las cookies - renuevalas si expiran
- **Guarda** las estadísticas finales para referencia
- **Verifica** algunas URLs de S3 manualmente después de la migración
