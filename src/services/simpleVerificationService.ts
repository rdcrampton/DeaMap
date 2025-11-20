// src/services/simpleVerificationService.ts

import { DeaRepository } from '@/repositories/deaRepository';
import { VerificationRepository } from '@/repositories/verificationRepository';
import { ArrowMarkerRepository } from '@/repositories/arrowMarkerRepository';
import { ProcessedImageRepository } from '@/repositories/processedImageRepository';
import { ServerImageProcessingService } from './serverImageProcessingService';
import { VerificationStep, VerificationStatus, ImageType } from '@/types/verification';
import { ARROW_CONFIG } from '@/utils/arrowConstants';
import type { 
  VerificationSession, 
  ArrowMarker 
} from '@/types/verification';
import type { DeaRecord, DeaRecordWithValidation } from '@/types';
import type { CropData, ArrowData } from '@/types/shared';

// Interfaz extendida para incluir el campo de estado de verificación
interface DeaRecordWithVerificationStatus extends DeaRecord {
  dataVerificationStatus?: string;
}

export class SimpleVerificationService {
  private deaRepository: DeaRepository;
  private verificationRepository: VerificationRepository;
  private arrowMarkerRepository: ArrowMarkerRepository;
  private processedImageRepository: ProcessedImageRepository;

  constructor() {
    this.deaRepository = new DeaRepository();
    this.verificationRepository = new VerificationRepository();
    this.arrowMarkerRepository = new ArrowMarkerRepository();
    this.processedImageRepository = new ProcessedImageRepository();
  }

  async getDeaRecordsForVerification(): Promise<DeaRecord[]> {
    // Obtener DEAs que tienen foto1 pero no han sido verificados ni descartados
    const allRecords = await this.deaRepository.findAll();
    
    // Obtener IDs de DEAs que ya tienen sesiones completadas o descartadas
    const completedSessions = await this.verificationRepository.findAll();
    const excludedDeaIds = new Set(
      completedSessions
        .filter(session => 
          session.status === VerificationStatus.COMPLETED || 
          session.status === VerificationStatus.DISCARDED
        )
        .map(session => session.deaRecordId)
    );
    
    return allRecords.filter(record => 
      record.foto1 && 
      record.foto1.trim() !== '' && 
      !excludedDeaIds.has(record.id)
    );
  }

  async getDeaRecordsForVerificationPaginated(page: number, limit: number): Promise<{
    data: DeaRecord[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    // Usar el método optimizado que solo trae IDs, no objetos completos
    const completedDeaIds = await this.verificationRepository.findCompletedDeaIds();

    // Usar el nuevo método optimizado del repositorio sin filtro de estado
    const result = await this.deaRepository.findForVerificationWithFilters(
      page, 
      limit, 
      undefined, // No status filter
      completedDeaIds
    );

    // Calcular paginación
    const totalPages = Math.ceil(result.totalCount / limit);
    
    // Convertir DeaRecordWithValidation[] a DeaRecord[] para mantener compatibilidad
    const data: DeaRecord[] = result.data.map(record => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { addressValidation, ...deaRecord } = record;
      return deaRecord;
    });
    
    return {
      data,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: result.totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  async getDeaRecordsCountForVerification(): Promise<number> {
    // Obtener todos los registros para contar los válidos
    const allRecords = await this.deaRepository.findAll();
    
    // Obtener IDs de DEAs que ya tienen sesiones completadas
    const completedSessions = await this.verificationRepository.findAll();
    const completedDeaIds = new Set(
      completedSessions
        .filter(session => session.status === VerificationStatus.COMPLETED)
        .map(session => session.deaRecordId)
    );
    
    return allRecords.filter(record => 
      record.foto1 && 
      record.foto1.trim() !== '' && 
      !completedDeaIds.has(record.id)
    ).length;
  }

  async startVerification(deaId: number): Promise<VerificationSession> {
    const deaRecord = await this.deaRepository.findById(deaId);
    if (!deaRecord) {
      throw new Error('DEA no encontrado');
    }

    if (!deaRecord.foto1) {
      throw new Error('El DEA no tiene una imagen para verificar');
    }

    // Verificar si ya existe una sesión en progreso
    const existingSession = await this.verificationRepository.findByDeaRecordId(deaId);
    if (existingSession) {
      return existingSession;
    }

    // Determinar paso inicial basado en el estado de verificación
    let initialStep = VerificationStep.DATA_VALIDATION;
    
    // Si el DEA está pre-verificado, saltar directamente a la selección de imágenes
    const deaRecordWithStatus = deaRecord as DeaRecordWithVerificationStatus;
    if (deaRecordWithStatus.dataVerificationStatus === 'pre_verified') {
      initialStep = VerificationStep.IMAGE_SELECTION;
      console.log(`🚀 DEA ${deaId} está pre-verificado, saltando validación de datos y comenzando en selección de imágenes`);
    }

    // Crear nueva sesión de verificación
    const session = await this.verificationRepository.create({
      deaRecordId: deaId,
      status: VerificationStatus.IN_PROGRESS,
      currentStep: initialStep,
      originalImageUrl: deaRecord.foto1,
      secondImageUrl: deaRecord.foto2 // Cargar la segunda imagen si existe
    });

    return session;
  }

  async getVerificationSession(sessionId: string): Promise<VerificationSession | null> {
    return await this.verificationRepository.findById(sessionId);
  }

  async updateStep(sessionId: string, step: VerificationStep): Promise<VerificationSession> {
    return await this.verificationRepository.updateStep(sessionId, step);
  }

  async saveCroppedImage(
    sessionId: string, 
    imageUrl: string, 
    cropData: CropData
  ): Promise<VerificationSession> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    try {
      console.log('=== INICIO PROCESAMIENTO DE IMAGEN ===');
      console.log('Session ID:', sessionId);
      console.log('Image URL:', imageUrl);
      console.log('Crop Data:', cropData);

      const processedImage = await ServerImageProcessingService.cropImage(
        imageUrl,
        cropData,
        {
          aspectRatio: 1,
          outputSize: { width: 1000, height: 1000 }
        }
      );

      console.log('✅ Imagen procesada exitosamente:', {
        filename: processedImage.filename,
        fileSize: processedImage.fileSize,
        dimensions: processedImage.dimensions
      });

      // Actualizar sesión con imagen recortada
      const updatedSession = await this.verificationRepository.update(sessionId, {
        croppedImageUrl: processedImage.imageUrl
      });

      // Guardar información de la imagen procesada
      await this.processedImageRepository.create({
        verificationSessionId: sessionId,
        originalFilename: 'original_image.jpg',
        processedFilename: processedImage.filename,
        imageType: ImageType.CROPPED,
        fileSize: processedImage.fileSize,
        dimensions: processedImage.dimensions
      });

      console.log('✅ Sesión actualizada y datos guardados');
      return updatedSession;
    } catch (error) {
      console.error('❌ Error en saveCroppedImage:', {
        sessionId,
        imageUrl,
        cropData,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Error al procesar la imagen: ${error}`);
    }
  }

  async saveArrowMarker(sessionId: string, arrowData: ArrowData): Promise<ArrowMarker> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    if (!session.croppedImageUrl) {
      throw new Error('No hay imagen recortada para añadir la flecha');
    }

    try {
      // Crear marcador de flecha en la base de datos
      const arrowMarker = await this.arrowMarkerRepository.create({
        verificationSessionId: sessionId,
        imageNumber: 1,
        startX: arrowData.startX,
        startY: arrowData.startY,
        endX: arrowData.endX,
        endY: arrowData.endY,
        arrowColor: arrowData.color,
        arrowWidth: arrowData.width
      });

      // Procesar la imagen con la flecha usando las constantes estandarizadas
      const imageWithArrow = await ServerImageProcessingService.addArrow(
        session.croppedImageUrl,
        [arrowData],
        {
          startPosition: 'bottom',
          color: ARROW_CONFIG.COLOR,
          width: ARROW_CONFIG.BODY_WIDTH,
          headLength: ARROW_CONFIG.HEAD_LENGTH,
          headWidth: ARROW_CONFIG.BODY_WIDTH
        }
      );

      // Actualizar sesión con imagen procesada
      await this.verificationRepository.update(sessionId, {
        processedImageUrl: imageWithArrow.imageUrl
      });

      // Guardar información de la imagen con flecha
      await this.processedImageRepository.create({
        verificationSessionId: sessionId,
        originalFilename: 'cropped_image.jpg',
        processedFilename: imageWithArrow.filename,
        imageType: ImageType.WITH_ARROW,
        fileSize: imageWithArrow.fileSize,
        dimensions: imageWithArrow.dimensions
      });

      return arrowMarker;
    } catch (error) {
      throw new Error(`Error al guardar la flecha: ${error}`);
    }
  }

  async completeVerification(sessionId: string): Promise<VerificationSession> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    // Permitir completar sin imágenes procesadas si está marcado como inválido
    if (!session.processedImageUrl && !session.markedAsInvalid) {
      throw new Error('La verificación no está completa');
    }

    try {
      // Actualizar sesión como completada
      const updatedSession = await this.verificationRepository.update(sessionId, {
        status: VerificationStatus.COMPLETED,
        currentStep: VerificationStep.COMPLETED,
        completedAt: new Date().toISOString()
      });

      // ✅ CAMBIO IMPORTANTE: NO actualizar la imagen original
      // La imagen original se mantiene intacta en dea_records.foto1
      // Solo guardamos la información de verificación en las tablas correspondientes

      return updatedSession;
    } catch (error) {
      throw new Error(`Error al completar la verificación: ${error}`);
    }
  }

  async cancelVerification(sessionId: string): Promise<void> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    try {
      // Actualizar estado de la sesión
      await this.verificationRepository.update(sessionId, {
        status: VerificationStatus.CANCELLED
      });

      // Las flechas y imágenes procesadas se mantienen para auditoría
    } catch (error) {
      throw new Error(`Error al cancelar la verificación: ${error}`);
    }
  }

  async discardVerification(
    sessionId: string,
    reason: string,
    notes?: string
  ): Promise<VerificationSession> {
    const session = await this.getVerificationSession(sessionId);
    if (!session) {
      throw new Error('Sesión de verificación no encontrada');
    }

    try {
      // Crear información de descarte
      const discardInfo = {
        reason,
        notes,
        discardedAt: new Date().toISOString()
      };

      // Actualizar sesión como descartada
      const updatedSession = await this.verificationRepository.update(sessionId, {
        status: VerificationStatus.DISCARDED,
        markedAsInvalid: true,
        stepData: {
          ...session.stepData,
          discardInfo
        }
      });

      console.log(`✅ DEA ${session.deaRecordId} marcado como descartado: ${reason}`);
      return updatedSession;
    } catch (error) {
      throw new Error(`Error al descartar la verificación: ${error}`);
    }
  }

  async getArrowMarkers(sessionId: string): Promise<ArrowMarker[]> {
    return await this.arrowMarkerRepository.findBySessionId(sessionId);
  }

  async deleteArrowMarker(markerId: string): Promise<void> {
    await this.arrowMarkerRepository.delete(markerId);
  }

  // Nuevos métodos para búsqueda y filtros
  async searchDeaById(id: number): Promise<DeaRecordWithValidation | null> {
    const record = await this.deaRepository.findWithAddressValidation(id);
    if (!record || !record.foto1 || record.foto1.trim() === '') {
      return null;
    }
    return record;
  }

  async searchDeaByProvisionalNumber(provisionalNumber: number): Promise<DeaRecordWithValidation | null> {
    const record = await this.deaRepository.findByProvisionalNumberWithAddressValidation(provisionalNumber);
    if (!record || !record.foto1 || record.foto1.trim() === '') {
      return null;
    }
    return record;
  }

  async getDeaRecordsForVerificationWithFilters(
    page: number, 
    limit: number, 
    statusFilter?: 'all' | 'needs_review' | 'invalid' | 'problematic'
  ): Promise<{
    data: DeaRecordWithValidation[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    // Usar el método optimizado que solo trae IDs, no objetos completos
    const completedDeaIds = await this.verificationRepository.findCompletedDeaIds();

    // Usar el nuevo método optimizado del repositorio
    const result = await this.deaRepository.findForVerificationWithFilters(
      page, 
      limit, 
      statusFilter, 
      completedDeaIds
    );

    // Calcular paginación
    const totalPages = Math.ceil(result.totalCount / limit);
    
    return {
      data: result.data,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: result.totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }
}
