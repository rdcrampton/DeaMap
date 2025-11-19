# 🔒 Sistema de Detección y Pixelado de Caras

## 📋 Descripción

Este sistema detecta automáticamente caras en las imágenes de DEA exportadas y las pixela para proteger la privacidad de las personas y cumplir con GDPR/LOPD.

## 🎯 Características

- ✅ **100% Gratuito** - Sin costos de APIs externas
- ✅ **Procesamiento Local** - Las imágenes no salen del servidor
- ✅ **Detección Automática** - Usa modelos de ML pre-entrenados
- ✅ **Configurable** - Ajusta precisión, tamaño de píxel, etc.
- ✅ **Integrado** - Funciona automáticamente en el export-final-dea-images.ts

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│  export-final-dea-images.ts                             │
│                                                          │
│  1. Cargar imagen Base64 → Buffer                       │
│  2. ⭐ faceBlurService.processImageWithFaceBlur()       │
│     ├─ Detectar caras con face-api.js                  │
│     ├─ Aplicar pixelado con Sharp                      │
│     └─ Retornar buffer procesado                       │
│  3. Guardar imagen procesada (JPEG)                     │
└─────────────────────────────────────────────────────────┘
```

## 📦 Dependencias

```json
{
  "@vladmandic/face-api": "^1.7.x",
  "canvas": "^2.11.x",
  "sharp": "^0.34.x"
}
```

## ⚙️ Configuración

El servicio se configura en `src/services/faceBlurService.ts`:

```typescript
export const faceBlurService = new FaceBlurService({
  enabled: true,              // Activar/desactivar detección
  modelType: 'tiny',          // 'tiny' | 'ssd' | 'blazeface'
  pixelSize: 16,             // Tamaño del píxel (8, 16, 24...)
  padding: 0.2,              // Margen adicional (20%)
  minConfidence: 0.5,        // Confianza mínima (0.0-1.0)
  blurType: 'pixelate'       // 'pixelate' | 'blur'
});
```

### 🎛️ Parámetros Explicados

#### `enabled` (boolean)
- **true**: Activa la detección y pixelado de caras
- **false**: Desactiva el procesamiento (guarda imágenes originales)

#### `modelType` (string)
- **'tiny'**: TinyFaceDetector - Rápido y eficiente (RECOMENDADO)
  - Velocidad: ~100-150ms por imagen
  - Precisión: ~90-95%
  - Uso de RAM: Bajo
- **'ssd'**: SSD MobileNet v1 - Más preciso pero más lento
  - Velocidad: ~200-300ms por imagen
  - Precisión: ~95-98%
  - Uso de RAM: Medio

#### `pixelSize` (number)
Tamaño del bloque de pixelado:
- **8**: Pixelado muy denso (más protección, menos estética)
- **16**: Pixelado estándar (RECOMENDADO para GDPR)
- **24**: Pixelado más ligero (más estético, menos protección)

#### `padding` (number)
Margen adicional alrededor de la cara detectada:
- **0.0**: Sin margen (solo la cara)
- **0.2**: 20% de margen (RECOMENDADO)
- **0.3**: 30% de margen (máxima protección)

#### `minConfidence` (number)
Nivel mínimo de confianza para detectar una cara:
- **0.3**: Muy sensible (puede detectar falsos positivos)
- **0.5**: Equilibrado (RECOMENDADO)
- **0.7**: Muy estricto (puede omitir algunas caras)

#### `blurType` (string)
Tipo de ofuscación aplicada:
- **'pixelate'**: Efecto pixelado/bloques (RECOMENDADO para GDPR)
- **'blur'**: Desenfoque gaussiano (más estético, menos robusto)

## 🚀 Uso

### Exportación Automática

El sistema se integra automáticamente en la exportación:

```bash
npm run export-final-images
```

Las caras se detectan y pixelan automáticamente durante el proceso de exportación.

### Uso Manual del Servicio

Si necesitas usar el servicio en otro script:

```typescript
import faceBlurService from '../src/services/faceBlurService';

// Inicializar modelos (solo una vez)
await faceBlurService.initialize();

// Procesar imagen
const base64Image = "data:image/jpeg;base64,...";
const processedBuffer = await faceBlurService.processImageWithFaceBlur(base64Image);

// Guardar imagen procesada
await sharp(processedBuffer)
  .jpeg({ quality: 85 })
  .toFile('output.jpg');
```

### Cambiar Configuración en Tiempo de Ejecución

```typescript
// Actualizar configuración
faceBlurService.updateConfig({
  pixelSize: 24,
  minConfidence: 0.6
});

// Verificar configuración actual
console.log(faceBlurService.getConfig());
```

### Desactivar Temporalmente

Para desactivar el pixelado sin modificar código:

```typescript
faceBlurService.updateConfig({ enabled: false });
```

## 📊 Rendimiento

### Tiempos Estimados

Con modelo **'tiny'** (recomendado):
- **Inicialización**: ~2-3 segundos (una sola vez)
- **Detección por imagen**: ~100-150ms
- **Pixelado con Sharp**: ~50ms
- **Total por imagen**: ~150-200ms adicionales

### Para 8000 Imágenes
- **Tiempo adicional**: ~20-30 minutos
- **RAM adicional**: ~200-300 MB

### Optimización

El sistema ya está optimizado para:
- ✅ Carga de modelos una sola vez
- ✅ Procesamiento en lotes
- ✅ Manejo robusto de errores (no falla toda la exportación)
- ✅ Caché de resultados cuando es posible

## 🔍 Logs y Monitoreo

Durante la exportación verás logs como:

```
🤖 Inicializando modelos de detección de caras...
🔄 Cargando modelos de detección de caras...
✅ Modelos cargados correctamente en 2.34s
✅ Configuración: {
  "enabled": true,
  "modelType": "tiny",
  "pixelSize": 16,
  "padding": 0.2,
  "minConfidence": 0.5,
  "blurType": "pixelate"
}
```

### Errores Comunes

#### "No se encontraron los modelos en: ..."
**Solución**: Los modelos se descargan automáticamente con npm. Si falta:
```bash
npm install @vladmandic/face-api --force
```

#### "Error detectando caras: ..."
**Solución**: El sistema continúa y guarda la imagen original. No afecta la exportación completa.

#### Velocidad muy lenta
**Soluciones**:
1. Cambiar a modelo 'tiny' (más rápido)
2. Aumentar `minConfidence` a 0.6-0.7
3. Reducir `pixelSize` a 12 o menos

## 🧪 Pruebas

### Probar con una sola imagen

Crea un script de prueba `test-face-blur.ts`:

```typescript
import faceBlurService from '../src/services/faceBlurService';
import sharp from 'sharp';
import * as fs from 'fs';

async function test() {
  await faceBlurService.initialize();
  
  // Cargar imagen de prueba
  const imageBuffer = fs.readFileSync('test-image.jpg');
  const base64 = imageBuffer.toString('base64');
  
  // Procesar
  const processed = await faceBlurService.processImageWithFaceBlur(base64);
  
  // Guardar resultado
  await sharp(processed)
    .jpeg({ quality: 85 })
    .toFile('test-image-processed.jpg');
  
  console.log('✅ Imagen procesada correctamente');
}

test().catch(console.error);
```

Ejecutar:
```bash
tsx test-face-blur.ts
```

## 🛡️ Seguridad y Privacidad

### Cumplimiento GDPR/LOPD

- ✅ **Procesamiento Local**: Las imágenes no se envían a servicios externos
- ✅ **Anonimización Robusta**: Pixelado de 16px cumple estándares
- ✅ **Sin Almacenamiento de Datos Biométricos**: No se guardan datos de caras
- ✅ **Reversibilidad Mínima**: Pixelado de 16px+ es irreversible en la práctica

### Recomendaciones

1. **Pixelado ≥ 16px**: Para cumplir con GDPR
2. **Padding ≥ 20%**: Para incluir bordes de la cara
3. **Modelo 'tiny'**: Balance entre velocidad y precisión
4. **Verificación Manual**: Revisar algunas imágenes exportadas

## 🔧 Solución de Problemas

### Caras no detectadas

**Causas**:
- Cara muy pequeña en la imagen
- Cara de perfil o con ángulo extremo
- Mala iluminación
- `minConfidence` muy alto

**Soluciones**:
1. Reducir `minConfidence` a 0.3-0.4
2. Aumentar `padding` a 0.3
3. Cambiar a modelo 'ssd' (más preciso pero más lento)

### Falsos positivos

**Causas**:
- `minConfidence` muy bajo
- Objetos que parecen caras

**Soluciones**:
1. Aumentar `minConfidence` a 0.6-0.7
2. Revisar visualmente las imágenes

### Consumo excesivo de memoria

**Soluciones**:
1. El sistema procesa en lotes de 50 imágenes
2. Hay pausas automáticas entre lotes
3. Si persiste, reducir `FETCH_BATCH_SIZE` en export-final-dea-images.ts

## 📚 Referencias

- **@vladmandic/face-api**: https://github.com/vladmandic/face-api
- **TinyFaceDetector Paper**: https://arxiv.org/abs/1905.00641
- **GDPR Image Anonymization**: https://gdpr.eu/anonymization/

## 🔄 Actualizaciones Futuras

### Roadmap

- [ ] Detección de matrículas (OCR + pattern matching)
- [ ] Ajuste automático de parámetros según tipo de imagen
- [ ] Reportes con estadísticas de caras detectadas
- [ ] Modo de revisión manual antes de exportar
- [ ] Detección de otros elementos sensibles (DNI, tarjetas, etc.)

## 💡 Consejos Avanzados

### Ajuste Fino para Diferentes Escenarios

**Imágenes con muchas personas**:
```typescript
faceBlurService.updateConfig({
  modelType: 'ssd',
  minConfidence: 0.4,
  padding: 0.25
});
```

**Máxima velocidad**:
```typescript
faceBlurService.updateConfig({
  modelType: 'tiny',
  minConfidence: 0.6,
  padding: 0.15,
  pixelSize: 12
});
```

**Máxima protección**:
```typescript
faceBlurService.updateConfig({
  modelType: 'ssd',
  minConfidence: 0.3,
  padding: 0.3,
  pixelSize: 20
});
```

## 📞 Soporte

Si tienes problemas:
1. Revisa los logs de exportación
2. Verifica la configuración en `faceBlurService.ts`
3. Prueba con una sola imagen usando el script de prueba
4. Revisa la sección de "Solución de Problemas"

---

**Última actualización**: 18/11/2025
**Versión**: 1.0.0
**Autor**: Sistema de Gestión DEA Madrid
