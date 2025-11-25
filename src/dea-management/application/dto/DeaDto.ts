/**
 * DTO: DeaDto
 * Data Transfer Object para transferir datos de DEA entre capas
 * Desacopla la representación del dominio de las respuestas HTTP
 */

import { Dea } from '../../domain/entities/Dea';

/**
 * DTO de respuesta para un DEA
 */
export interface DeaDto {
  id: number;
  code: string | null;
  nombre: string;
  numeroProvisional: number;
  tipoEstablecimiento: string;
  ubicacion: {
    latitud: number;
    longitud: number;
  };
  distrito: string;
  codigoPostal: number;
  estado: string;
  estadoLegible: string;
  fotos: {
    foto1?: string;
    foto2?: string;
  };
  descripcionAcceso?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * DTO para listado paginado de DEAs
 */
export interface DeaListDto {
  data: DeaDto[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Mapper para convertir entidades de dominio a DTOs
 */
export class DeaDtoMapper {
  /**
   * Convierte una entidad Dea del dominio a un DTO
   */
  static toDto(dea: Dea): DeaDto {
    const snapshot = dea.toSnapshot();
    
    return {
      id: snapshot.id,
      code: snapshot.code,
      nombre: snapshot.nombre,
      numeroProvisional: snapshot.numeroProvisionalDea,
      tipoEstablecimiento: snapshot.tipoEstablecimiento,
      ubicacion: {
        latitud: snapshot.location.latitude,
        longitud: snapshot.location.longitude
      },
      distrito: snapshot.distrito,
      codigoPostal: snapshot.codigoPostal,
      estado: snapshot.status,
      estadoLegible: this.getEstadoLegible(snapshot.status),
      fotos: {
        foto1: snapshot.foto1,
        foto2: snapshot.foto2
      },
      descripcionAcceso: snapshot.descripcionAcceso,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt
    };
  }

  /**
   * Convierte un array de entidades a DTOs
   */
  static toDtoList(deas: Dea[]): DeaDto[] {
    return deas.map(dea => this.toDto(dea));
  }

  /**
   * Convierte un resultado paginado a DTO de listado
   */
  static toListDto(
    deas: Dea[],
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    }
  ): DeaListDto {
    return {
      data: this.toDtoList(deas),
      pagination: {
        ...pagination,
        hasNextPage: pagination.page < pagination.totalPages,
        hasPreviousPage: pagination.page > 1
      }
    };
  }

  /**
   * Convierte el estado del dominio a texto legible
   */
  private static getEstadoLegible(estado: string): string {
    const estados: Record<string, string> = {
      'pending': 'Pendiente',
      'pre_verified': 'Pre-verificado',
      'in_progress': 'En Progreso',
      'verified': 'Verificado',
      'discarded': 'Descartado'
    };
    return estados[estado] || estado;
  }
}
