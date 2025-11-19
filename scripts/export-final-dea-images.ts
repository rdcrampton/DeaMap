import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import sharp from 'sharp';

// Cargar variables de entorno (prioridad a .env.local)
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const prisma = new PrismaClient();

// Tipos personalizados para los datos seleccionados
interface SessionData {
  id: string;
  deaRecordId: number;
  image1Valid: boolean | null;
  image2Valid: boolean | null;
  imagesSwapped: boolean | null;
  croppedImageUrl: string | null;
  processedImageUrl: string | null;
  secondCroppedImageUrl: string | null;
  secondProcessedImageUrl: string | null;
  deaRecord: DeaRecordData;
}

interface DeaRecordData {
  id: number;
  numeroProvisionalDea: number;
  distrito: string;
  tipoVia: string;
  nombreVia: string;
  numeroVia: string | null;
  defCodDea: string | null;
}

interface FaceDetectionData {
  facesDetected: number;
  faceDetails: Array<{
    confidence: number;
    bbox: number[];
    area: number;
  }>;
  processingTimeMs: number;
  markedImagePath?: string;
}

interface ExportedDea {
  deaRecordId: number;
  codigoRM: string;
  numeroProvisionalDea: number;
  distrito: string;
  direccion: string;
  imagen1: {
    conFlecha: boolean;
    sinFlecha: boolean;
  };
  imagen2: {
    conFlecha: boolean;
    sinFlecha: boolean;
  };
  faceDetection?: {
    imagen1?: FaceDetectionData;
    imagen2?: FaceDetectionData;
    totalFaces: number;
    maxConfidence?: number;
  };
  errors: string[];
  warnings: string[];
}

interface ExportStats {
  totalDeas: number;
  exportedSuccessfully: number;
  withErrors: number;
  withWarnings: number;
  withImage1Only: number;
  withImage2Only: number;
  withBothImages: number;
  withoutRMCode: number;
}

interface ProgressTracker {
  startTime: number;
  processedCount: number;
  totalCount: number;
  successCount: number;
  errorCount: number;
}

class FinalDeaImageExporter {
  private exportDir: string;
  private stats: ExportStats;
  private exportedDeas: ExportedDea[];
  private errors: Array<{ deaId: number; error: string }>;
  private batchSize: number = 50;
  private rmCodeCache: Map<number, string>;
  private progress: ProgressTracker;
  private faceBlurApiUrl: string = 'http://localhost:5000';
  private faceBlurEnabled: boolean = true;

  constructor() {
    this.exportDir = path.join(process.cwd(), 'data', 'exports', 'dea-images-final');
    this.stats = {
      totalDeas: 0,
      exportedSuccessfully: 0,
      withErrors: 0,
      withWarnings: 0,
      withImage1Only: 0,
      withImage2Only: 0,
      withBothImages: 0,
      withoutRMCode: 0
    };
    this.exportedDeas = [];
    this.errors = [];
    this.rmCodeCache = new Map();
    this.progress = {
      startTime: Date.now(),
      processedCount: 0,
      totalCount: 0,
      successCount: 0,
      errorCount: 0
    };
  }

  /**
   * Llama a la API Docker para detectar y pixelar caras (con metadata completa)
   */
  private async callFaceDetectionAPI(
    base64Image: string, 
    codigoRM: string, 
    imageId: string
  ): Promise<{ pixelatedImage: string; detectionData: FaceDetectionData | null }> {
    try {
      const response = await fetch(`${this.faceBlurApiUrl}/detect-and-mark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          image: base64Image,
          min_confidence: 0.8,
          padding: 0.2,
          pixel_size: 5,
          return_marked_image: true
        })
      });

      if (!response.ok) {
        throw new Error(`API respondió con status ${response.status}`);
      }

      const data = await response.json();
      
      // Guardar imagen marcada si hay caras detectadas
      let markedImagePath: string | undefined;
      if (data.faces_detected > 0 && data.marked_image) {
        const detectionsDir = path.join(this.exportDir, 'face-detections', 'with-faces');
        if (!fs.existsSync(detectionsDir)) {
          fs.mkdirSync(detectionsDir, { recursive: true });
        }
        
        const markedFilename = `${codigoRM}${imageId}_marked.jpg`;
        const markedFilepath = path.join(detectionsDir, markedFilename);
        
        // Guardar imagen marcada
        const markedBuffer = Buffer.from(data.marked_image, 'base64');
        await sharp(markedBuffer)
          .jpeg({ quality: 90 })
          .toFile(markedFilepath);
        
        markedImagePath = path.relative(this.exportDir, markedFilepath);
      }
      
      // Construir metadata de detección
      const detectionData: FaceDetectionData = {
        facesDetected: data.faces_detected,
        faceDetails: data.face_details || [],
        processingTimeMs: data.processing_time_ms,
        markedImagePath
      };

      return {
        pixelatedImage: data.pixelated_image,
        detectionData
      };

    } catch (error) {
      console.warn(`⚠️  Face detection API no disponible, usando imagen original`);
      // Retornar imagen original sin metadata
      const base64Content = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
      return {
        pixelatedImage: base64Content,
        detectionData: null
      };
    }
  }

  /**
   * Procesa y guarda una imagen con detección de caras
   */
  private async saveBase64ImageWithDetection(
    base64Data: string, 
    outputPath: string,
    codigoRM: string,
    imageId: string
  ): Promise<FaceDetectionData | null> {
    try {
      let processedBase64 = base64Data;
      let detectionData: FaceDetectionData | null = null;

      // Intentar detectar y pixelar caras si está habilitado
      if (this.faceBlurEnabled) {
        const result = await this.callFaceDetectionAPI(base64Data, codigoRM, imageId);
        processedBase64 = result.pixelatedImage;
        detectionData = result.detectionData;
      }

      // Extraer base64 puro
      const base64Content = processedBase64.includes(',') 
        ? processedBase64.split(',')[1] 
        : processedBase64;

      // Convertir a buffer
      const buffer = Buffer.from(base64Content, 'base64');

      // Guardar imagen procesada con Sharp
      await sharp(buffer)
        .jpeg({ quality: 85 })
        .toFile(outputPath);

      return detectionData;

    } catch (err) {
      throw new Error(`Error al guardar imagen: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /**
   * Pre-carga todos los códigos RM en un caché para acceso rápido
   */
  private async preloadRMCodes(): Promise<void> {
    console.log('🔄 Pre-cargando códigos RM en caché...');
    
    const startTime = Date.now();
    
    // Cargar códigos RM desde dea_records.defCodDea
    const deaRecords = await prisma.deaRecord.findMany({
      where: {
        AND: [
          { defCodDea: { not: null } },
          { defCodDea: { not: '' } }
        ]
      },
      select: {
        id: true,
        defCodDea: true
      }
    });

    // Cargar en el caché
    for (const record of deaRecords) {
      if (record.defCodDea) {
        this.rmCodeCache.set(record.id, record.defCodDea);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ ${this.rmCodeCache.size.toLocaleString()} códigos RM cargados en ${duration}s\n`);
  }

  /**
   * Obtiene el código RM de un DEA (usando caché)
   */
  private getDeaRMCode(deaRecord: DeaRecordData): string | null {
    // Primero intentar desde defCodDea
    if (deaRecord.defCodDea) {
      return deaRecord.defCodDea;
    }

    // Buscar en el caché (mucho más rápido que consultar BD)
    return this.rmCodeCache.get(deaRecord.id) || null;
  }

  /**
   * Crea la estructura de carpetas para un DEA
   */
  private createDeaFolder(codigoRM: string): string {
    const deaFolder = path.join(this.exportDir, codigoRM);
    
    if (!fs.existsSync(deaFolder)) {
      fs.mkdirSync(deaFolder, { recursive: true });
    }

    return deaFolder;
  }

  /**
   * Exporta las imágenes de un DEA con detección de caras
   */
  private async exportDeaImages(
    session: SessionData,
    deaRecord: DeaRecordData,
    codigoRM: string
  ): Promise<ExportedDea> {
    const exportData: ExportedDea = {
      deaRecordId: deaRecord.id,
      codigoRM,
      numeroProvisionalDea: deaRecord.numeroProvisionalDea,
      distrito: deaRecord.distrito,
      direccion: `${deaRecord.tipoVia} ${deaRecord.nombreVia} ${deaRecord.numeroVia || ''}`.trim(),
      imagen1: { conFlecha: false, sinFlecha: false },
      imagen2: { conFlecha: false, sinFlecha: false },
      errors: [],
      warnings: []
    };

    // Variables para metadata de detección
    let detectionImg1: FaceDetectionData | null = null;
    let detectionImg2: FaceDetectionData | null = null;

    // Crear carpeta del DEA
    const deaFolder = this.createDeaFolder(codigoRM);

    // Exportar Imagen 1 (si está marcada como válida)
    if (session.image1Valid) {
      try {
        // Imagen 1 con flecha (con detección)
        if (session.processedImageUrl) {
          const filename1WithArrow = `${codigoRM}F1.jpg`;
          const filepath1WithArrow = path.join(deaFolder, filename1WithArrow);
          detectionImg1 = await this.saveBase64ImageWithDetection(
            session.processedImageUrl, 
            filepath1WithArrow,
            codigoRM,
            'F1'
          );
          exportData.imagen1.conFlecha = true;
        } else {
          exportData.warnings.push('Imagen 1 marcada como válida pero falta processedImageUrl (con flecha)');
        }

        // Imagen 1 sin flecha (limpia, sin detección adicional)
        if (session.croppedImageUrl) {
          const filename1Clean = `${codigoRM}F1_clean.jpg`;
          const filepath1Clean = path.join(deaFolder, filename1Clean);
          await this.saveBase64ImageWithDetection(
            session.croppedImageUrl,
            filepath1Clean,
            codigoRM,
            'F1_clean'
          );
          exportData.imagen1.sinFlecha = true;
        } else {
          exportData.warnings.push('Imagen 1 marcada como válida pero falta croppedImageUrl (sin flecha)');
        }
      } catch (err) {
        exportData.errors.push(`Error exportando Imagen 1: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Exportar Imagen 2 (si está marcada como válida)
    if (session.image2Valid) {
      try {
        // Imagen 2 con flecha (con detección)
        if (session.secondProcessedImageUrl) {
          const filename2WithArrow = `${codigoRM}F2.jpg`;
          const filepath2WithArrow = path.join(deaFolder, filename2WithArrow);
          detectionImg2 = await this.saveBase64ImageWithDetection(
            session.secondProcessedImageUrl,
            filepath2WithArrow,
            codigoRM,
            'F2'
          );
          exportData.imagen2.conFlecha = true;
        } else {
          exportData.warnings.push('Imagen 2 marcada como válida pero falta secondProcessedImageUrl (con flecha)');
        }

        // Imagen 2 sin flecha (limpia, sin detección adicional)
        if (session.secondCroppedImageUrl) {
          const filename2Clean = `${codigoRM}F2_clean.jpg`;
          const filepath2Clean = path.join(deaFolder, filename2Clean);
          await this.saveBase64ImageWithDetection(
            session.secondCroppedImageUrl,
            filepath2Clean,
            codigoRM,
            'F2_clean'
          );
          exportData.imagen2.sinFlecha = true;
        } else {
          exportData.warnings.push('Imagen 2 marcada como válida pero falta secondCroppedImageUrl (sin flecha)');
        }
      } catch (err) {
        exportData.errors.push(`Error exportando Imagen 2: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Agregar metadata de detección si hay caras
    const totalFaces = (detectionImg1?.facesDetected || 0) + (detectionImg2?.facesDetected || 0);
    if (totalFaces > 0) {
      const allConfidences = [
        ...(detectionImg1?.faceDetails.map(f => f.confidence) || []),
        ...(detectionImg2?.faceDetails.map(f => f.confidence) || [])
      ];
      const maxConfidence = allConfidences.length > 0 ? Math.max(...allConfidences) : undefined;

      exportData.faceDetection = {
        imagen1: detectionImg1 || undefined,
        imagen2: detectionImg2 || undefined,
        totalFaces,
        maxConfidence
      };
    }

    return exportData;
  }

  /**
   * Muestra el progreso actual
   */
  private displayProgress(batchIndex: number, totalBatches: number): void {
    const elapsed = (Date.now() - this.progress.startTime) / 1000;
    const percentage = (this.progress.processedCount / this.progress.totalCount) * 100;
    const speed = this.progress.processedCount / elapsed;
    const remaining = (this.progress.totalCount - this.progress.processedCount) / speed;

    // Barra de progreso
    const barLength = 30;
    const filled = Math.round((percentage / 100) * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    // Formatear tiempos
    const elapsedStr = this.formatTime(elapsed);
    const remainingStr = this.formatTime(remaining);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`📦 Lote ${batchIndex + 1}/${totalBatches} [${bar}] ${percentage.toFixed(1)}%`);
    console.log(`├─ Procesados: ${this.progress.processedCount.toLocaleString()}/${this.progress.totalCount.toLocaleString()}`);
    console.log(`├─ Exitosos: ${this.progress.successCount.toLocaleString()}`);
    console.log(`├─ Errores: ${this.progress.errorCount.toLocaleString()}`);
    console.log(`├─ Tiempo transcurrido: ${elapsedStr}`);
    console.log(`├─ Velocidad: ${speed.toFixed(1)} DEA/seg`);
    console.log(`└─ Tiempo estimado restante: ${remainingStr}`);
    console.log(`${'='.repeat(70)}\n`);
  }

  /**
   * Formatea segundos a formato legible (ej: "5m 23s")
   */
  private formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '---';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Procesa un lote de sesiones
   */
  private async processBatch(
    batch: SessionData[],
    batchIndex: number,
    totalBatches: number
  ): Promise<void> {
    this.displayProgress(batchIndex, totalBatches);

    for (const session of batch) {
      const deaRecord = session.deaRecord;
      
      // Obtener código RM
      const codigoRM = this.getDeaRMCode(deaRecord);
      
      if (!codigoRM) {
        this.progress.processedCount++;
        this.progress.errorCount++;
        this.stats.withoutRMCode++;
        this.errors.push({
          deaId: deaRecord.id,
          error: 'DEA no tiene código RM asignado'
        });
        continue;
      }

      // Verificar qué imágenes tiene
      const hasImage1 = session.image1Valid === true;
      const hasImage2 = session.image2Valid === true;

      if (!hasImage1 && !hasImage2) {
        this.progress.processedCount++;
        continue;
      }

      // Exportar imágenes
      try {
        const exportData = await this.exportDeaImages(session, deaRecord, codigoRM);
        this.exportedDeas.push(exportData);

        // Actualizar estadísticas
        if (exportData.errors.length > 0) {
          this.stats.withErrors++;
          this.progress.errorCount++;
        } else {
          this.stats.exportedSuccessfully++;
          this.progress.successCount++;
        }

        if (exportData.warnings.length > 0) {
          this.stats.withWarnings++;
        }

        // Contar distribución de imágenes
        if (hasImage1 && hasImage2) {
          this.stats.withBothImages++;
        } else if (hasImage1) {
          this.stats.withImage1Only++;
        } else if (hasImage2) {
          this.stats.withImage2Only++;
        }

        this.progress.processedCount++;

        // Log cada 10 DEA dentro del lote
        if (this.progress.processedCount % 10 === 0) {
          process.stdout.write(`\r[${this.progress.processedCount}/${this.progress.totalCount}] ${codigoRM} ✅`);
        }

      } catch (error) {
        this.progress.processedCount++;
        this.progress.errorCount++;
        this.stats.withErrors++;
        this.errors.push({
          deaId: deaRecord.id,
          error: error instanceof Error ? error.message : String(error)
        });
        process.stdout.write(`\r[${this.progress.processedCount}/${this.progress.totalCount}] DEA #${deaRecord.id} ❌`);
      }
    }

    console.log(''); // Nueva línea después del progreso inline
  }

  /**
   * Divide un array en lotes
   */
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Genera el reporte CSV con información de detección de caras
   */
  private generateCSVReport(): void {
    const csvHeaders = [
      'Código RM',
      'DEA Record ID',
      'Número Provisional',
      'Distrito',
      'Dirección',
      'Imagen 1 Con Flecha',
      'Imagen 1 Sin Flecha',
      'Imagen 2 Con Flecha',
      'Imagen 2 Sin Flecha',
      'Caras Img1',
      'Caras Img2',
      'Total Caras',
      'Confianza Max',
      'Imagen Marcada',
      'Errores',
      'Advertencias'
    ];

    const csvRows = this.exportedDeas.map(dea => {
      const carasImg1 = dea.faceDetection?.imagen1?.facesDetected || 0;
      const carasImg2 = dea.faceDetection?.imagen2?.facesDetected || 0;
      const totalCaras = dea.faceDetection?.totalFaces || 0;
      const confianza = dea.faceDetection?.maxConfidence 
        ? dea.faceDetection.maxConfidence.toFixed(2) 
        : '';
      const imagenMarcada = dea.faceDetection?.imagen1?.markedImagePath 
        || dea.faceDetection?.imagen2?.markedImagePath 
        || '';

      return [
        dea.codigoRM,
        dea.deaRecordId.toString(),
        dea.numeroProvisionalDea.toString(),
        dea.distrito,
        dea.direccion.replace(/"/g, '""'),
        dea.imagen1.conFlecha ? 'Sí' : 'No',
        dea.imagen1.sinFlecha ? 'Sí' : 'No',
        dea.imagen2.conFlecha ? 'Sí' : 'No',
        dea.imagen2.sinFlecha ? 'Sí' : 'No',
        carasImg1.toString(),
        carasImg2.toString(),
        totalCaras.toString(),
        confianza,
        imagenMarcada.replace(/\\/g, '/'), // Normalizar paths para CSV
        dea.errors.join('; ').replace(/"/g, '""'),
        dea.warnings.join('; ').replace(/"/g, '""')
      ].map(value => value.includes(';') || value.includes('"') ? `"${value}"` : value).join(';');
    });

    const csvContent = [csvHeaders.join(';'), ...csvRows].join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const csvFilename = `export-dea-images-${timestamp}.csv`;
    const csvFilepath = path.join(this.exportDir, csvFilename);

    // Agregar BOM UTF-8 para que Excel reconozca correctamente la codificación
    const BOM = '\uFEFF';
    fs.writeFileSync(csvFilepath, BOM + csvContent, 'utf8');
    console.log(`\n✅ Reporte CSV generado: ${csvFilename}`);
  }

  /**
   * Genera el reporte JSON
   */
  private generateJSONReport(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const totalTime = (Date.now() - this.progress.startTime) / 1000;

    const jsonData = {
      metadata: {
        exportDate: new Date().toISOString(),
        exportDirectory: this.exportDir,
        statistics: this.stats,
        performance: {
          totalTimeSeconds: totalTime,
          totalTimeFormatted: this.formatTime(totalTime),
          averageSpeedPerSecond: (this.progress.processedCount / totalTime).toFixed(2),
          averageSpeedPerMinute: ((this.progress.processedCount / totalTime) * 60).toFixed(2)
        }
      },
      deas: this.exportedDeas,
      errors: this.errors
    };

    const jsonFilename = `export-metadata-${timestamp}.json`;
    const jsonFilepath = path.join(this.exportDir, jsonFilename);

    fs.writeFileSync(jsonFilepath, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`✅ Reporte JSON generado: ${jsonFilename}`);
  }

  /**
   * Muestra las estadísticas finales
   */
  private displayStats(): void {
    const totalTime = (Date.now() - this.progress.startTime) / 1000;
    const avgSpeed = this.progress.processedCount / totalTime;

    console.log('\n' + '='.repeat(70));
    console.log('📊 ESTADÍSTICAS FINALES DE EXPORTACIÓN');
    console.log('='.repeat(70));
    console.log(`📦 Total de DEA procesados:        ${this.stats.totalDeas.toLocaleString()}`);
    console.log(`✅ Exportados exitosamente:        ${this.stats.exportedSuccessfully.toLocaleString()}`);
    console.log(`❌ Con errores:                    ${this.stats.withErrors.toLocaleString()}`);
    console.log(`⚠️  Con advertencias:              ${this.stats.withWarnings.toLocaleString()}`);
    console.log(`\n📸 Distribución de Imágenes:`);
    console.log(`   Solo Imagen 1:                  ${this.stats.withImage1Only.toLocaleString()}`);
    console.log(`   Solo Imagen 2:                  ${this.stats.withImage2Only.toLocaleString()}`);
    console.log(`   Ambas imágenes:                 ${this.stats.withBothImages.toLocaleString()}`);
    console.log(`\n⚠️  DEA sin código RM:             ${this.stats.withoutRMCode.toLocaleString()}`);
    console.log(`\n⏱️  Rendimiento:`);
    console.log(`   Tiempo total:                   ${this.formatTime(totalTime)}`);
    console.log(`   Velocidad promedio:             ${avgSpeed.toFixed(2)} DEA/seg (${(avgSpeed * 60).toFixed(0)} DEA/min)`);
    console.log('='.repeat(70));
  }

  /**
   * Método principal de exportación
   */
  async export(): Promise<void> {
    console.log('🚀 Iniciando exportación final de imágenes de DEA...\n');

    try {
      // Crear directorio de exportación
      if (!fs.existsSync(this.exportDir)) {
        fs.mkdirSync(this.exportDir, { recursive: true });
        console.log(`📁 Directorio de exportación creado: ${this.exportDir}\n`);
      }

      // Pre-cargar códigos RM
      await this.preloadRMCodes();

      // Verificar si la API de Face Blur está disponible
      console.log('🤖 Verificando servicio de detección de caras (Docker)...');
      try {
        const healthResponse = await fetch(`${this.faceBlurApiUrl}/health`);
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          console.log(`✅ Servicio de face blur activo:`);
          console.log(`   Modelo: ${healthData.model}`);
          console.log(`   GPU: ${healthData.using_gpu ? '✅ Habilitada' : '⚠️  Deshabilitada (usando CPU)'}`);
          console.log(`   TensorFlow: ${healthData.tensorflow_version}\n`);
          this.faceBlurEnabled = true;
        } else {
          throw new Error('API no disponible');
        }
      } catch (error) {
        console.warn('⚠️  Servicio de face blur no disponible - las imágenes no serán procesadas');
        console.warn('   Para habilitar: docker-compose up -d face-blur\n');
        this.faceBlurEnabled = false;
      }

      // Contar total de sesiones (sin cargar datos pesados)
      console.log('🔍 Contando sesiones de verificación completadas...');
      const totalCount = await prisma.verificationSession.count({
        where: {
          status: 'completed',
          markedAsInvalid: false
        }
      });

      console.log(`📊 Total de sesiones a procesar: ${totalCount.toLocaleString()}\n`);
      
      if (totalCount === 0) {
        console.log('⚠️  No hay sesiones para exportar.');
        return;
      }

      this.stats.totalDeas = totalCount;
      this.progress.totalCount = totalCount;
      this.progress.startTime = Date.now();

      // Configuración de lotes
      const FETCH_BATCH_SIZE = 50; // Cargar 50 sesiones a la vez (evita cargar 8GB de una vez)
      let processedSessionsCount = 0;
      let fetchBatchNumber = 0;

      console.log(`📦 Procesando en lotes de ${FETCH_BATCH_SIZE} sesiones\n`);

      // Procesar por lotes de carga
      while (processedSessionsCount < totalCount) {
        fetchBatchNumber++;
        
        console.log(`\n🔄 Cargando lote de datos ${fetchBatchNumber} (sesiones ${processedSessionsCount + 1}-${Math.min(processedSessionsCount + FETCH_BATCH_SIZE, totalCount)})...`);
        
        try {
          // Cargar lote de sesiones
          const sessionBatch = await prisma.verificationSession.findMany({
            where: {
              status: 'completed',
              markedAsInvalid: false
            },
            select: {
              id: true,
              deaRecordId: true,
              image1Valid: true,
              image2Valid: true,
              imagesSwapped: true,
              croppedImageUrl: true,
              processedImageUrl: true,
              secondCroppedImageUrl: true,
              secondProcessedImageUrl: true,
              deaRecord: {
                select: {
                  id: true,
                  numeroProvisionalDea: true,
                  distrito: true,
                  tipoVia: true,
                  nombreVia: true,
                  numeroVia: true,
                  defCodDea: true
                }
              }
            },
            skip: processedSessionsCount,
            take: FETCH_BATCH_SIZE,
            orderBy: {
              deaRecordId: 'asc'
            }
          });

          if (sessionBatch.length === 0) {
            console.log('⚠️  No se encontraron más sesiones.');
            break;
          }

          console.log(`✅ ${sessionBatch.length} sesiones cargadas en memoria`);

          // Dividir en sub-lotes para procesamiento (lotes de 50 para progreso)
          const processingBatches = this.createBatches(sessionBatch, this.batchSize);
          
          // Procesar cada sub-lote
          for (let i = 0; i < processingBatches.length; i++) {
            const globalBatchIndex = Math.floor(processedSessionsCount / this.batchSize) + i;
            const totalBatches = Math.ceil(totalCount / this.batchSize);
            
            await this.processBatch(processingBatches[i], globalBatchIndex, totalBatches);
            
            // Pausa entre sub-lotes
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          processedSessionsCount += sessionBatch.length;
          
          // Log de progreso del lote de carga
          const percentComplete = (processedSessionsCount / totalCount * 100).toFixed(1);
          console.log(`✅ Lote de carga ${fetchBatchNumber} completado (${processedSessionsCount}/${totalCount} = ${percentComplete}%)`);

        } catch (error) {
          console.error(`❌ Error procesando lote ${fetchBatchNumber}:`, error);
          // Continuar con el siguiente lote en lugar de fallar completamente
          processedSessionsCount += FETCH_BATCH_SIZE;
          continue;
        }

        // Pausa más larga entre lotes de carga para liberar memoria
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Generar reportes
      console.log('\n📝 Generando reportes...');
      this.generateCSVReport();
      this.generateJSONReport();

      // Mostrar estadísticas
      this.displayStats();

      console.log(`\n🎉 Exportación completada exitosamente!`);
      console.log(`📁 Directorio de exportación: ${this.exportDir}\n`);

    } catch (error) {
      console.error('❌ Error crítico durante la exportación:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Ejecutar exportación
const exporter = new FinalDeaImageExporter();
exporter.export().catch(console.error);
