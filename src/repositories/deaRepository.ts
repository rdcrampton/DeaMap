import { prisma } from '@/lib/db'
import type { DeaRecord, DeaRecordWithValidation } from '@/types'
import { VerificationStatus } from '@/types/verification'

export interface IDeaRepository {
  findAll(): Promise<DeaRecord[]>;
  findAllPaginated(page: number, limit: number): Promise<DeaRecord[]>;
  findAllVerifiedAndCompleted(): Promise<DeaRecord[]>;
  findAllVerifiedAndCompletedPaginated(page: number, limit: number): Promise<{
    data: DeaRecord[];
    totalCount: number;
  }>;
  countAll(): Promise<number>;
  countVerifiedAndCompleted(): Promise<number>;
  findById(id: number): Promise<DeaRecord | null>;
  findByProvisionalNumber(provisionalNumber: number): Promise<DeaRecord | null>;
  findWithAddressValidation(id: number): Promise<DeaRecordWithValidation | null>;
  findByProvisionalNumberWithAddressValidation(provisionalNumber: number): Promise<DeaRecordWithValidation | null>;
  findForVerificationWithFilters(page: number, limit: number, statusFilter?: string, excludeCompletedIds?: number[]): Promise<{
    data: DeaRecordWithValidation[];
    totalCount: number;
  }>;
  create(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord>;
  update(id: number, data: Partial<DeaRecord>): Promise<DeaRecord>;
  delete(id: number): Promise<DeaRecord>;
}

export class DeaRepository implements IDeaRepository {
  private mapToDeaRecord(record: Record<string, unknown>): DeaRecord {
    return {
      ...record,
      horaInicio: (record.horaInicio as Date).toISOString(),
      horaFinalizacion: (record.horaFinalizacion as Date).toISOString(),
      createdAt: (record.createdAt as Date).toISOString(),
      updatedAt: (record.updatedAt as Date).toISOString()
    } as DeaRecord;
  }

  async findAll(): Promise<DeaRecord[]> {
    const records = await prisma.deaRecord.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return records.map(record => this.mapToDeaRecord(record));
  }

  async findAllPaginated(page: number, limit: number): Promise<DeaRecord[]> {
    const skip = (page - 1) * limit;
    const records = await prisma.deaRecord.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' }
    });
    return records.map(record => this.mapToDeaRecord(record));
  }

  async findAllVerifiedAndCompleted(): Promise<DeaRecord[]> {
    const records = await prisma.deaRecord.findMany({
      where: {
        verificationSessions: {
          some: {
            status: VerificationStatus.VERIFIED
          }
        }
      },
      include: {
        verificationSessions: {
          where: {
            status: VerificationStatus.VERIFIED
          },
          orderBy: {
            completedAt: 'desc'
          },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Map records and include processed image URLs from verification sessions
    return records.map(record => {
      const mappedRecord = this.mapToDeaRecord(record);
      const completedSession = record.verificationSessions?.[0];
      
      if (completedSession) {
        // Override foto1 and foto2 with processed images if available
        // If second image was discarded (secondProcessedImageUrl is null/empty), don't show it
        return {
          ...mappedRecord,
          foto1: completedSession.processedImageUrl || mappedRecord.foto1,
          foto2: completedSession.secondProcessedImageUrl || undefined
        };
      }
      
      return mappedRecord;
    });
  }

  async countAll(): Promise<number> {
    return await prisma.deaRecord.count();
  }

  async countVerifiedAndCompleted(): Promise<number> {
    return await prisma.deaRecord.count({
      where: {
        verificationSessions: {
          some: {
            status: VerificationStatus.VERIFIED
          }
        }
      }
    });
  }

  async findAllVerifiedAndCompletedPaginated(page: number, limit: number): Promise<{
    data: DeaRecord[];
    totalCount: number;
  }> {
    const skip = (page - 1) * limit;

    // Ejecutar ambas consultas en paralelo
    const [records, totalCount] = await Promise.all([
      prisma.deaRecord.findMany({
        where: {
          verificationSessions: {
            some: {
              status: VerificationStatus.VERIFIED
            }
          }
        },
        include: {
          verificationSessions: {
            where: {
              status: VerificationStatus.VERIFIED
            },
            orderBy: {
              completedAt: 'desc'
            },
            take: 1,
            select: {
              processedImageUrl: true,
              secondProcessedImageUrl: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.deaRecord.count({
        where: {
          verificationSessions: {
            some: {
              status: VerificationStatus.VERIFIED
            }
          }
        }
      })
    ]);

    // Map records and include processed image URLs from verification sessions
    const mappedRecords = records.map(record => {
      const mappedRecord = this.mapToDeaRecord(record);
      const completedSession = record.verificationSessions?.[0];
      
      if (completedSession) {
        // Override foto1 and foto2 with processed images if available
        return {
          ...mappedRecord,
          foto1: completedSession.processedImageUrl || mappedRecord.foto1,
          foto2: completedSession.secondProcessedImageUrl || undefined
        };
      }
      
      return mappedRecord;
    });

    return {
      data: mappedRecords,
      totalCount
    };
  }

  async findById(id: number): Promise<DeaRecord | null> {
    const record = await prisma.deaRecord.findUnique({
      where: { id }
    });
    return record ? this.mapToDeaRecord(record) : null;
  }

  async create(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord> {
    const record = await prisma.deaRecord.create({ 
      data: {
        ...data,
        horaInicio: new Date(data.horaInicio),
        horaFinalizacion: new Date(data.horaFinalizacion),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt)
      }
    });
    return this.mapToDeaRecord(record);
  }

  async update(id: number, data: Partial<DeaRecord>): Promise<DeaRecord> {
    const updateData: Record<string, unknown> = { ...data };
    if (data.horaInicio) updateData.horaInicio = new Date(data.horaInicio);
    if (data.horaFinalizacion) updateData.horaFinalizacion = new Date(data.horaFinalizacion);
    if (data.updatedAt) updateData.updatedAt = new Date(data.updatedAt);

    const record = await prisma.deaRecord.update({
      where: { id },
      data: updateData
    });
    return this.mapToDeaRecord(record);
  }

  async delete(id: number): Promise<DeaRecord> {
    const record = await prisma.deaRecord.delete({
      where: { id }
    });
    return this.mapToDeaRecord(record);
  }

  async findByProvisionalNumber(provisionalNumber: number): Promise<DeaRecord | null> {
    const record = await prisma.deaRecord.findFirst({
      where: { numeroProvisionalDea: provisionalNumber }
    });
    return record ? this.mapToDeaRecord(record) : null;
  }

  async findWithAddressValidation(id: number): Promise<DeaRecordWithValidation | null> {
    const record = await prisma.deaRecord.findUnique({
      where: { id },
      include: {
        addressValidation: true
      }
    });
    
    if (!record) return null;

    const mappedRecord = this.mapToDeaRecord(record);
    return {
      ...mappedRecord,
      addressValidation: record.addressValidation ? {
        id: record.addressValidation.id,
        deaRecordId: record.addressValidation.deaRecordId,
        searchResults: record.addressValidation.searchResults as Record<string, unknown>[],
        validationDetails: record.addressValidation.validationDetails as Record<string, unknown> | undefined,
        overallStatus: record.addressValidation.overallStatus,
        recommendedActions: record.addressValidation.recommendedActions as Record<string, unknown>[],
        processedAt: record.addressValidation.processedAt.toISOString(),
        processingDurationMs: record.addressValidation.processingDurationMs ?? undefined,
        searchStrategiesUsed: record.addressValidation.searchStrategiesUsed as Record<string, unknown>[],
        validationVersion: record.addressValidation.validationVersion,
        needsReprocessing: record.addressValidation.needsReprocessing,
        errorMessage: record.addressValidation.errorMessage ?? undefined,
        retryCount: record.addressValidation.retryCount,
        createdAt: record.addressValidation.createdAt.toISOString(),
        updatedAt: record.addressValidation.updatedAt.toISOString()
      } : undefined
    };
  }

  async findByProvisionalNumberWithAddressValidation(provisionalNumber: number): Promise<DeaRecordWithValidation | null> {
    const record = await prisma.deaRecord.findFirst({
      where: { numeroProvisionalDea: provisionalNumber },
      include: {
        addressValidation: true
      }
    });
    
    if (!record) return null;

    const mappedRecord = this.mapToDeaRecord(record);
    return {
      ...mappedRecord,
      addressValidation: record.addressValidation ? {
        id: record.addressValidation.id,
        deaRecordId: record.addressValidation.deaRecordId,
        searchResults: record.addressValidation.searchResults as Record<string, unknown>[],
        validationDetails: record.addressValidation.validationDetails as Record<string, unknown> | undefined,
        overallStatus: record.addressValidation.overallStatus,
        recommendedActions: record.addressValidation.recommendedActions as Record<string, unknown>[],
        processedAt: record.addressValidation.processedAt.toISOString(),
        processingDurationMs: record.addressValidation.processingDurationMs ?? undefined,
        searchStrategiesUsed: record.addressValidation.searchStrategiesUsed as Record<string, unknown>[],
        validationVersion: record.addressValidation.validationVersion,
        needsReprocessing: record.addressValidation.needsReprocessing,
        errorMessage: record.addressValidation.errorMessage ?? undefined,
        retryCount: record.addressValidation.retryCount,
        createdAt: record.addressValidation.createdAt.toISOString(),
        updatedAt: record.addressValidation.updatedAt.toISOString()
      } : undefined
    };
  }

  async findForVerificationWithFilters(
    page: number, 
    limit: number, 
    statusFilter?: string, 
    excludeCompletedIds?: number[]
  ): Promise<{
    data: DeaRecordWithValidation[];
    totalCount: number;
  }> {
    const skip = (page - 1) * limit;
    
    // Build the where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const whereClause: any = {
      // Only records with foto1
      AND: [
        { foto1: { not: null } },
        { foto1: { not: '' } }
      ]
    };

    // Exclude completed verification sessions
    if (excludeCompletedIds && excludeCompletedIds.length > 0) {
      whereClause.id = {
        notIn: excludeCompletedIds
      };
    }

    // Add status filter for image verification status
    if (statusFilter && statusFilter !== 'all') {
      switch (statusFilter) {
        case 'pending':
          // Incluir tanto pending como pre_verified (ambos están pendientes de verificación)
          whereClause.imageVerificationStatus = {
            in: ['pending', 'pre_verified']
          };
          break;
        case 'in_progress':
          whereClause.imageVerificationStatus = 'in_progress';
          break;
        case 'discarded':
          whereClause.imageVerificationStatus = 'discarded';
          break;
      }
    }

    // Execute both queries in parallel for better performance
    const [records, totalCount] = await Promise.all([
      prisma.deaRecord.findMany({
        where: whereClause,
        include: {
          addressValidation: true
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.deaRecord.count({
        where: whereClause
      })
    ]);

    // Map the results
    const mappedRecords: DeaRecordWithValidation[] = records.map(record => {
      const mappedRecord = this.mapToDeaRecord(record);
      return {
        ...mappedRecord,
        addressValidation: record.addressValidation ? {
          id: record.addressValidation.id,
          deaRecordId: record.addressValidation.deaRecordId,
          searchResults: record.addressValidation.searchResults as Record<string, unknown>[],
          validationDetails: record.addressValidation.validationDetails as Record<string, unknown> | undefined,
          overallStatus: record.addressValidation.overallStatus,
          recommendedActions: record.addressValidation.recommendedActions as Record<string, unknown>[],
          processedAt: record.addressValidation.processedAt.toISOString(),
          processingDurationMs: record.addressValidation.processingDurationMs ?? undefined,
          searchStrategiesUsed: record.addressValidation.searchStrategiesUsed as Record<string, unknown>[],
          validationVersion: record.addressValidation.validationVersion,
          needsReprocessing: record.addressValidation.needsReprocessing,
          errorMessage: record.addressValidation.errorMessage ?? undefined,
          retryCount: record.addressValidation.retryCount,
          createdAt: record.addressValidation.createdAt.toISOString(),
          updatedAt: record.addressValidation.updatedAt.toISOString()
        } : undefined
      };
    });

    return {
      data: mappedRecords,
      totalCount
    };
  }
}
