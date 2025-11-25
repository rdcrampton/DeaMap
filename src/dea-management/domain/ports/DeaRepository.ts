/**
 * Puerto (Interface): DeaRepository
 * Define el contrato que debe cumplir cualquier implementación de repositorio de DEAs
 * Esta interfaz vive en el dominio y es independiente de la tecnología de persistencia
 */

import { Dea } from '../entities/Dea';
import { DeaId } from '../value-objects/DeaId';
import { DeaCode } from '../value-objects/DeaCode';
import { VerificationStatus } from '../value-objects/VerificationStatus';

/**
 * Opciones para búsquedas y filtros
 */
export interface FindOptions {
  page?: number;
  limit?: number;
  status?: VerificationStatus;
  orderBy?: 'createdAt' | 'code' | 'name';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Resultado paginado de búsquedas
 */
export interface FindResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Repositorio de DEAs
 * Puerto que define las operaciones de persistencia necesarias
 */
export interface DeaRepository {
  /**
   * Busca un DEA por su ID
   * @param id - ID del DEA
   * @returns DEA encontrado o null si no existe
   */
  findById(id: DeaId): Promise<Dea | null>;

  /**
   * Busca un DEA por su código único
   * @param code - Código del DEA
   * @returns DEA encontrado o null si no existe
   */
  findByCode(code: DeaCode): Promise<Dea | null>;

  /**
   * Busca un DEA por su número provisional
   * @param provisionalNumber - Número provisional
   * @returns DEA encontrado o null si no existe
   */
  findByProvisionalNumber(provisionalNumber: number): Promise<Dea | null>;

  /**
   * Busca todos los DEAs con opciones de paginación y filtrado
   * @param options - Opciones de búsqueda
   * @returns Resultado paginado con DEAs
   */
  findAll(options?: FindOptions): Promise<FindResult<Dea>>;

  /**
   * Busca DEAs por distrito
   * @param distrito - Número de distrito (1-21)
   * @param options - Opciones de búsqueda
   * @returns Resultado paginado con DEAs
   */
  findByDistrito(distrito: number, options?: FindOptions): Promise<FindResult<Dea>>;

  /**
   * Busca DEAs por estado de verificación
   * @param status - Estado de verificación
   * @param options - Opciones de búsqueda
   * @returns Resultado paginado con DEAs
   */
  findByStatus(status: VerificationStatus, options?: FindOptions): Promise<FindResult<Dea>>;

  /**
   * Guarda un DEA (crear o actualizar)
   * @param dea - DEA a guardar
   * @returns void
   */
  save(dea: Dea): Promise<void>;

  /**
   * Elimina un DEA
   * @param id - ID del DEA a eliminar
   * @returns void
   */
  delete(id: DeaId): Promise<void>;

  /**
   * Cuenta el total de DEAs
   * @returns Número total de DEAs
   */
  count(): Promise<number>;

  /**
   * Cuenta DEAs por estado de verificación
   * @param status - Estado de verificación
   * @returns Número de DEAs en ese estado
   */
  countByStatus(status: VerificationStatus): Promise<number>;

  /**
   * Verifica si existe un DEA con el código dado
   * @param code - Código a verificar
   * @returns true si existe, false si no
   */
  existsByCode(code: DeaCode): Promise<boolean>;

  /**
   * Obtiene el siguiente número secuencial disponible para un distrito
   * @param distrito - Número de distrito
   * @returns Siguiente número secuencial
   */
  getNextSecuencialForDistrito(distrito: number): Promise<number>;
}
