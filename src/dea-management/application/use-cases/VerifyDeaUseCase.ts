/**
 * Caso de Uso: VerifyDeaUseCase
 * Verifica un DEA aplicando las reglas de negocio del dominio
 * Orquesta el proceso completo de verificación
 */

import { DeaRepository } from '../../domain/ports/DeaRepository';
import { DeaId } from '../../domain/value-objects/DeaId';
import { DeaNotFoundError } from '../../domain/errors/DeaErrors';
import { DeaDto, DeaDtoMapper } from '../dto/DeaDto';

/**
 * Comando para verificar un DEA
 */
export interface VerifyDeaCommand {
  deaId: number;
  photo1Url: string;
  photo2Url?: string;
  verifiedBy?: string;
}

/**
 * Caso de uso para verificar un DEA
 * Aplica el flujo completo: startVerification -> updatePhotos -> markAsVerified
 */
export class VerifyDeaUseCase {
  constructor(private readonly repository: DeaRepository) {}

  /**
   * Ejecuta el caso de uso de verificación
   * @param command - Comando con datos de verificación
   * @returns DTO del DEA verificado
   * @throws DeaNotFoundError si el DEA no existe
   * @throws InvalidVerificationTransitionError si la transición no es válida
   * @throws InvalidOperationError si faltan datos requeridos
   */
  async execute(command: VerifyDeaCommand): Promise<DeaDto> {
    // 1. Validar entrada
    this.validateCommand(command);

    // 2. Obtener DEA del repositorio
    const dea = await this.repository.findById(
      DeaId.fromNumber(command.deaId)
    );

    if (!dea) {
      throw new DeaNotFoundError(command.deaId);
    }

    // 3. Aplicar lógica de dominio
    // La entidad Dea protege sus invariantes y valida las transiciones
    dea.startVerification();
    dea.updatePhotos(command.photo1Url, command.photo2Url);
    dea.markAsVerified();

    // 4. Persistir cambios
    await this.repository.save(dea);

    // 5. Retornar DTO
    return DeaDtoMapper.toDto(dea);
  }

  /**
   * Valida el comando de entrada
   */
  private validateCommand(command: VerifyDeaCommand): void {
    if (!command.deaId || command.deaId <= 0) {
      throw new Error('ID de DEA inválido');
    }

    if (!command.photo1Url || command.photo1Url.trim().length === 0) {
      throw new Error('URL de la primera foto es requerida');
    }

    // Validar formato básico de URL
    try {
      new URL(command.photo1Url);
      if (command.photo2Url) {
        new URL(command.photo2Url);
      }
    } catch {
      throw new Error('URL de foto inválida');
    }
  }
}
