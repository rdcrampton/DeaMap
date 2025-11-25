/**
 * Value Object: DeaCode
 * Representa el código único de un DEA
 * Formato: DD-SSSS donde DD es el distrito (01-21) y SSSS es el secuencial
 */
export class DeaCode {
  private readonly distrito: number;
  private readonly secuencial: number;
  private readonly fullCode: string;

  private constructor(distrito: number, secuencial: number) {
    this.validateDistrito(distrito);
    this.validateSecuencial(secuencial);
    this.distrito = distrito;
    this.secuencial = secuencial;
    this.fullCode = this.generateCode();
  }

  private validateDistrito(distrito: number): void {
    if (!Number.isInteger(distrito) || distrito < 1 || distrito > 21) {
      throw new Error(
        `Distrito inválido: ${distrito}. Debe estar entre 1 y 21 (distritos de Madrid)`
      );
    }
  }

  private validateSecuencial(secuencial: number): void {
    if (!Number.isInteger(secuencial) || secuencial < 0) {
      throw new Error(
        `Secuencial inválido: ${secuencial}. Debe ser un entero no negativo`
      );
    }
  }

  private generateCode(): string {
    const distritoStr = this.distrito.toString().padStart(2, '0');
    return `${distritoStr}-${this.secuencial}`;
  }

  /**
   * Crea un DeaCode desde distrito y secuencial
   * @param distrito - Número de distrito (1-21)
   * @param secuencial - Número secuencial (0+)
   */
  static create(distrito: number, secuencial: number): DeaCode {
    return new DeaCode(distrito, secuencial);
  }

  /**
   * Crea un DeaCode desde un string con formato "DD-SSSS"
   * @param code - Código en formato string
   * @throws Error si el formato es inválido
   */
  static fromString(code: string): DeaCode {
    const parts = code.split('-');
    if (parts.length !== 2) {
      throw new Error(`Formato de código inválido: ${code}. Esperado: DD-SSSS`);
    }
    
    const distrito = parseInt(parts[0], 10);
    const secuencial = parseInt(parts[1], 10);
    
    if (isNaN(distrito) || isNaN(secuencial)) {
      throw new Error(`Código inválido: ${code}. Contiene valores no numéricos`);
    }
    
    return new DeaCode(distrito, secuencial);
  }

  /**
   * Retorna el número de distrito
   */
  getDistrito(): number {
    return this.distrito;
  }

  /**
   * Retorna el número secuencial
   */
  getSecuencial(): number {
    return this.secuencial;
  }

  /**
   * Retorna el código completo en formato string
   */
  toString(): string {
    return this.fullCode;
  }

  /**
   * Compara dos códigos por igualdad
   */
  equals(other: DeaCode): boolean {
    return this.fullCode === other.fullCode;
  }

  /**
   * Retorna un objeto plano con los componentes del código
   */
  toJSON(): { distrito: number; secuencial: number; codigo: string } {
    return {
      distrito: this.distrito,
      secuencial: this.secuencial,
      codigo: this.fullCode
    };
  }
}
