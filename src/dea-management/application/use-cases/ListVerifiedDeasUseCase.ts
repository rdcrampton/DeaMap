/**
 * Caso de Uso: ListVerifiedDeasUseCase
 * Lista los DEAs verificados con paginación
 * Orquesta la consulta de DEAs verificados
 */

import { DeaRepository } from '../../domain/ports/DeaRepository';
import { VerificationStatus } from '../../domain/value-objects/VerificationStatus';
import { DeaListDto, DeaDtoMapper } from '../dto/DeaDto';

/**
 * Query para listar DEAs verificados
 */
export interface ListVerifiedDeasQuery {
  page?: number;
  pageSize?: number;
}

/**
 * Caso de uso para listar DEAs verificados
 * Retorna solo los DEAs que han completado el proceso de verificación
 */
export class ListVerifiedDeasUseCase {
  constructor(private readonly repository: DeaRepository) {}

  /**
   * Ejecuta el caso de uso
   * @param query - Query con parámetros de paginación
   * @returns DTO con lista paginada de DEAs verificados
   */
  async execute(query: ListVerifiedDeasQuery = {}): Promise<DeaListDto> {
    // 1. Validar y establecer valores por defecto
    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 50));

    // 2. Obtener DEAs verificados del repositorio
    const result = await this.repository.findByStatus(
      VerificationStatus.verified(),
      {
        page,
        limit: pageSize,
        orderBy: 'createdAt',
        orderDirection: 'desc'
      }
    );

    // 3. Convertir a DTO y retornar
    return DeaDtoMapper.toListDto(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      totalCount: result.totalCount,
      totalPages: result.totalPages
    });
  }
}
