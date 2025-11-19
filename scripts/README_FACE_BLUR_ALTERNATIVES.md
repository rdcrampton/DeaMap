# 🔒 Alternativas para Pixelado de Caras y Matrículas

## 🚨 Problema Detectado

La librería `@tensorflow/tfjs-node` requiere compilar binarios nativos de C++, lo cual necesita:
- Visual Studio Build Tools
- Python
- Configuración compleja en Windows

Esto hace que la solución basada en ML sea complicada de instalar.

## 💡 Soluciones Alternativas (Recomendadas)

### **Opción 1: Procesamiento Manual con Scripts Python** ⭐ RECOMENDADA

Usar Python con OpenCV es mucho más simple y no requiere compilación:

#### Instalación (muy simple):
```bash
pip install opencv-python pillow numpy
```

#### Script Python para Detectar y Pixelar Caras:
```python
import cv2
import os
from pathlib import Path

def pixelate_faces(image_path, output_path, pixel_size=16):
    """Detecta y pixela caras en una imagen"""
    # Cargar imagen
    img = cv2.imread(image_path)
    if img is None:
        return False
    
    # Cargar clasificador de caras (viene incluido con OpenCV)
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
    )
    
    # Detectar caras
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30)
    )
    
    # Pixelar cada cara
    for (x, y, w, h) in faces:
        # Añadir margen del 20%
        margin = int(w * 0.2)
        x1 = max(0, x - margin)
        y1 = max(0, y - margin)
        x2 = min(img.shape[1], x + w + margin)
        y2 = min(img.shape[0], y + h + margin)
        
        # Extraer región
        face_region = img[y1:y2, x1:x2]
        
        # Pixelar
        h_face, w_face = face_region.shape[:2]
        temp = cv2.resize(
            face_region,
            (w_face // pixel_size, h_face // pixel_size),
            interpolation=cv2.INTER_LINEAR
        )
        pixelated = cv2.resize(
            temp,
            (w_face, h_face),
            interpolation=cv2.INTER_NEAREST
        )
        
        # Reemplazar en imagen original
        img[y1:y2, x1:x2] = pixelated
    
    # Guardar
    cv2.imwrite(output_path, img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return len(faces) > 0

# Procesar todas las imágenes de un directorio
def process_directory(input_dir, output_dir):
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    processed = 0
    with_faces = 0
    
    for root, dirs, files in os.walk(input_dir):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                input_path = os.path.join(root, file)
                
                # Mantener estructura de carpetas
                rel_path = os.path.relpath(input_path, input_dir)
                output_path = os.path.join(output_dir, rel_path)
                os.makedirs(os.path.dirname(output_path), exist_ok=True)
                
                has_faces = pixelate_faces(input_path, output_path)
                processed += 1
                if has_faces:
                    with_faces += 1
                
                if processed % 100 == 0:
                    print(f"Procesadas: {processed}, Con caras: {with_faces}")
    
    print(f"\n✅ Total procesadas: {processed}")
    print(f"📸 Con caras detectadas: {with_faces}")

# Uso
if __name__ == "__main__":
    input_dir = "data/exports/dea-images-final"
    output_dir = "data/exports/dea-images-final-processed"
    process_directory(input_dir, output_dir)
```

**Ventajas**:
- ✅ Instalación simple (solo `pip install`)
- ✅ No requiere compilación
- ✅ Muy rápido (~50ms por imagen)
- ✅ Funciona en Windows, Mac, Linux
- ✅ Precisión ~85-90% para caras frontales

**Desventajas**:
- ⚠️ Necesita ejecutar script separado después de exportar

---

### **Opción 2: Servicio Web con API Local**

Usar un servidor Python Flask local:

#### `face_blur_server.py`:
```python
from flask import Flask, request, send_file
import cv2
import numpy as np
from io import BytesIO
import base64

app = Flask(__name__)

face_cascade = cv2.CascadeClassifier(
    cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
)

@app.route('/blur-faces', methods=['POST'])
def blur_faces():
    # Recibir imagen base64
    data = request.json
    img_b64 = data['image']
    
    # Decodificar
    img_bytes = base64.b64decode(img_b64.split(',')[1] if ',' in img_b64 else img_b64)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Detectar caras
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(30, 30))
    
    # Pixelar
    for (x, y, w, h) in faces:
        margin = int(w * 0.2)
        x1, y1 = max(0, x - margin), max(0, y - margin)
        x2, y2 = min(img.shape[1], x + w + margin), min(img.shape[0], y + h + margin)
        
        face_region = img[y1:y2, x1:x2]
        h_face, w_face = face_region.shape[:2]
        temp = cv2.resize(face_region, (w_face // 16, h_face // 16), cv2.INTER_LINEAR)
        img[y1:y2, x1:x2] = cv2.resize(temp, (w_face, h_face), cv2.INTER_NEAREST)
    
    # Codificar resultado
    _, buffer = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
    img_b64 = base64.b64encode(buffer).decode('utf-8')
    
    return {'image': img_b64, 'faces_detected': len(faces)}

if __name__ == '__main__':
    app.run(port=5000)
```

Luego en Node.js:
```typescript
async function processImageWithAPI(base64Image: string): Promise<Buffer> {
  const response = await fetch('http://localhost:5000/blur-faces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image })
  });
  
  const data = await response.json();
  return Buffer.from(data.image, 'base64');
}
```

---

### **Opción 3: APIs de Cloud (Pago por uso)**

Si prefieres no gestionar ML localmente:

#### Google Cloud Vision API
```typescript
import vision from '@google-cloud/vision';

const client = new vision.ImageAnnotatorClient();

async function detectFaces(imageBuffer: Buffer) {
  const [result] = await client.faceDetection(imageBuffer);
  const faces = result.faceAnnotations;
  
  return faces?.map(face => ({
    x: face.boundingPoly.vertices[0].x,
    y: face.boundingPoly.vertices[0].y,
    width: face.boundingPoly.vertices[2].x - face.boundingPoly.vertices[0].x,
    height: face.boundingPoly.vertices[2].y - face.boundingPoly.vertices[0].y
  })) || [];
}
```

**Costo estimado**: ~$1.50 por 1000 imágenes

---

## 🚗 Detección de Matrículas

### **Opción Recomendada: OCR con Tesseract.js**

No requiere compilación y funciona bien para matrículas:

```bash
npm install tesseract.js
```

```typescript
import Tesseract from 'tesseract.js';

async function detectLicensePlates(imageBuffer: Buffer): Promise<string[]> {
  const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  });
  
  // Buscar patrones de matrículas españolas
  const platePattern = /\b[0-9]{4}[A-Z]{3}\b|\b[A-Z]{1,2}[0-9]{4}[A-Z]{2}\b/g;
  const matches = text.match(platePattern) || [];
  
  return matches;
}
```

---

## 📋 Comparación de Opciones

| Opción | Instalación | Precisión | Velocidad | Costo | Complejidad |
|--------|------------|-----------|-----------|-------|-------------|
| **Python + OpenCV** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐⭐⭐ 85-90% | ⭐⭐⭐⭐⭐ Rápido | Gratis | Baja |
| **API Python Local** | ⭐⭐⭐⭐ Fácil | ⭐⭐⭐⭐ 85-90% | ⭐⭐⭐⭐ Rápido | Gratis | Media |
| **TensorFlow.js** | ⭐ Difícil | ⭐⭐⭐⭐⭐ 95%+ | ⭐⭐⭐ Medio | Gratis | Alta |
| **Cloud APIs** | ⭐⭐⭐⭐⭐ Muy fácil | ⭐⭐⭐⭐⭐ 98%+ | ⭐⭐⭐⭐ Rápido | Pago | Baja |
| **Tesseract.js** | ⭐⭐⭐⭐⭐ Simple | ⭐⭐⭐ 70-80% | ⭐⭐ Lento | Gratis | Baja |

---

## 🎯 Recomendación Final

### Para Caras:
**Script Python post-procesamiento** (Opción 1)

### Para Matrículas:
**Tesseract.js** + Patrones regex

### Flujo Recomendado:
1. Exportar imágenes con `npm run export-final-images` (sin procesamiento)
2. Ejecutar script Python: `python blur_faces.py`
3. Usar Tesseract.js para matrículas si es necesario

---

## 🛠️ Instalación Rápida (Solución Python)

```bash
# 1. Instalar Python (si no lo tienes)
# Descargar de: https://www.python.org/downloads/

# 2. Instalar dependencias
pip install opencv-python pillow numpy

# 3. Guardar script blur_faces.py
# (código arriba)

# 4. Ejecutar
python blur_faces.py
```

---

## 📞 ¿Necesitas Ayuda?

Si prefieres que implemente alguna de estas alternativas:
1. **Opción 1 (Python)** - Simple y efectivo
2. **Opción 2 (API Local)** - Integrado con Node.js
3. **Tesseract.js** - Para matrículas

Avísame cuál prefieres y lo implemento completo.

---

**Última actualización**: 18/11/2025
**Recomendación**: Usar Python + OpenCV (más simple y sin problemas de compilación)
