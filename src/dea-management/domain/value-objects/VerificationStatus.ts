/**
 * Value Object: VerificationStatus
 * Representa el estado de verificación de un DEA
 * Incluye lógica de transiciones válidas entre estados
 */
export type VerificationStatusValue = 
  | 'pending' 
  | 'pre_verified'
  | 'in_progress' 
  | 'verified'
  | 'discarded';

export class VerificationStatus {
  private constructor(private readonly value: VerificationStatusValue) {}

  /**
   * Estado inicial: Pendiente de verificación
   */
  static pending(): VerificationStatus {
    return new VerificationStatus('pending');
  }

  /**
   * Pre-verificado: Ha pasado validaciones automáticas
   */
  static preVerified(): VerificationStatus {
    return new VerificationStatus('pre_verified');
  }

  /**
   * En proceso de verificación manual
   */
  static inProgress(): VerificationStatus {
    return new VerificationStatus('in_progress');
  }

  /**
   * Verificado completamente
   */
  static verified(): VerificationStatus {
    return new VerificationStatus('verified');
  }

  /**
   * Descartado/Rechazado
   */
  static discarded(): VerificationStatus {
    return new VerificationStatus('discarded');
  }

  /**
   * Crea un VerificationStatus desde un string
   * @throws Error si el valor no es válido
   */
  static fromString(value: string): VerificationStatus {
    const validStatuses: VerificationStatusValue[] = [
      'pending', 'pre_verified', 'in_progress', 'verified', 'discarded'
    ];
    
    if (!validStatuses.includes(value as VerificationStatusValue)) {
      throw new Error(
        `Estado de verificación inválido: ${value}. ` +
        `Valores válidos: ${validStatuses.join(', ')}`
      );
    }
    
    return new VerificationStatus(value as VerificationStatusValue);
  }

  /**
   * Verifica si el estado es pendiente (incluyendo pre-verificado)
   */
  isPending(): boolean {
    return this.value === 'pending' || this.value === 'pre_verified';
  }

  /**
   * Verifica si está en progreso
   */
  isInProgress(): boolean {
    return this.value === 'in_progress';
  }

  /**
   * Verifica si está completado (verificado o descartado)
   */
  isCompleted(): boolean {
    return this.value === 'verified' || this.value === 'discarded';
  }

  /**
   * Verifica si está verificado exitosamente
   */
  isVerified(): boolean {
    return this.value === 'verified';
  }

  /**
   * Verifica si fue descartado
   */
  isDiscarded(): boolean {
    return this.value === 'discarded';
  }

  /**
   * Verifica si se puede transicionar a un nuevo estado
   * Implementa la máquina de estados del proceso de verificación
   * @param newStatus - Estado objetivo
   */
  canTransitionTo(newStatus: VerificationStatus): boolean {
    // Definir transiciones válidas según reglas de negocio
    const transitions: Record<VerificationStatusValue, VerificationStatusValue[]> = {
      pending: ['in_progress', 'pre_verified', 'discarded'],
      pre_verified: ['in_progress', 'discarded'],
      in_progress: ['verified', 'discarded', 'pending'], // Puede volver a pending si hay errores
      verified: ['pending'], // Puede reabrirse si se detectan problemas
      discarded: ['pending'] // Puede reactivarse
    };

    return transitions[this.value].includes(newStatus.value);
  }

  /**
   * Retorna el valor string del estado
   */
  toString(): string {
    return this.value;
  }

  /**
   * Retorna el valor raw del estado
   */
  getValue(): VerificationStatusValue {
    return this.value;
  }

  /**
   * Compara dos estados por igualdad
   */
  equals(other: VerificationStatus): boolean {
    return this.value === other.value;
  }

  /**
   * Retorna una representación legible del estado
   */
  toDisplayString(): string {
    const displayNames: Record<VerificationStatusValue, string> = {
      pending: 'Pendiente',
      pre_verified: 'Pre-verificado',
      in_progress: 'En Progreso',
      verified: 'Verificado',
      discarded: 'Descartado'
    };
    return displayNames[this.value];
  }
}
