/**
 * Implementación del repositorio de importación con Prisma
 * Capa de Infraestructura
 */

import { PrismaClient } from "@/generated/client/client";

import {
  IImportRepository,
  CreateImportBatchData,
  ImportBatchInfo,
  CreateAedFromCsvData,
  ImportErrorData,
} from "@/domain/import/ports/IImportRepository";
import type { ImportRecord } from "@/domain/import/value-objects/ImportRecord";

export class PrismaImportRepository implements IImportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBatch(data: CreateImportBatchData): Promise<string> {
    const batch = await this.prisma.importBatch.create({
      data: {
        name: data.name,
        description: data.description,
        source_origin: data.sourceOrigin as any,
        file_name: data.fileName,
        total_records: data.totalRecords,
        imported_by: data.importedBy,
        status: "PENDING",
        data_source_id: data.dataSourceId,
      },
    });

    return batch.id;
  }

  async updateBatchStatus(
    batchId: string,
    status: string,
    stats?: {
      totalRecords?: number;
      successfulRecords?: number;
      failedRecords?: number;
      completedAt?: Date;
    }
  ): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: status as any,
        total_records: stats?.totalRecords,
        successful_records: stats?.successfulRecords,
        failed_records: stats?.failedRecords,
        completed_at: stats?.completedAt,
      },
    });
  }

  async getBatchInfo(batchId: string): Promise<ImportBatchInfo | null> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return null;
    }

    return {
      id: batch.id,
      name: batch.name,
      status: batch.status,
      totalRecords: batch.total_records,
      successfulRecords: batch.successful_records,
      failedRecords: batch.failed_records,
      createdAt: batch.created_at,
      completedAt: batch.completed_at,
    };
  }

  async createAedFromCsv(data: CreateAedFromCsvData): Promise<string> {
    const {
      csvRow,
      batchId,
      latitude,
      longitude,
      addressValidationFailed,
      imageUrls,
      requiresAttention,
      attentionReason,
    } = data;

    // Crear el AED con todas sus relaciones en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear o buscar responsible
      let responsible = await tx.aedResponsible.findFirst({
        where: {
          email: csvRow.submitterEmail || undefined,
        },
      });

      if (!responsible) {
        responsible = await tx.aedResponsible.create({
          data: {
            name: csvRow.submitterName || "Sin nombre",
            email: csvRow.submitterEmail || null,
            ownership: csvRow.ownership || null,
            local_ownership: csvRow.localOwnership || null,
            local_use: csvRow.localUse || null,
          },
        });
      }

      // 2. Crear location con soporte multi-ciudad
      const location = await tx.aedLocation.create({
        data: {
          street_type: csvRow.streetType || undefined,
          street_name: csvRow.streetName || undefined,
          street_number: csvRow.streetNumber || undefined,
          additional_info: csvRow.additionalInfo || undefined,
          postal_code: csvRow.postalCode || undefined,
          latitude: latitude ?? undefined,
          longitude: longitude ?? undefined,
          // Multi-ciudad: Por ahora solo guardamos el distrito como texto
          // TODO: Cuando el CSV tenga más campos, agregar getters a CsvRow para:
          // cityName, cityCode, districtCode, districtName, neighborhoodCode, neighborhoodName
          district_name: csvRow.district || undefined,
          access_description: csvRow.accessDescription || undefined,
        },
      });

      // 3. Crear schedule
      const schedule = await tx.aedSchedule.create({
        data: {
          description: csvRow.scheduleDescription || undefined,
          has_24h_surveillance: csvRow.has24hSurveillance,
          weekday_opening: csvRow.weekdayOpening || undefined,
          weekday_closing: csvRow.weekdayClosing || undefined,
          saturday_opening: csvRow.saturdayOpening || undefined,
          saturday_closing: csvRow.saturdayClosing || undefined,
          sunday_opening: csvRow.sundayOpening || undefined,
          sunday_closing: csvRow.sundayClosing || undefined,
        },
      });

      // 4. Crear AED
      const aedData: any = {
        name: csvRow.name || "Sin nombre",
        provisional_number: csvRow.provisionalNumber
          ? parseInt(csvRow.provisionalNumber)
          : undefined,
        establishment_type: csvRow.establishmentType || undefined,
        status: "DRAFT",
        publication_mode: "LOCATION_ONLY", // ← Default publication mode for imports
        source_origin: "CSV_IMPORT",
        import_batch_id: batchId,
        external_reference: csvRow.id,
        location_id: location.id,
        responsible_id: responsible.id,
        schedule_id: schedule.id,
        // Marcar si requiere atención (posible duplicado o validación fallida)
        requires_attention: requiresAttention || addressValidationFailed || true,
        attention_reason:
          attentionReason || // Prioridad 1: mensaje de posible duplicado
          (addressValidationFailed ? "Imported - Address validation failed" : null) || // Prioridad 2: validación fallida
          "Imported - Pending verification", // Prioridad 3: default
        origin_observations: JSON.stringify(csvRow.toJSON()),
      };

      if (latitude !== null) aedData.latitude = latitude;
      if (longitude !== null) aedData.longitude = longitude;

      const aed = await tx.aed.create({ data: aedData });

      // 5. Crear imágenes si existen
      if (imageUrls.length > 0) {
        await tx.aedImage.createMany({
          data: imageUrls.map((img, index) => ({
            aed_id: aed.id,
            type: img.type as any,
            order: index + 1,
            original_url: img.url,
            is_verified: false,
          })),
        });
      }

      return aed.id;
    });

    return result;
  }

  async logImportError(error: ImportErrorData): Promise<void> {
    await this.prisma.importError.create({
      data: {
        import_batch_id: error.batchId,
        row_number: error.rowNumber,
        error_type: error.errorType as any,
        error_message: error.errorMessage,
        severity: error.severity as any,
        row_data: error.rowData ? (error.rowData as any) : undefined,
      },
    });
  }

  // ============================================
  // MÉTODOS PARA SYNC CON FUENTES EXTERNAS
  // ============================================

  async findAedByExternalReference(
    externalRef: string
  ): Promise<{ id: string; contentHash?: string | null } | null> {
    const aed = await this.prisma.aed.findFirst({
      where: {
        external_reference: externalRef,
      },
      select: {
        id: true,
        sync_content_hash: true,
      },
    });

    if (!aed) return null;

    return {
      id: aed.id,
      contentHash: aed.sync_content_hash,
    };
  }

  async updateAedFields(aedId: string, fields: Record<string, unknown>): Promise<void> {
    // Mapear campos del dominio a campos de la base de datos
    const dbFields: Record<string, unknown> = {};

    // Campos del AED principal
    if (fields.name !== undefined) dbFields.name = fields.name;
    if (fields.establishmentType !== undefined)
      dbFields.establishment_type = fields.establishmentType;
    if (fields.latitude !== undefined) dbFields.latitude = fields.latitude;
    if (fields.longitude !== undefined) dbFields.longitude = fields.longitude;

    // Actualizar AED
    if (Object.keys(dbFields).length > 0) {
      await this.prisma.aed.update({
        where: { id: aedId },
        data: {
          ...dbFields,
          updated_at: new Date(),
        },
      });
    }

    // Si hay campos de location, actualizar location
    const locationFields: Record<string, unknown> = {};
    if (fields.streetType !== undefined) locationFields.street_type = fields.streetType;
    if (fields.streetName !== undefined) locationFields.street_name = fields.streetName;
    if (fields.streetNumber !== undefined) locationFields.street_number = fields.streetNumber;
    if (fields.postalCode !== undefined) locationFields.postal_code = fields.postalCode;
    if (fields.floor !== undefined) locationFields.floor = fields.floor;
    if (fields.specificLocation !== undefined)
      locationFields.specific_location = fields.specificLocation;
    if (fields.city !== undefined) locationFields.city_name = fields.city;
    if (fields.cityCode !== undefined) locationFields.city_code = fields.cityCode;

    if (Object.keys(locationFields).length > 0) {
      const aed = await this.prisma.aed.findUnique({
        where: { id: aedId },
        select: { location_id: true },
      });

      if (aed?.location_id) {
        await this.prisma.aedLocation.update({
          where: { id: aed.location_id },
          data: locationFields,
        });
      }
    }
  }

  async updateAedContentHash(aedId: string, hash: string): Promise<void> {
    await this.prisma.aed.update({
      where: { id: aedId },
      data: {
        sync_content_hash: hash,
        last_synced_at: new Date(),
      },
    });
  }

  async deactivateAed(aedId: string, reason: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Actualizar estado del AED
      await tx.aed.update({
        where: { id: aedId },
        data: {
          status: "INACTIVE",
          internal_notes: reason,
          updated_at: new Date(),
        },
      });

      // Registrar cambio de estado
      await tx.aedStatusChange.create({
        data: {
          aed_id: aedId,
          previous_status: "PUBLISHED", // Asumimos que estaba publicado
          new_status: "INACTIVE",
          reason: reason,
        },
      });
    });
  }

  async getExternalReferencesForDataSource(dataSourceId: string): Promise<string[]> {
    const aeds = await this.prisma.aed.findMany({
      where: {
        data_source_id: dataSourceId,
        external_reference: { not: null },
      },
      select: {
        external_reference: true,
      },
    });

    return aeds.map((aed) => aed.external_reference).filter((ref): ref is string => ref !== null);
  }

  async updateAedLastSyncedAt(aedId: string, syncedAt: Date): Promise<void> {
    await this.prisma.aed.update({
      where: { id: aedId },
      data: {
        last_synced_at: syncedAt,
      },
    });
  }

  async createAedFromImportRecord(record: ImportRecord, dataSourceId: string): Promise<string> {
    // Crear el AED con todas sus relaciones en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Crear location
      const location = await tx.aedLocation.create({
        data: {
          street_type: record.streetType ?? undefined,
          street_name: record.streetName ?? undefined,
          street_number: record.streetNumber ?? undefined,
          additional_info: record.additionalInfo ?? undefined,
          postal_code: record.postalCode ?? undefined,
          floor: record.floor ?? undefined,
          specific_location: record.specificLocation ?? undefined,
          city_name: record.city ?? undefined,
          city_code: record.cityCode ?? undefined,
          district_name: record.district ?? undefined,
          latitude: record.latitude ?? undefined,
          longitude: record.longitude ?? undefined,
          access_description: record.accessDescription ?? undefined,
        },
      });

      // 2. Crear schedule (si hay datos de horario)
      const hasScheduleData =
        record.scheduleDescription || record.accessSchedule || record.weekdayOpening;

      let scheduleId: string | undefined;
      if (hasScheduleData) {
        const schedule = await tx.aedSchedule.create({
          data: {
            description: record.scheduleDescription || record.accessSchedule || undefined,
            weekday_opening: record.weekdayOpening ?? undefined,
            weekday_closing: record.weekdayClosing ?? undefined,
            saturday_opening: record.saturdayOpening ?? undefined,
            saturday_closing: record.saturdayClosing ?? undefined,
            sunday_opening: record.sundayOpening ?? undefined,
            sunday_closing: record.sundayClosing ?? undefined,
          },
        });
        scheduleId = schedule.id;
      }

      // 3. Crear AED
      const name = record.name || `DEA ${record.externalId || record.rowIndex}`;

      const aed = await tx.aed.create({
        data: {
          name,
          establishment_type: record.establishmentType ?? undefined,
          status: "DRAFT",
          publication_mode: "LOCATION_ONLY",
          source_origin: "EXTERNAL_API",
          external_reference: record.externalId,
          latitude: record.latitude ?? undefined,
          longitude: record.longitude ?? undefined,
          location_id: location.id,
          schedule_id: scheduleId,
          data_source_id: dataSourceId,
          sync_content_hash: record.contentHash,
          last_synced_at: new Date(),
          requires_attention: true,
          attention_reason: "Imported from external API - Pending verification",
          origin_observations: JSON.stringify(record.toJSON()),
        },
      });

      return aed.id;
    });

    return result;
  }
}
