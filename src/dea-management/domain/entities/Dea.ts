/**
 * Agregado: Dea (Desfibrilador Externo Automático)
 * Encapsula las reglas de negocio del dominio de DEAs
 * Protege invariantes y expone métodos de intención
 */

import { DeaId } from '../value-objects/DeaId';
import { DeaCode } from '../value-objects/DeaCode';
import { Location } from '../value-objects/Location';
import { VerificationStatus } from '../value-objects/VerificationStatus';
import {
  InvalidVerificationTransitionError,
  InvalidDeaDataError,
  MissingRequiredDataError,
  InvalidOperationError
} from '../errors/DeaErrors';

/**
 * Propiedades esenciales de un DEA
 */
export interface DeaProps {
  id: DeaId;
  code: DeaCode | null;
  nombre: string;
  numeroProvisionalDea: number;
  tipoEstablecimiento: string;
  location: Location;
  distrito: string;
  codigoPostal: number;
  status: VerificationStatus;
  foto1?: string;
  foto2?: string;
  descripcionAcceso?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Datos necesarios para crear un nuevo DEA
 */
export interface CreateDeaData {
  nombre: string;
  numeroProvisionalDea: number;
  tipoEstablecimiento: string;
  location: Location;
  distrito: string;
  codigoPostal: number;
  descripcionAcceso?: string;
}

/**
 * Entidad Dea
 * Agregado raíz del contexto de gestión de DEAs
 */
export class Dea {
  private constructor(private props: DeaProps) {
    this.validateInvariants();
  }

  /**
   * Valida las invariantes del agregado
   * Se ejecuta en cada operación que modifica el estado
   */
  private validateInvariants(): void {
    if (!this.props.nombre || this.props.nombre.trim().length === 0) {
      throw new MissingRequiredDataError('nombre');
    }

    if (this.props.nombre.trim().length < 3) {
      throw new InvalidDeaDataError('nombre', 'debe tener al menos 3 caracteres');
    }

    if (!this.props.tipoEstablecimiento || this.props.tipoEstablecimiento.trim().length === 0) {
      throw new MissingRequiredDataError('tipoEstablecimiento');
    }

    if (this.props.numeroProvisionalDea <= 0) {
      throw new InvalidDeaDataError('numeroProvisionalDea', 'debe ser un número positivo');
    }

    if (this.props.codigoPostal < 10000 || this.props.codigoPostal > 99999) {
      throw new InvalidDeaDataError('codigoPostal', 'debe ser un código postal válido de 5 dígitos');
    }
  }

  /**
   * Factory method: Crea un nuevo DEA
   * @param data - Datos para crear el DEA
   * @returns Nueva instancia de Dea
   */
  static create(data: CreateDeaData): Dea {
    const now = new Date();
    
    return new Dea({
      id: DeaId.fromNumber(0), // Se asignará al persistir
      code: null, // Se generará después
      nombre: data.nombre.trim(),
      numeroProvisionalDea: data.numeroProvisionalDea,
      tipoEstablecimiento: data.tipoEstablecimiento.trim(),
      location: data.location,
      distrito: data.distrito,
      codigoPostal: data.codigoPostal,
      status: VerificationStatus.pending(),
      descripcionAcceso: data.descripcionAcceso?.trim(),
      createdAt: now,
      updatedAt: now
    });
  }

  /**
   * Factory method: Reconstituye un DEA desde persistencia
   * @param props - Propiedades del DEA persistido
   * @returns Instancia de Dea reconstituida
   */
  static reconstituteFromPersistence(props: DeaProps): Dea {
    return new Dea(props);
  }

  // ==================== Getters ====================

  getId(): DeaId {
    return this.props.id;
  }

  getCode(): DeaCode | null {
    return this.props.code;
  }

  getName(): string {
    return this.props.nombre;
  }

  getProvisionalNumber(): number {
    return this.props.numeroProvisionalDea;
  }

  getEstablishmentType(): string {
    return this.props.tipoEstablecimiento;
  }

  getLocation(): Location {
    return this.props.location;
  }

  getDistrito(): string {
    return this.props.distrito;
  }

  getPostalCode(): number {
    return this.props.codigoPostal;
  }

  getStatus(): VerificationStatus {
    return this.props.status;
  }

  getPhoto1(): string | undefined {
    return this.props.foto1;
  }

  getPhoto2(): string | undefined {
    return this.props.foto2;
  }

  getAccessDescription(): string | undefined {
    return this.props.descripcionAcceso;
  }

  getCreatedAt(): Date {
    return this.props.createdAt;
  }

  getUpdatedAt(): Date {
    return this.props.updatedAt;
  }

  // ==================== Métodos de Negocio ====================

  /**
   * Asigna un código definitivo al DEA
   * @param code - Código a asignar
   */
  assignCode(code: DeaCode): void {
    if (this.props.code !== null) {
      throw new InvalidOperationError(
        'assignCode',
        'El DEA ya tiene un código asignado'
      );
    }

    this.props.code = code;
    this.props.updatedAt = new Date();
  }

  /**
   * Inicia el proceso de verificación
   * Transiciona el estado a 'in_progress'
   */
  startVerification(): void {
    const newStatus = VerificationStatus.inProgress();
    
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new InvalidVerificationTransitionError(
        this.props.status.toString(),
        newStatus.toString()
      );
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  /**
   * Marca el DEA como verificado
   * Transiciona el estado a 'verified'
   */
  markAsVerified(): void {
    const newStatus = VerificationStatus.verified();
    
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new InvalidVerificationTransitionError(
        this.props.status.toString(),
        newStatus.toString()
      );
    }

    // Un DEA verificado debe tener al menos una foto
    if (!this.props.foto1) {
      throw new InvalidOperationError(
        'markAsVerified',
        'El DEA debe tener al menos una foto para ser verificado'
      );
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();
  }

  /**
   * Descarta el DEA
   * @param reason - Razón del descarte
   */
  discard(reason: string): void {
    if (!reason || reason.trim().length === 0) {
      throw new InvalidDeaDataError('reason', 'debe proporcionar una razón para descartar el DEA');
    }

    const newStatus = VerificationStatus.discarded();
    
    if (!this.props.status.canTransitionTo(newStatus)) {
      throw new InvalidVerificationTransitionError(
        this.props.status.toString(),
        newStatus.toString()
      );
    }

    this.props.status = newStatus;
    this.props.updatedAt = new Date();
    // Aquí podríamos emitir un evento de dominio: DeaDiscardedEvent
  }

  /**
   * Actualiza las fotos del DEA
   * @param foto1 - URL de la primera foto (requerida)
   * @param foto2 - URL de la segunda foto (opcional)
   */
  updatePhotos(foto1: string, foto2?: string): void {
    if (!foto1 || foto1.trim().length === 0) {
      throw new InvalidDeaDataError('foto1', 'la primera foto es requerida');
    }

    this.props.foto1 = foto1.trim();
    this.props.foto2 = foto2?.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Actualiza la descripción de acceso
   * @param description - Nueva descripción
   */
  updateAccessDescription(description: string): void {
    this.props.descripcionAcceso = description.trim();
    this.props.updatedAt = new Date();
  }

  /**
   * Actualiza la ubicación del DEA
   * @param newLocation - Nueva ubicación
   */
  updateLocation(newLocation: Location): void {
    this.props.location = newLocation;
    this.props.updatedAt = new Date();
  }

  /**
   * Verifica si el DEA está dentro de un radio dado respecto a una ubicación
   * @param location - Ubicación de referencia
   * @param radiusKm - Radio en kilómetros
   */
  isWithinRadius(location: Location, radiusKm: number): boolean {
    return this.props.location.isWithinRadius(location, radiusKm);
  }

  /**
   * Verifica si el DEA puede ser editado
   * Un DEA puede ser editado si no está verificado
   */
  canBeEdited(): boolean {
    return !this.props.status.isVerified();
  }

  /**
   * Verifica si el DEA puede ser eliminado
   * Un DEA puede ser eliminado si está pendiente o descartado
   */
  canBeDeleted(): boolean {
    return this.props.status.isPending() || this.props.status.isDiscarded();
  }

  /**
   * Verifica si el DEA tiene fotos
   */
  hasPhotos(): boolean {
    return !!this.props.foto1;
  }

  /**
   * Verifica si el DEA tiene código asignado
   */
  hasCode(): boolean {
    return this.props.code !== null;
  }

  // ==================== Utilidades ====================

  /**
   * Retorna una representación del DEA como objeto plano
   * Útil para serialización
   */
  toSnapshot(): DeaSnapshot {
    return {
      id: this.props.id.toNumber(),
      code: this.props.code?.toString() || null,
      nombre: this.props.nombre,
      numeroProvisionalDea: this.props.numeroProvisionalDea,
      tipoEstablecimiento: this.props.tipoEstablecimiento,
      location: this.props.location.toJSON(),
      distrito: this.props.distrito,
      codigoPostal: this.props.codigoPostal,
      status: this.props.status.toString(),
      foto1: this.props.foto1,
      foto2: this.props.foto2,
      descripcionAcceso: this.props.descripcionAcceso,
      createdAt: this.props.createdAt.toISOString(),
      updatedAt: this.props.updatedAt.toISOString()
    };
  }
}

/**
 * Snapshot (representación serializable) de un DEA
 */
export interface DeaSnapshot {
  id: number;
  code: string | null;
  nombre: string;
  numeroProvisionalDea: number;
  tipoEstablecimiento: string;
  location: { latitude: number; longitude: number };
  distrito: string;
  codigoPostal: number;
  status: string;
  foto1?: string;
  foto2?: string;
  descripcionAcceso?: string;
  createdAt: string;
  updatedAt: string;
}
