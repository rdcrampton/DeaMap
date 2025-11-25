/**
 * Caso de Uso: GetDeaByIdUseCase
 * Obtiene un DEA por su ID
 * Orquesta la lógica de aplicación sin mezclar con infraestructura
 */

import { DeaRepository } from '../../domain/ports/DeaRepository';
import { DeaId } from '../../domain/value-objects/DeaId';
import { DeaNotFoundError } from '../../domain/errors/DeaErrors';
import { DeaDto, DeaDtoMapper } from '../dto/DeaDto';

/**
 * Comando de entrada para obtener un DEA
 */
export interface GetDeaByIdCommand {
  deaId: number;
}

/**
 * Caso de uso para obtener un DEA por ID
 */
export class GetDeaByIdUseCase {
  constructor(private readonly repository: DeaRepository) {}

  /**
   * Ejecuta el caso de uso
   * @param command - Comando con el ID del DEA
   * @returns DTO con los datos del DEA
   * @throws DeaNotFoundError si el DEA no existe
   */
  async execute(command: GetDeaByIdCommand): Promise<DeaDto> {
    // 1. Validar entrada
    if (!command.deaId || command.deaId <= 0) {
      throw new Error('ID de DEA inválido');
    }

    // 2. Obtener DEA del repositorio
    const dea = await this.repository.findById(
      DeaId.fromNumber(command.deaId)
    );

    // 3. Validar existencia
    if (!dea) {
      throw new DeaNotFoundError(command.deaId);
    }

    // 4. Convertir a DTO y retornar
    return DeaDtoMapper.toDto(dea);
  }
}
