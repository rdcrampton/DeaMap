/**
 * Value Object: DeaId
 * Representa el identificador único de un DEA
 * Encapsula validación y comportamiento relacionado con IDs
 */
export class DeaId {
  private readonly value: number;

  private constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error('DEA ID debe ser un entero positivo');
    }
    this.value = value;
  }

  /**
   * Crea un DeaId desde un número
   */
  static fromNumber(value: number): DeaId {
    return new DeaId(value);
  }

  /**
   * Crea un DeaId desde un string
   * @throws Error si el string no representa un número válido
   */
  static fromString(value: string): DeaId {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`ID inválido: ${value}`);
    }
    return new DeaId(num);
  }

  /**
   * Retorna el valor numérico del ID
   */
  toNumber(): number {
    return this.value;
  }

  /**
   * Compara dos IDs por igualdad
   */
  equals(other: DeaId): boolean {
    return this.value === other.value;
  }

  /**
   * Representación en string del ID
   */
  toString(): string {
    return this.value.toString();
  }
}
