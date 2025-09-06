# Importador de Registros DEA Revisados

Este directorio contiene los scripts para importar registros DEA desde el archivo `data/CSV/dea_revisadas.csv` a la tabla `dea_records` de la base de datos.

## Archivos

- `import-dea-revisadas.ts` - Clase principal del importador
- `run-dea-revisadas-import.ts` - Script ejecutor con interfaz de usuario
- `README_DEA_REVISADAS_IMPORT.md` - Esta documentación

## Características del Importador

### ✅ Funcionalidades

- **Lectura selectiva de columnas**: Solo importa las columnas que existen en la tabla `dea_records`
- **Exclusión automática**: Omite las columnas `overall_status` y `recommended_actions` que no están en el schema
- **Manejo de encoding**: Soporte automático para UTF-8 y latin1
- **Procesamiento por lotes**: Importa en lotes de 100 registros para optimizar rendimiento
- **Validación robusta**: Verifica coordenadas, códigos postales y campos obligatorios
- **Manejo de errores**: Continúa procesando aunque algunos registros fallen
- **Logging detallado**: Proporciona información completa del proceso
- **Estadísticas completas**: Muestra resumen de la importación

### 📊 Validaciones Implementadas

1. **Coordenadas geográficas**: Verifica que estén dentro del rango de Madrid
   - Latitud: 40.0 - 41.0
   - Longitud: -4.0 - -3.0

2. **Códigos postales**: Valida que sean de Madrid (28xxx)

3. **Fechas**: Verifica que la fecha de inicio sea anterior a la de finalización

4. **Campos obligatorios**: Asegura que existan tipo de establecimiento y nombre de vía

### 🗂️ Mapeo de Columnas

El importador mapea todas las columnas del CSV que existen en la tabla `dea_records`:

#### Campos Básicos
- `Id` → (usado para logging, no se importa como campo)
- `horaInicio` → `horaInicio`
- `horaFinalizacion` → `horaFinalizacion`
- `correoElectronico` → `correoElectronico`
- `nombre` → `nombre`
- `numeroProvisionalDea` → `numeroProvisionalDea`

#### Campos de Establecimiento
- `tipoEstablecimiento` → `tipoEstablecimiento`
- `titularidadLocal` → `titularidadLocal`
- `usoLocal` → `usoLocal`
- `titularidad` → `titularidad`
- `propuestaDenominacion` → `propuestaDenominacion`

#### Campos de Dirección
- `tipoVia` → `tipoVia`
- `nombreVia` → `nombreVia`
- `numeroVia` → `numeroVia`
- `complementoDireccion` → `complementoDireccion`
- `codigoPostal` → `codigoPostal`
- `distrito` → `distrito`
- `latitud` → `latitud`
- `longitud` → `longitud`

#### Campos de Horarios
- `horarioApertura` → `horarioApertura`
- `aperturaLunesViernes` → `aperturaLunesViernes`
- `cierreLunesViernes` → `cierreLunesViernes`
- `aperturaSabados` → `aperturaSabados`
- `cierreSabados` → `cierreSabados`
- `aperturaDomingos` → `aperturaDomingos`
- `cierreDomingos` → `cierreDomingos`
- `vigilante24h` → `vigilante24h`

#### Campos Opcionales
- `foto1` → `foto1`
- `foto2` → `foto2`
- `descripcionAcceso` → `descripcionAcceso`
- `comentarioLibre` → `comentarioLibre`

#### Campos de Google Maps
- `gmTipoVia` → `gmTipoVia`
- `gmNombreVia` → `gmNombreVia`
- `gmNumero` → `gmNumero`
- `gmCp` → `gmCp`
- `gmDistrito` → `gmDistrito`
- `gmBarrio` → `gmBarrio`
- `gmLat` → `gmLat`
- `gmLon` → `gmLon`

#### Campos Definitivos
- `defTipoVia` → `defTipoVia`
- `defNombreVia` → `defNombreVia`
- `defNumero` → `defNumero`
- `defCp` → `defCp`
- `defDistrito` → `defDistrito`
- `defBarrio` → `defBarrio`
- `defLat` → `defLat`
- `defLon` → `defLon`
- `defCodDea` → `defCodDea`

#### ❌ Columnas Excluidas
- `overall_status` - No existe en la tabla
- `recommended_actions` - No existe en la tabla

## Uso

### Opción 1: Script NPM (Recomendado)

```bash
npm run import-deas-revisadas
```

### Opción 2: Script Ejecutor Directo

```bash
npx tsx scripts/run-dea-revisadas-import.ts
```

Este script:
- Muestra información detallada sobre la importación
- Solicita confirmación antes de proceder
- Proporciona mensajes de ayuda en caso de error

### Opción 3: Importación Directa

```bash
npx tsx scripts/import-dea-revisadas.ts
```

### Opción 4: Desde Código

```typescript
import { DeaRevisadasImporter } from './scripts/import-dea-revisadas';

const importer = new DeaRevisadasImporter();
await importer.importDeas();
```

## Requisitos Previos

1. **Base de datos configurada**: Asegurar que la conexión a PostgreSQL esté funcionando
2. **Archivo CSV presente**: El archivo `data/CSV/dea_revisadas.csv` debe existir
3. **Dependencias instaladas**: Ejecutar `npm install` si es necesario

## Formato del CSV

El importador espera un CSV con:
- **Separador**: Punto y coma (`;`)
- **Encoding**: UTF-8 o latin1 (detección automática)
- **Primera línea**: Headers con los nombres de las columnas
- **Formato de fechas**: `DD/MM/YYYY HH:mm`
- **Decimales**: Punto o coma como separador decimal

## Estadísticas de Importación

Al finalizar, el importador muestra:

- **Total de registros** importados
- **Top 10 tipos de establecimiento** más frecuentes
- **Distribución por distrito**
- **Porcentaje de registros** con coordenadas válidas
- **Porcentaje de registros** con datos de Google Maps
- **Porcentaje de registros** con datos definitivos

## Manejo de Errores

### Errores Comunes y Soluciones

1. **Archivo no encontrado**
   - Verificar que `data/CSV/dea_revisadas.csv` existe
   - Comprobar permisos de lectura

2. **Error de conexión a base de datos**
   - Verificar variable `DATABASE_URL` en `.env`
   - Comprobar que PostgreSQL esté ejecutándose

3. **Errores de formato de datos**
   - Revisar formato de fechas en el CSV
   - Verificar que las coordenadas sean numéricas

4. **Duplicados**
   - El importador usa `skipDuplicates: true` para evitar errores
   - Los registros duplicados se omiten automáticamente

### Logs de Error

Los errores se registran con información detallada:
- Número de línea del CSV
- ID del registro (si está disponible)
- Descripción específica del error
- Sugerencias de solución

## Rendimiento

- **Tamaño de lote**: 100 registros por lote
- **Tiempo estimado**: ~1-2 minutos para 10,000 registros
- **Memoria**: Procesamiento eficiente en memoria
- **Base de datos**: Optimizado para PostgreSQL

## Consideraciones de Seguridad

- Los datos se validan antes de la inserción
- Se usan consultas preparadas (Prisma ORM)
- No se ejecutan comandos SQL dinámicos
- Los errores no exponen información sensible

## Troubleshooting

### Si la importación falla completamente:

1. Verificar conexión a base de datos:
   ```bash
   npx prisma db pull
   ```

2. Verificar estructura del CSV:
   ```bash
   head -n 5 data/CSV/dea_revisadas.csv
   ```

3. Verificar logs de la aplicación para errores específicos

### Si algunos registros se omiten:

1. Revisar los logs de validación
2. Verificar que las coordenadas estén en el rango correcto
3. Comprobar que los códigos postales sean de Madrid
4. Verificar formato de fechas

## Mantenimiento

Para actualizar el importador:

1. Modificar `import-dea-revisadas.ts` según sea necesario
2. Actualizar las validaciones si cambian los requisitos
3. Ajustar el tamaño de lote si es necesario para rendimiento
4. Actualizar esta documentación con los cambios
