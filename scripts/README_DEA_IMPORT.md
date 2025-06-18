# Script de Importación de DEAs

Este script permite importar los registros de DEAs desde el archivo CSV provisional a la base de datos.

## Archivos

- `import-dea-provisional.ts` - Script principal de importación
- `run-dea-import.ts` - Script ejecutor simplificado
- `data/CSV/dea provisional.csv` - Archivo CSV fuente

## Uso

### Comando rápido
```bash
npm run import-deas
```

### Ejecución directa
```bash
npx tsx scripts/run-dea-import.ts
```

## Características del Script

### Mapeo de Campos CSV → Base de Datos

| Campo CSV | Campo BD | Tipo | Notas |
|-----------|----------|------|-------|
| `Número provisional DEA` | `numeroProvisionalDea` | number | Puede estar vacío (se asigna 0) |
| `Tipo de establecimiento` | `tipoEstablecimiento` | string | Obligatorio |
| `Titularidad del local` | `titularidadLocal` | string | Con valor por defecto |
| `Uso del local` | `usoLocal` | string | Con valor por defecto |
| `Titularidad` | `titularidad` | string | Con valor por defecto |
| `Propuesta de denominación` | `propuestaDenominacion` | string | Con valor por defecto |
| `Tipo de vía` | `tipoVia` | string | Por defecto "Calle" |
| `Nombre de la vía` | `nombreVia` | string | Obligatorio |
| `Número de la vía` | `numeroVia` | string? | Opcional |
| `Complemento de dirección` | `complementoDireccion` | string? | Opcional |
| `Código postal` | `codigoPostal` | number | Obligatorio, validado (28xxx) |
| `Distrito` | `distrito` | string | Con valor por defecto |
| `Coordenadas-Latitud (norte)` | `latitud` | number | Obligatorio, validado (40.0-41.0) |
| `Coordenadas-Longitud (oeste, por lo tanto, negativa)` | `longitud` | number | Obligatorio, validado (-4.0 a -3.0) |

### Campos con Valores por Defecto

Los siguientes campos obligatorios en la BD no están en el CSV y se asignan valores por defecto:

- `horaInicio`: Ayer
- `horaFinalizacion`: Mañana
- `correoElectronico`: "importacion@dea.madrid.es"
- `nombre`: "DEA {numeroProvisionalDea}"
- `horarioApertura`: "24/7"
- `aperturaLunesViernes`: 0
- `cierreLunesViernes`: 2359
- `aperturaSabados`: 0
- `cierreSabados`: 2359
- `aperturaDomingos`: 0
- `cierreDomingos`: 2359
- `vigilante24h`: "No especificado"
- `comentarioLibre`: "Importado desde CSV provisional - Fila {N}"

### Validaciones

1. **Coordenadas**: Deben estar en el rango válido para Madrid
   - Latitud: 40.0 - 41.0
   - Longitud: -4.0 a -3.0

2. **Código Postal**: Debe ser de Madrid (28xxx)

3. **Campos Obligatorios**: Tipo de establecimiento y nombre de vía

### Características Técnicas

- **Procesamiento por lotes**: 50 registros por lote para optimizar rendimiento
- **Manejo de errores**: Continúa procesando aunque algunos registros fallen
- **Encoding automático**: Detecta y maneja UTF-8 y Latin1
- **Estadísticas detalladas**: Muestra resumen por tipo de establecimiento y distrito
- **Validación de datos**: Verifica coordenadas y códigos postales

### Salida del Script

El script proporciona:

1. **Progreso en tiempo real**: Muestra el avance de cada lote
2. **Estadísticas finales**:
   - Total de registros importados
   - Distribución por tipo de establecimiento
   - Distribución por distrito
   - Porcentaje de coordenadas válidas
3. **Tiempo de ejecución**

### Ejemplo de Salida

```
🎯 Iniciando importación de registros DEA desde CSV provisional...

🚀 Iniciando importación de registros DEA...
📋 Headers encontrados: Número provisional DEA, Tipo de establecimiento, ...
📊 Encontrados 739 registros en el CSV
✅ 735 registros válidos para importar
📦 Importando 735 registros en 15 lotes...
✅ Lote 1/15 importado (50 registros)
...

📊 ESTADÍSTICAS DE IMPORTACIÓN:
📋 Total de registros DEA: 735

🏢 REGISTROS POR TIPO DE ESTABLECIMIENTO:
   Centro de salud: 245
   Farmacia: 189
   ...

🏛️ REGISTROS POR DISTRITO:
   Centro: 89
   Chamberí: 67
   ...

🌍 Registros con coordenadas válidas: 735 (100.0%)

⏱️ Importación completada en 12.34 segundos
🎉 ¡Proceso finalizado exitosamente!
```

## Notas Importantes

1. **Limpieza de datos**: Por defecto, el script NO elimina registros existentes. Para hacerlo, descomenta la línea `await this.clearExistingDeas();` en el método `importDeas()`.

2. **Duplicados**: El script usa `skipDuplicates: true` para evitar errores por registros duplicados.

3. **Recuperación de errores**: Si un lote falla, el script intenta importar los registros individualmente para identificar el problema específico.

4. **Encoding**: El script maneja automáticamente diferentes encodings del archivo CSV.

## Troubleshooting

### Error: "Archivo CSV no encontrado"
- Verifica que el archivo `data/CSV/dea provisional.csv` existe
- Verifica la ruta y el nombre del archivo

### Error: "Coordenadas inválidas"
- Revisa que las coordenadas estén en formato decimal
- Verifica que estén en el rango válido para Madrid

### Error: "Código postal inválido"
- Asegúrate de que los códigos postales sean de Madrid (28xxx)
- Verifica que no haya valores vacíos o no numéricos

### Registros omitidos
- Revisa los logs para ver qué validaciones fallan
- Verifica que los campos obligatorios tengan valores
