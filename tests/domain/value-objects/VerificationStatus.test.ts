/**
 * Tests Unitarios: VerificationStatus
 * Demuestran cómo testear transiciones de estado y lógica de negocio
 */

import { VerificationStatus } from '../../../src/dea-management/domain/value-objects/VerificationStatus';

describe('VerificationStatus Value Object', () => {
  describe('factory methods', () => {
    it('debe crear estado pending', () => {
      const status = VerificationStatus.pending();
      
      expect(status.toString()).toBe('pending');
      expect(status.isPending()).toBe(true);
    });

    it('debe crear estado pre_verified', () => {
      const status = VerificationStatus.preVerified();
      
      expect(status.toString()).toBe('pre_verified');
      expect(status.isPending()).toBe(true); // Pre-verified también es "pendiente"
    });

    it('debe crear estado in_progress', () => {
      const status = VerificationStatus.inProgress();
      
      expect(status.toString()).toBe('in_progress');
      expect(status.isInProgress()).toBe(true);
    });

    it('debe crear estado verified', () => {
      const status = VerificationStatus.verified();
      
      expect(status.toString()).toBe('verified');
      expect(status.isVerified()).toBe(true);
      expect(status.isCompleted()).toBe(true);
    });

    it('debe crear estado discarded', () => {
      const status = VerificationStatus.discarded();
      
      expect(status.toString()).toBe('discarded');
      expect(status.isDiscarded()).toBe(true);
      expect(status.isCompleted()).toBe(true);
    });
  });

  describe('fromString', () => {
    it('debe parsear estados válidos', () => {
      expect(VerificationStatus.fromString('pending').isPending()).toBe(true);
      expect(VerificationStatus.fromString('verified').isVerified()).toBe(true);
    });

    it('debe rechazar estado inválido', () => {
      expect(() => VerificationStatus.fromString('invalid')).toThrow(
        'Estado de verificación inválido'
      );
    });
  });

  describe('canTransitionTo - Transiciones válidas', () => {
    it('pending puede transicionar a in_progress', () => {
      const status = VerificationStatus.pending();
      const newStatus = VerificationStatus.inProgress();
      
      expect(status.canTransitionTo(newStatus)).toBe(true);
    });

    it('pending puede transicionar a pre_verified', () => {
      const status = VerificationStatus.pending();
      const newStatus = VerificationStatus.preVerified();
      
      expect(status.canTransitionTo(newStatus)).toBe(true);
    });

    it('in_progress puede transicionar a verified', () => {
      const status = VerificationStatus.inProgress();
      const newStatus = VerificationStatus.verified();
      
      expect(status.canTransitionTo(newStatus)).toBe(true);
    });

    it('in_progress puede transicionar a discarded', () => {
      const status = VerificationStatus.inProgress();
      const newStatus = VerificationStatus.discarded();
      
      expect(status.canTransitionTo(newStatus)).toBe(true);
    });

    it('discarded puede volver a pending (reactivación)', () => {
      const status = VerificationStatus.discarded();
      const newStatus = VerificationStatus.pending();
      
      expect(status.canTransitionTo(newStatus)).toBe(true);
    });
  });

  describe('canTransitionTo - Transiciones inválidas', () => {
    it('pending no puede transicionar directamente a verified', () => {
      const status = VerificationStatus.pending();
      const newStatus = VerificationStatus.verified();
      
      expect(status.canTransitionTo(newStatus)).toBe(false);
    });

    it('verified no puede transicionar a in_progress', () => {
      const status = VerificationStatus.verified();
      const newStatus = VerificationStatus.inProgress();
      
      expect(status.canTransitionTo(newStatus)).toBe(false);
    });

    it('verified no puede transicionar a discarded', () => {
      const status = VerificationStatus.verified();
      const newStatus = VerificationStatus.discarded();
      
      expect(status.canTransitionTo(newStatus)).toBe(false);
    });
  });

  describe('equals', () => {
    it('debe considerar iguales estados del mismo tipo', () => {
      const status1 = VerificationStatus.pending();
      const status2 = VerificationStatus.pending();
      
      expect(status1.equals(status2)).toBe(true);
    });

    it('debe considerar diferentes estados de distinto tipo', () => {
      const status1 = VerificationStatus.pending();
      const status2 = VerificationStatus.verified();
      
      expect(status1.equals(status2)).toBe(false);
    });
  });

  describe('toDisplayString', () => {
    it('debe retornar nombre legible en español', () => {
      expect(VerificationStatus.pending().toDisplayString()).toBe('Pendiente');
      expect(VerificationStatus.verified().toDisplayString()).toBe('Verificado');
      expect(VerificationStatus.discarded().toDisplayString()).toBe('Descartado');
    });
  });
});
