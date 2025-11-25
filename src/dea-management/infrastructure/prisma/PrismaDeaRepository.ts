/**
 * Adapter: PrismaDeaRepository
 * Implementa el puerto DeaRepository usando Prisma como tecnología de persistencia
 * Mantiene el dominio independiente de la infraestructura
 */

import { DeaRepository, FindOptions, FindResult } from '../../domain/ports/DeaRepository';
import { Dea } from '../../domain/entities/Dea';
import { DeaId } from '../../domain/value-objects/DeaId';
import { DeaCode } from '../../domain/value-objects/DeaCode';
import { VerificationStatus } from '../../domain/value-objects/VerificationStatus';
import { DeaPrismaMapper } from './mappers/DeaPrismaMapper';
import { prisma } from '@/lib/db';

/**
 * Repositorio de DEAs implementado con Prisma
 * Cumple el contrato definido por el puerto DeaRepository
 */
export class PrismaDeaRepository implements DeaRepository {
  private mapper: DeaPrismaMapper;

  constructor() {
    this.mapper = new DeaPrismaMapper();
  }

  /**
   * Busca un DEA por su ID
   */
  async findById(id: DeaId): Promise<Dea | null> {
    const record = await prisma.deaRecord.findUnique({
      where: { id: id.toNumber() }
    });
    
    return record ? this.mapper.toDomain(record) : null;
  }

  /**
   * Busca un DEA por su código único
   */
  async findByCode(code: DeaCode): Promise<Dea | null> {
    const record = await prisma.deaRecord.findFirst({
      where: { defCodDea: code.toString() }
    });
    
    return record ? this.mapper.toDomain(record) : null;
  }

  /**
   * Busca un DEA por su número provisional
   */
  async findByProvisionalNumber(provisionalNumber: number): Promise<Dea | null> {
    const record = await prisma.deaRecord.findFirst({
      where: { numeroProvisionalDea: provisionalNumber }
    });
    
    return record ? this.mapper.toDomain(record) : null;
  }

  /**
   * Busca todos los DEAs con opciones de paginación y filtrado
   */
  async findAll(options?: FindOptions): Promise<FindResult<Dea>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    // Construir cláusula WHERE
    const where = this.buildWhereClause(options);

    // Ejecutar queries en paralelo para mejor performance
    const [records, totalCount] = await Promise.all([
      prisma.deaRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildOrderBy(options)
      }),
      prisma.deaRecord.count({ where })
    ]);

    return {
      data: records.map(r => this.mapper.toDomain(r)),
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Busca DEAs por distrito
   */
  async findByDistrito(distrito: number, options?: FindOptions): Promise<FindResult<Dea>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      ...this.buildWhereClause(options),
      distrito: distrito.toString()
    };

    const [records, totalCount] = await Promise.all([
      prisma.deaRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildOrderBy(options)
      }),
      prisma.deaRecord.count({ where })
    ]);

    return {
      data: records.map(r => this.mapper.toDomain(r)),
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  /**
   * Busca DEAs por estado de verificación
   */
  async findByStatus(status: VerificationStatus, options?: FindOptions): Promise<FindResult<Dea>> {
    return this.findAll({
      ...options,
      status
    });
  }

  /**
   * Guarda un DEA (crear o actualizar)
   */
  async save(dea: Dea): Promise<void> {
    const id = dea.getId().toNumber();
    
    if (id === 0) {
      // Crear nuevo DEA
      const createData = this.mapper.toPrismaCreateData(dea);
      await prisma.deaRecord.create({ 
        data: createData 
      });
    } else {
      // Actualizar DEA existente
      const updateData = this.mapper.toPrismaData(dea);
      await prisma.deaRecord.update({
        where: { id },
        data: updateData
      });
    }
  }

  /**
   * Elimina un DEA
   */
  async delete(id: DeaId): Promise<void> {
    await prisma.deaRecord.delete({
      where: { id: id.toNumber() }
    });
  }

  /**
   * Cuenta el total de DEAs
   */
  async count(): Promise<number> {
    return await prisma.deaRecord.count();
  }

  /**
   * Cuenta DEAs por estado de verificación
   */
  async countByStatus(status: VerificationStatus): Promise<number> {
    return await prisma.deaRecord.count({
      where: { imageVerificationStatus: status.toString() }
    });
  }

  /**
   * Verifica si existe un DEA con el código dado
   */
  async existsByCode(code: DeaCode): Promise<boolean> {
    const count = await prisma.deaRecord.count({
      where: { defCodDea: code.toString() }
    });
    return count > 0;
  }

  /**
   * Obtiene el siguiente número secuencial disponible para un distrito
   */
  async getNextSecuencialForDistrito(distrito: number): Promise<number> {
    const lastCode = await prisma.deaCode.findFirst({
      where: { distrito },
      orderBy: { secuencial: 'desc' }
    });
    
    return lastCode ? lastCode.secuencial + 1 : 1;
  }

  // ==================== Métodos Privados de Ayuda ====================

  /**
   * Construye la cláusula WHERE para queries de Prisma
   */
  private buildWhereClause(options?: FindOptions): Record<string, unknown> {
    const where: Record<string, unknown> = {};
    
    if (options?.status) {
      where.imageVerificationStatus = options.status.toString();
    }
    
    return where;
  }

  /**
   * Construye la cláusula ORDER BY para queries de Prisma
   */
  private buildOrderBy(options?: FindOptions): Record<string, string> {
    const orderBy = options?.orderBy ?? 'createdAt';
    const direction = options?.orderDirection ?? 'desc';
    
    return { [orderBy]: direction };
  }
}
