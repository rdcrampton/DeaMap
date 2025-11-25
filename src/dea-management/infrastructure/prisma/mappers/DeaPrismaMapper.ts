/**
 * Mapper: DeaPrismaMapper
 * Convierte entre modelos de Prisma y entidades de dominio
 * Mantiene el dominio independiente de la infraestructura
 */

import { Dea, DeaProps } from '../../../../dea-management/domain/entities/Dea';
import { DeaId } from '../../../../dea-management/domain/value-objects/DeaId';
import { DeaCode } from '../../../../dea-management/domain/value-objects/DeaCode';
import { Location } from '../../../../dea-management/domain/value-objects/Location';
import { VerificationStatus } from '../../../../dea-management/domain/value-objects/VerificationStatus';

/**
 * Tipo del modelo Prisma DeaRecord
 * (importado desde el cliente generado)
 */
type PrismaDeaRecord = {
  id: number;
  horaInicio: Date;
  horaFinalizacion: Date;
  correoElectronico: string;
  nombre: string;
  numeroProvisionalDea: number;
  tipoEstablecimiento: string;
  titularidadLocal: string;
  usoLocal: string;
  titularidad: string;
  propuestaDenominacion: string;
  tipoVia: string;
  nombreVia: string;
  numeroVia: string | null;
  complementoDireccion: string | null;
  codigoPostal: number;
  distrito: string;
  latitud: number;
  longitud: number;
  horarioApertura: string;
  aperturaLunesViernes: number;
  cierreLunesViernes: number;
  aperturaSabados: number;
  cierreSabados: number;
  aperturaDomingos: number;
  cierreDomingos: number;
  vigilante24h: string;
  foto1: string | null;
  foto2: string | null;
  descripcionAcceso: string | null;
  comentarioLibre: string | null;
  gmTipoVia: string | null;
  gmNombreVia: string | null;
  gmNumero: string | null;
  gmCp: string | null;
  gmDistrito: string | null;
  gmLat: number | null;
  gmLon: number | null;
  defTipoVia: string | null;
  defNombreVia: string | null;
  defNumero: string | null;
  defCp: string | null;
  defDistrito: string | null;
  defLat: number | null;
  defLon: number | null;
  defCodDea: string | null;
  gmBarrio: string | null;
  defBarrio: string | null;
  imageVerificationStatus: string;
  addressValidationStatus: string;
  createdAt: Date;
  updatedAt: Date;
};

export class DeaPrismaMapper {
  /**
   * Convierte un modelo de Prisma a una entidad de dominio
   * @param prismaRecord - Registro de Prisma
   * @returns Entidad Dea del dominio
   */
  toDomain(prismaRecord: PrismaDeaRecord): Dea {
    const props: DeaProps = {
      id: DeaId.fromNumber(prismaRecord.id),
      code: prismaRecord.defCodDea 
        ? DeaCode.fromString(prismaRecord.defCodDea) 
        : null,
      nombre: prismaRecord.nombre,
      numeroProvisionalDea: prismaRecord.numeroProvisionalDea,
      tipoEstablecimiento: prismaRecord.tipoEstablecimiento,
      location: Location.fromCoordinates(
        prismaRecord.latitud,
        prismaRecord.longitud
      ),
      distrito: prismaRecord.distrito,
      codigoPostal: prismaRecord.codigoPostal,
      status: VerificationStatus.fromString(
        prismaRecord.imageVerificationStatus || 'pending'
      ),
      foto1: prismaRecord.foto1 ?? undefined,
      foto2: prismaRecord.foto2 ?? undefined,
      descripcionAcceso: prismaRecord.descripcionAcceso ?? undefined,
      createdAt: prismaRecord.createdAt,
      updatedAt: prismaRecord.updatedAt
    };

    return Dea.reconstituteFromPersistence(props);
  }

  /**
   * Convierte una entidad de dominio a datos para Prisma
   * @param dea - Entidad de dominio
   * @returns Objeto con datos para Prisma (sin ID si es nuevo)
   */
  toPrismaData(dea: Dea): Partial<PrismaDeaRecord> {
    const snapshot = dea.toSnapshot();
    
    return {
      nombre: snapshot.nombre,
      numeroProvisionalDea: snapshot.numeroProvisionalDea,
      tipoEstablecimiento: snapshot.tipoEstablecimiento,
      latitud: snapshot.location.latitude,
      longitud: snapshot.location.longitude,
      distrito: snapshot.distrito,
      codigoPostal: snapshot.codigoPostal,
      imageVerificationStatus: snapshot.status,
      defCodDea: snapshot.code,
      foto1: snapshot.foto1 ?? null,
      foto2: snapshot.foto2 ?? null,
      descripcionAcceso: snapshot.descripcionAcceso ?? null,
      updatedAt: new Date(snapshot.updatedAt)
    };
  }

  /**
   * Convierte una entidad de dominio a un registro completo de Prisma
   * para operaciones de creación
   * @param dea - Entidad de dominio
   * @returns Objeto completo para crear en Prisma
   */
  toPrismaCreateData(dea: Dea): Omit<PrismaDeaRecord, 'id'> {
    const snapshot = dea.toSnapshot();
    
    // Datos esenciales del dominio
    const essentialData = this.toPrismaData(dea);
    
    // Campos requeridos por el schema de Prisma con valores por defecto
    // TODO: Estos campos deberían eventualmente ser parte del dominio
    const defaultFields = {
      horaInicio: new Date(),
      horaFinalizacion: new Date(),
      correoElectronico: '',
      titularidadLocal: '',
      usoLocal: '',
      titularidad: '',
      propuestaDenominacion: '',
      tipoVia: '',
      nombreVia: '',
      numeroVia: null,
      complementoDireccion: null,
      horarioApertura: '',
      aperturaLunesViernes: 0,
      cierreLunesViernes: 0,
      aperturaSabados: 0,
      cierreSabados: 0,
      aperturaDomingos: 0,
      cierreDomingos: 0,
      vigilante24h: '',
      comentarioLibre: null,
      gmTipoVia: null,
      gmNombreVia: null,
      gmNumero: null,
      gmCp: null,
      gmDistrito: null,
      gmLat: null,
      gmLon: null,
      defTipoVia: null,
      defNombreVia: null,
      defNumero: null,
      defCp: null,
      defDistrito: null,
      defLat: null,
      defLon: null,
      gmBarrio: null,
      defBarrio: null,
      createdAt: new Date(snapshot.createdAt)
    };

    return {
      ...defaultFields,
      ...essentialData
    } as Omit<PrismaDeaRecord, 'id'>;
  }
}
