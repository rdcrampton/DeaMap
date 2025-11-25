/**
 * Tests Unitarios: DeaCode
 * Demuestran cómo testear Value Objects sin dependencias externas
 */

import { DeaCode } from '../../../src/dea-management/domain/value-objects/DeaCode';

describe('DeaCode Value Object', () => {
  describe('create', () => {
    it('debe crear un código válido', () => {
      const code = DeaCode.create(1, 42);
      
      expect(code.getDistrito()).toBe(1);
      expect(code.getSecuencial()).toBe(42);
      expect(code.toString()).toBe('01-42');
    });

    it('debe formatear correctamente el distrito con ceros a la izquierda', () => {
      const code = DeaCode.create(5, 123);
      
      expect(code.toString()).toBe('05-123');
    });

    it('debe rechazar distrito menor a 1', () => {
      expect(() => DeaCode.create(0, 10)).toThrow('Distrito inválido: 0');
    });

    it('debe rechazar distrito mayor a 21', () => {
      expect(() => DeaCode.create(22, 10)).toThrow('Distrito inválido: 22');
    });

    it('debe rechazar secuencial negativo', () => {
      expect(() => DeaCode.create(1, -1)).toThrow('Secuencial inválido');
    });

    it('debe rechazar distrito no entero', () => {
      expect(() => DeaCode.create(1.5, 10)).toThrow('Distrito inválido');
    });
  });

  describe('fromString', () => {
    it('debe parsear un código válido', () => {
      const code = DeaCode.fromString('01-42');
      
      expect(code.getDistrito()).toBe(1);
      expect(code.getSecuencial()).toBe(42);
      expect(code.toString()).toBe('01-42');
    });

    it('debe rechazar formato sin guión', () => {
      expect(() => DeaCode.fromString('0142')).toThrow('Formato de código inválido');
    });

    it('debe rechazar formato con múltiples guiones', () => {
      expect(() => DeaCode.fromString('01-42-extra')).toThrow('Formato de código inválido');
    });

    it('debe rechazar valores no numéricos', () => {
      expect(() => DeaCode.fromString('AB-CD')).toThrow('Código inválido');
    });
  });

  describe('equals', () => {
    it('debe considerar iguales códigos con mismos valores', () => {
      const code1 = DeaCode.create(1, 42);
      const code2 = DeaCode.create(1, 42);
      
      expect(code1.equals(code2)).toBe(true);
    });

    it('debe considerar diferentes códigos con distintos valores', () => {
      const code1 = DeaCode.create(1, 42);
      const code2 = DeaCode.create(1, 43);
      
      expect(code1.equals(code2)).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('debe retornar objeto con todos los componentes', () => {
      const code = DeaCode.create(5, 123);
      const json = code.toJSON();
      
      expect(json).toEqual({
        distrito: 5,
        secuencial: 123,
        codigo: '05-123'
      });
    });
  });
});
