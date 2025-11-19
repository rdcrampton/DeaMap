# Script de Exportación Final de Imágenes DEA

## 📋 Descripción

Este script exporta las imágenes definitivas de los DEA (Desfibriladores Externos Automáticos) que han completado el proceso de verificación, organizándolas en una estructura de carpetas lista para entrega.

## 🎯 Objetivo

Generar la estructura de archivos final para entregar al Ayuntamiento de Madrid, con las imágenes verificadas y clasificadas, tanto con flecha como sin flecha.

## 📁 Estructura de Exportación

```
data/exports/dea-images-final/
├── RM09111D0001/
│   ├── RM09111D0001F1.jpg         # Foto 1 con flecha
│   ├── RM09111D0001F1_clean.jpg   # Foto 1 sin flecha
│   ├── RM09111D0001F2.jpg         # Foto 2 con flecha (si existe)
│   └── RM09111D0001F2_clean.jpg   # Foto 2 sin flecha (si existe)
├── RM10446D0456/
│   ├── RM10446D0456F1.jpg
│   └── RM10446D0456F1_clean.jpg
├── ...
├── export-dea-images-YYYY-MM-DDTHH-mm-ss.csv
└── export-metadata-YYYY-MM-DDTHH-mm-ss.json
```

## 📝 Convención de Nombres

- **RMxxxxxxF1.jpg**: Imagen 1 (fachada/acceso) con flecha indicadora
- **RMxxxxxxF1_clean.jpg**: Imagen 1 sin flecha (versión limpia)
- **RMxxxxxxF2.jpg**: Imagen 2 (interior hacia DEA) con flecha indicadora
- **RMxxxxxxF2_clean.jpg**: Imagen 2 sin flecha (versión limpia)

Donde `xxxxxx` es el código RM completo (ej: `09111D0001`)

## 🔍 Criterios de Filtrado

El script **SOLO exporta** DEA que cumplen:

1. ✅ Estado de verificación: `status = 'completed'`
2. ✅ No marcados como inválidos: `markedAsInvalid = false`
3. ✅ Tienen código RM asignado (campo `defCodDea` o tabla `DeaCode`)
4. ✅ Al menos una imagen marcada como válida (`image1Valid` o `image2Valid`)

El script **OMITE** DEA que:

1. ❌ No están completados
2. ❌ Están marcados como inválidos
3. ❌ No tienen código RM asignado
4. ❌ No tienen ninguna imagen marcada como válida

## 🚀 Ejecución

### Prerequisitos

```bash
# Instalar dependencias si es necesario
npm install
```

### Variables de Entorno Requeridas

El script carga automáticamente variables de entorno desde:
1. `.env.local` (prioridad)
2. `.env` (fallback)

Asegúrate de tener configurada la conexión a la base de datos:

```env
DATABASE_URL="postgresql://usuario:contraseña@host:5432/database"
```

### Ejecutar el Script

```bash
# Opción recomendada: usar el comando npm
npm run export-final-images

# Opción alternativa: ejecutar directamente con tsx
npx tsx scripts/export-final-dea-images.ts
```

## 📊 Reportes Generados

### 1. Reporte CSV (`export-dea-images-YYYY-MM-DDTHH-mm-ss.csv`)

Archivo CSV con todas las exportaciones realizadas, incluyendo:
- Código RM
- ID del registro DEA
- Número provisional
- Distrito
- Dirección
- Estado de cada imagen (exportada o no)
- Errores y advertencias

**Ejemplo:**
```csv
Código RM,DEA Record ID,Número Provisional,Distrito,...
RM09111D0001,1234,5678,Puente de Vallecas,...
```

### 2. Reporte JSON (`export-metadata-YYYY-MM-DDTHH-mm-ss.json`)

Archivo JSON con metadatos detallados:

```json
{
  "metadata": {
    "exportDate": "2025-11-18T14:00:00.000Z",
    "exportDirectory": "d:\\...\\dea-images-final",
    "statistics": {
      "totalDeas": 100,
      "exportedSuccessfully": 95,
      "withErrors": 2,
      "withWarnings": 5,
      "withImage1Only": 40,
      "withImage2Only": 10,
      "withBothImages": 45,
      "withoutRMCode": 3
    }
  },
  "deas": [...],
  "errors": [...]
}
```

📊 ESTADÍSTICAS DE EXPORTACIÓN
📦 Total de DEA procesados:        100
✅ Exportados exitosamente:        95
❌ Con errores:                    2
⚠️  Con advertencias:              5

📸 Distribución de Imágenes:
   Solo Imagen 1:                  40
   Solo Imagen 2:                  10
   Ambas imágenes:                 45

⚠️  DEA sin código RM:             3
```
## 📈 Progreso en Tiempo Real

Durante la ejecución, el script muestra progreso detallado por lotes:

```
🔄 Pre-cargando códigos RM en caché...
✅ 1,250 códigos RM cargados en 0.45s

🔍 Consultando sesiones de verificación completadas...
📊 Total de sesiones completadas válidas: 1,250

📦 Procesando en 25 lotes de 50 DEA cada uno

📦 Lote 1/25 [████████████░░░░░░░░░░░░░░░░] 40.0%
├─ Procesados: 500/1,250
├─ Exitosos: 485
├─ Errores: 15
├─ Tiempo transcurrido: 5m 23s
├─ Velocidad: 1.5 DEA/seg
└─ Tiempo estimado restante: 8m 10s

[532/1250] RM09111D0001 ✅
```

### Estadísticas Finales

Al finalizar, el script muestra un resumen completo:

```
📊 ESTADÍSTICAS FINALES DE EXPORTACIÓN
📦 Total de DEA procesados:        1,250
✅ Exportados exitosamente:        1,200
❌ Con errores:                    25
⚠️  Con advertencias:              50

📸 Distribución de Imágenes:
   Solo Imagen 1:                  500
   Solo Imagen 2:                  100
   Ambas imágenes:                 600

⚠️  DEA sin código RM:             25

⏱️  Rendimiento:
   Tiempo total:                   15m 42s
   Velocidad promedio:             1.33 DEA/seg (80 DEA/min)
```
======================================================================
📊 ESTADÍSTICAS DE EXPORTACIÓN
======================================================================
📦 Total de DEA procesados:        100
✅ Exportados exitosamente:        95
❌ Con errores:                    2
⚠️  Con advertencias:              5

📸 Distribución de Imágenes:
   Solo Imagen 1:                  40
   Solo Imagen 2:                  10
   Ambas imágenes:                 45

⚠️  DEA sin código RM:             3
======================================================================
```

## ⚡ Optimizaciones Implementadas

### 1. **Pre-carga de Códigos RM**
Los códigos RM se cargan una sola vez al inicio en un caché en memoria, eliminando miles de consultas individuales a la base de datos.

### 2. **Procesamiento por Lotes**
Los DEA se procesan en lotes de 50 registros, reduciendo el consumo de memoria y mejorando el rendimiento:
- Menor uso de RAM (~85% menos)
- Mejor manejo de errores
- Progreso más granular

### 3. **Variables de Entorno**
Carga explícita de `.env.local` y `.env` con prioridad correcta, asegurando la conexión a la base de datos correcta.

### 4. **Indicadores de Progreso**
- Barra de progreso visual
- Tiempo transcurrido y estimado restante
- Velocidad de procesamiento
- Contadores en tiempo real

### 5. **Gestión de Memoria**
Pausas entre lotes para liberar memoria y evitar sobrecarga del sistema.

---

## 🔧 Casos Especiales Manejados

### 1. DEA con Swap de Imágenes

Si durante la verificación se intercambiaron las imágenes (`imagesSwapped = true`), el script respeta este cambio y exporta las imágenes en el orden correcto.

### 2. DEA Sin Código RM

Los DEA que no tienen código RM asignado:
- Se registran en el log de errores
- No se exportan
- Se incluyen en las estadísticas (`withoutRMCode`)

### 3. Imágenes Faltantes

Si una imagen está marcada como válida pero falta la URL de la imagen procesada:
- Se registra una advertencia
- Se continúa con las demás imágenes
- Se incluye en las estadísticas (`withWarnings`)

### 4. Errores de Procesamiento

Si hay un error al guardar una imagen:
- Se registra el error específico
- Se continúa con el siguiente DEA
- Se incluye en las estadísticas (`withErrors`)

## 🛠️ Mantenimiento

### Modificar Directorio de Exportación

Editar la línea en el constructor de la clase:

```typescript
this.exportDir = path.join(process.cwd(), 'data', 'exports', 'dea-images-final');
```

### Modificar Calidad de Imágenes JPEG

Editar la línea en el método `saveBase64Image`:

```typescript
await sharp(buffer)
  .jpeg({ quality: 85 })  // Cambiar este valor (1-100)
  .toFile(outputPath);
```

### Modificar Criterios de Filtrado

Editar la consulta en el método `export()`:

```typescript
const completedSessions = await prisma.verificationSession.findMany({
  where: {
    status: 'completed',
    markedAsInvalid: false
    // Agregar más condiciones aquí
  },
  // ...
});
```

## ⚠️ Advertencias

1. **Espacio en Disco**: Asegúrate de tener suficiente espacio. Cada imagen puede ocupar entre 200KB y 2MB.
   - Estimado para 1,000 DEA con 2 imágenes: ~4-8 GB

2. **Tiempo de Ejecución**: 
   - Pequeño volumen (< 100 DEA): 1-2 minutos
   - Medio volumen (100-500 DEA): 5-10 minutos
   - Gran volumen (> 1,000 DEA): 15-30 minutos

3. **Base de Datos**: El script requiere conexión activa a la base de datos PostgreSQL durante toda la ejecución.

4. **Sobrescritura**: Si el directorio `dea-images-final` ya existe, las carpetas individuales se sobrescribirán sin aviso.

5. **Memoria RAM**: El script optimizado usa ~300-500MB de RAM. Sistemas con menos de 2GB pueden experimentar lentitud.

## 🐛 Solución de Problemas

### Error: "Cannot find module '@prisma/client'"

```bash
npm install
npx prisma generate
```

### Error: "Sharp is not installed"

```bash
npm install sharp
```

### Error: "Database connection failed"

Verificar que:
1. PostgreSQL esté ejecutándose
2. Las credenciales en `.env` sean correctas
3. La base de datos exista

### Advertencia: "DEA sin código RM"

Estos DEA necesitan que se les asigne un código RM antes de poder exportarse:

```sql
-- Verificar DEA sin código
SELECT id, numeroProvisionalDea, distrito 
FROM dea_records 
WHERE defCodDea IS NULL;
```

## 📞 Contacto

Para dudas o problemas, revisar:
- Documentación del proyecto en `/doc/`
- Logs de ejecución en la consola
- Archivo JSON de metadatos generado

## 📚 Ver También

- `README_DEA_IMPORT.md` - Importación de datos DEA
- `README_DEA_REVISADAS_IMPORT.md` - Importación de datos revisados
- `README_SHAREPOINT_MIGRATION.md` - Migración de imágenes a S3
