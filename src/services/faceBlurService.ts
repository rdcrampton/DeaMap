import * as faceapi from '@vladmandic/face-api';
import * as canvas from 'canvas';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';

// Configurar canvas para face-api (necesario en Node.js)
const { Canvas, Image, ImageData } = canvas;
// @ts-expect-error - face-api requiere polyfill de canvas en Node.js
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

/**
 * Configuración del servicio de detección de caras
 */
export interface FaceBlurConfig {
  enabled: boolean;
  modelType: 'blazeface' | 'ssd' | 'tiny';
  pixelSize: number;
  padding: number;
  minConfidence: number;
  blurType: 'pixelate' | 'blur';
}

/**
 * Región de una cara detectada
 */
export interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

/**
 * Servicio para detectar y pixelar/desenfocar caras en imágenes
 */
class FaceBlurService {
  private modelsLoaded: boolean = false;
  private config: FaceBlurConfig;
  private modelsPath: string;

  constructor(config?: Partial<FaceBlurConfig>) {
    this.config = {
      enabled: true,
      modelType: 'blazeface',
      pixelSize: 16,
      padding: 0.2, // 20% de margen adicional
      minConfidence: 0.5,
      blurType: 'pixelate',
      ...config
    };

    // Directorio donde se descargarán los modelos
    this.modelsPath = path.join(process.cwd(), 'node_modules', '@vladmandic', 'face-api', 'model');
  }

  /**
   * Inicializa y carga los modelos de detección de caras
   */
  async initialize(): Promise<void> {
    if (this.modelsLoaded) {
      return;
    }

    try {
      console.log('🔄 Cargando modelos de detección de caras...');
      const startTime = Date.now();

      // Verificar que los modelos existen
      if (!fs.existsSync(this.modelsPath)) {
        throw new Error(`No se encontraron los modelos en: ${this.modelsPath}`);
      }

      // Cargar el modelo seleccionado
      if (this.config.modelType === 'ssd') {
        await faceapi.nets.ssdMobilenetv1.loadFromDisk(this.modelsPath);
      } else if (this.config.modelType === 'tiny') {
        await faceapi.nets.tinyFaceDetector.loadFromDisk(this.modelsPath);
      } else {
        // BlazeFace es el más rápido y eficiente
        await faceapi.nets.tinyFaceDetector.loadFromDisk(this.modelsPath);
      }

      this.modelsLoaded = true;
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`✅ Modelos cargados correctamente en ${duration}s`);

    } catch (error) {
      console.error('❌ Error cargando modelos de face-api:', error);
      throw new Error(`No se pudieron cargar los modelos: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detecta caras en una imagen (Buffer)
   */
  async detectFaces(imageBuffer: Buffer): Promise<FaceRegion[]> {
    if (!this.modelsLoaded) {
      await this.initialize();
    }

    try {
      // Convertir Buffer a imagen canvas
      const img = await canvas.loadImage(imageBuffer);
      
      // Detectar caras según el modelo configurado
      let detections;
      if (this.config.modelType === 'ssd') {
        detections = await faceapi.detectAllFaces(
          img as unknown as HTMLImageElement,
          new faceapi.SsdMobilenetv1Options({ minConfidence: this.config.minConfidence })
        );
      } else {
        // TinyFaceDetector (más rápido)
        detections = await faceapi.detectAllFaces(
          img as unknown as HTMLImageElement,
          new faceapi.TinyFaceDetectorOptions({
            inputSize: 416,
            scoreThreshold: this.config.minConfidence
          })
        );
      }

      // Convertir a nuestro formato de regiones
      const faceRegions: FaceRegion[] = detections.map(detection => {
        const box = detection.box;
        const padding = this.config.padding;

        // Calcular margen adicional
        const paddingWidth = box.width * padding;
        const paddingHeight = box.height * padding;

        return {
          x: Math.max(0, Math.floor(box.x - paddingWidth / 2)),
          y: Math.max(0, Math.floor(box.y - paddingHeight / 2)),
          width: Math.ceil(box.width + paddingWidth),
          height: Math.ceil(box.height + paddingHeight),
          confidence: detection.score
        };
      });

      return faceRegions;

    } catch (error) {
      console.error('❌ Error detectando caras:', error);
      return []; // Retornar array vacío en caso de error (no fallar toda la exportación)
    }
  }

  /**
   * Aplica pixelado o blur a las regiones de caras detectadas
   */
  async blurFaces(imageBuffer: Buffer, faceRegions: FaceRegion[]): Promise<Buffer> {
    if (faceRegions.length === 0) {
      return imageBuffer;
    }

    try {
      // Obtener metadata de la imagen
      const metadata = await sharp(imageBuffer).metadata();
      const imageWidth = metadata.width || 0;
      const imageHeight = metadata.height || 0;

      // Crear imagen base
      let image = sharp(imageBuffer);

      // Procesar cada región de cara
      for (const region of faceRegions) {
        // Asegurar que la región está dentro de los límites
        const x = Math.max(0, region.x);
        const y = Math.max(0, region.y);
        const width = Math.min(region.width, imageWidth - x);
        const height = Math.min(region.height, imageHeight - y);

        if (width <= 0 || height <= 0) continue;

        // Extraer la región de la cara
        const faceBuffer = await sharp(imageBuffer)
          .extract({ left: x, top: y, width, height })
          .toBuffer();

        // Aplicar el efecto seleccionado
        let processedFace: Buffer;
        if (this.config.blurType === 'pixelate') {
          // Pixelado: reducir y luego ampliar sin interpolación
          const pixelSize = this.config.pixelSize;
          const smallWidth = Math.max(1, Math.floor(width / pixelSize));
          const smallHeight = Math.max(1, Math.floor(height / pixelSize));

          processedFace = await sharp(faceBuffer)
            .resize(smallWidth, smallHeight, { kernel: 'nearest' })
            .resize(width, height, { kernel: 'nearest' })
            .toBuffer();
        } else {
          // Blur gaussiano
          processedFace = await sharp(faceBuffer)
            .blur(20)
            .toBuffer();
        }

        // Componer la cara procesada sobre la imagen original
        image = image.composite([{
          input: processedFace,
          left: x,
          top: y
        }]);
      }

      // Retornar la imagen procesada
      return await image.toBuffer();

    } catch (error) {
      console.error('❌ Error aplicando blur a caras:', error);
      return imageBuffer; // Retornar imagen original en caso de error
    }
  }

  /**
   * Procesa una imagen completa: detecta y pixela caras
   * @param base64Image - Imagen en formato base64 (con o sin prefijo data:image/...)
   * @returns Buffer con la imagen procesada
   */
  async processImageWithFaceBlur(base64Image: string): Promise<Buffer> {
    // TEMPORALMENTE DESHABILITADO debido a problemas de compilación con tfjs-node
    // Para habilitar, instala las herramientas de compilación de Visual Studio
    // Ver README_FACE_BLUR.md para instrucciones
    
    console.warn('⚠️  Detección de caras temporalmente deshabilitada - requiere configuración adicional');
    
    // Convertir base64 a buffer sin procesamiento
    const base64Content = base64Image.includes(',') 
      ? base64Image.split(',')[1] 
      : base64Image;
    return Buffer.from(base64Content, 'base64');
    
    /* CÓDIGO ORIGINAL (deshabilitado temporalmente)
    if (!this.config.enabled) {
      // Si está deshabilitado, solo convertir base64 a buffer
      const base64Content = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;
      return Buffer.from(base64Content, 'base64');
    }

    try {
      // Convertir base64 a buffer
      const base64Content = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;
      const imageBuffer = Buffer.from(base64Content, 'base64');

      // Detectar caras
      const faceRegions = await this.detectFaces(imageBuffer);

      if (faceRegions.length === 0) {
        // No se detectaron caras, retornar imagen original
        return imageBuffer;
      }

      // Aplicar blur/pixelado a las caras detectadas
      const processedBuffer = await this.blurFaces(imageBuffer, faceRegions);

      return processedBuffer;

    } catch (error) {
      console.error('❌ Error procesando imagen con face blur:', error);
      // En caso de error, retornar imagen original
      const base64Content = base64Image.includes(',') 
        ? base64Image.split(',')[1] 
        : base64Image;
      return Buffer.from(base64Content, 'base64');
    }
    */
  }

  /**
   * Actualiza la configuración del servicio
   */
  updateConfig(config: Partial<FaceBlurConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Obtiene la configuración actual
   */
  getConfig(): FaceBlurConfig {
    return { ...this.config };
  }

  /**
   * Obtiene estadísticas de detección
   */
  getStats() {
    return {
      modelsLoaded: this.modelsLoaded,
      config: this.config,
      modelsPath: this.modelsPath
    };
  }
}

// Exportar instancia singleton
export const faceBlurService = new FaceBlurService({
  enabled: true,
  modelType: 'tiny', // El más rápido
  pixelSize: 16,
  padding: 0.2,
  minConfidence: 0.5,
  blurType: 'pixelate'
});

export default faceBlurService;
