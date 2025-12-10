/**
 * Caso de uso: Generar exportación de AEDs a CSV
 * Application Layer
 */

import { createHash } from "crypto";

import { PrismaClient } from "@/generated/client/client";

import { IExportRepository } from "@/domain/export/ports/IExportRepository";
import { aedsToCsv, aedsToImportFormatCsv, generateExportFilename } from "@/lib/csv-export";
import { uploadToS3 } from "@/lib/s3";

interface GenerateExportParams {
  batchId: string;
  format?: "legacy" | "import_format"; // legacy: formato anterior, import_format: formato de importación
}

interface AedForExport {
  id?: string | null;
  sequence?: number | null;
  provisional_number?: number | null;
  code?: string | null;
  external_reference?: string | null;
  establishment_type?: string | null;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates_precision?: string | null;
  internal_notes?: string | null;
  origin_observations?: string | null;
  public_notes?: string | null;
  validation_notes?: string | null;
  validation_observations?: string | null;
  status?: string | null;
  requires_attention?: boolean | null;
  attention_reason?: string | null;
  published_at?: Date | null;
  location?: {
    street_type?: string | null;
    street_name?: string | null;
    street_number?: string | null;
    additional_info?: string | null;
    postal_code?: string | null;
    city_name?: string | null;
    city_code?: string | null;
    district_name?: string | null;
    neighborhood_name?: string | null;
    floor?: string | null;
    specific_location?: string | null;
    // Campos consolidados nuevos
    access_instructions?: string | null;
    public_notes?: string | null;
    // Campos deprecados
    access_description?: string | null;
    visible_references?: string | null;
    access_warnings?: string | null;
    location_observations?: string | null;
  } | null;
  schedule?: {
    description?: string | null;
    has_24h_surveillance: boolean;
    has_restricted_access?: boolean | null;
    weekday_opening?: string | null;
    weekday_closing?: string | null;
    saturday_opening?: string | null;
    saturday_closing?: string | null;
    sunday_opening?: string | null;
    sunday_closing?: string | null;
    holidays_as_weekday?: boolean | null;
    closed_on_holidays?: boolean | null;
    closed_in_august?: boolean | null;
    schedule_exceptions?: string | null;
  } | null;
  responsible?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    alternative_phone?: string | null;
    organization?: string | null;
    position?: string | null;
    department?: string | null;
    observations?: string | null;
    notes?: string | null;
    ownership?: string | null;
    local_ownership?: string | null;
    local_use?: string | null;
  } | null;
  images?: Array<{
    url?: string | null;
    order?: number | null;
  }>;
}

export class GenerateExportUseCase {
  constructor(
    private readonly exportRepository: IExportRepository,
    private readonly prisma: PrismaClient
  ) {}

  async execute(params: GenerateExportParams): Promise<void> {
    const { batchId, format = "import_format" } = params;

    try {
      // 1. Obtener información del batch
      const batch = await this.exportRepository.getBatchInfo(batchId);
      if (!batch) {
        throw new Error(`Export batch ${batchId} not found`);
      }

      // 2. Marcar como en progreso
      await this.exportRepository.updateBatch(batchId, {
        status: "IN_PROGRESS",
        startedAt: new Date(),
      });

      const startTime = Date.now();

      // 3. Construir query con filtros
      const filters = batch.filters || {};
      const where: any = {};

      if (filters.status && filters.status.length > 0) {
        where.status = { in: filters.status };
      }

      if (filters.sourceOrigin) {
        where.source_origin = filters.sourceOrigin;
      }

      if (filters.importBatchId) {
        where.import_batch_id = filters.importBatchId;
      }

      if (filters.cityName) {
        where.location = {
          city_name: {
            contains: filters.cityName,
            mode: "insensitive",
          },
        };
      }

      // 4. Consultar AEDs con TODOS los campos necesarios
      const aeds = await this.prisma.aed.findMany({
        where,
        include: {
          location: true,
          schedule: true,
          responsible: true,
          images: {
            orderBy: {
              order: "asc",
            },
          },
        },
        orderBy: [{ code: "asc" }, { created_at: "desc" }],
      });

      // 5. Convertir a formato para export
      const aedsForExport: AedForExport[] = aeds.map((aed) => ({
        id: aed.id,
        sequence: aed.sequence,
        provisional_number: aed.provisional_number,
        code: aed.code,
        external_reference: aed.external_reference,
        establishment_type: aed.establishment_type,
        name: aed.name,
        latitude: aed.latitude,
        longitude: aed.longitude,
        coordinates_precision: aed.coordinates_precision,
        internal_notes: aed.internal_notes,
        origin_observations: aed.origin_observations,
        public_notes: aed.public_notes,
        validation_notes: aed.validation_notes,
        validation_observations: aed.validation_observations,
        status: aed.status,
        requires_attention: aed.requires_attention,
        attention_reason: aed.attention_reason,
        published_at: aed.published_at,
        location: aed.location
          ? {
              street_type: aed.location.street_type,
              street_name: aed.location.street_name,
              street_number: aed.location.street_number,
              additional_info: aed.location.additional_info,
              postal_code: aed.location.postal_code,
              city_name: aed.location.city_name,
              city_code: aed.location.city_code,
              district_name: aed.location.district_name,
              neighborhood_name: aed.location.neighborhood_name,
              floor: aed.location.floor,
              specific_location: aed.location.specific_location,
              access_instructions: aed.location.access_instructions,
              public_notes: aed.location.public_notes,
              access_description: aed.location.access_description,
              visible_references: aed.location.visible_references,
              access_warnings: aed.location.access_warnings,
              location_observations: aed.location.location_observations,
            }
          : null,
        schedule: aed.schedule
          ? {
              description: aed.schedule.description,
              has_24h_surveillance: aed.schedule.has_24h_surveillance,
              has_restricted_access: aed.schedule.has_restricted_access,
              weekday_opening: aed.schedule.weekday_opening,
              weekday_closing: aed.schedule.weekday_closing,
              saturday_opening: aed.schedule.saturday_opening,
              saturday_closing: aed.schedule.saturday_closing,
              sunday_opening: aed.schedule.sunday_opening,
              sunday_closing: aed.schedule.sunday_closing,
              holidays_as_weekday: aed.schedule.holidays_as_weekday,
              closed_on_holidays: aed.schedule.closed_on_holidays,
              closed_in_august: aed.schedule.closed_in_august,
              schedule_exceptions: aed.schedule.schedule_exceptions,
            }
          : null,
        responsible: aed.responsible
          ? {
              name: aed.responsible.name,
              email: aed.responsible.email,
              phone: aed.responsible.phone,
              alternative_phone: aed.responsible.alternative_phone,
              organization: aed.responsible.organization,
              position: aed.responsible.position,
              department: aed.responsible.department,
              observations: aed.responsible.observations,
              notes: aed.responsible.notes,
              ownership: aed.responsible.ownership,
              local_ownership: aed.responsible.local_ownership,
              local_use: aed.responsible.local_use,
            }
          : null,
        images: aed.images.map((img) => ({
          url: img.original_url,
          order: img.order,
        })),
      }));

      // 6. Generar CSV según el formato elegido
      const csvContent =
        format === "import_format"
          ? aedsToImportFormatCsv(aedsForExport)
          : aedsToCsv(aedsForExport as any);
      const csvBuffer = Buffer.from("\uFEFF" + csvContent, "utf-8"); // BOM + content

      // 7. Calcular hash del archivo
      const fileHash = createHash("sha256").update(csvBuffer).digest("hex");

      // 8. Generar nombre de archivo
      const fileName = generateExportFilename(filters);

      // 9. Subir a S3
      const fileUrl = await uploadToS3({
        buffer: csvBuffer,
        filename: fileName,
        contentType: "text/csv;charset=utf-8",
        prefix: "exports",
      });

      const endTime = Date.now();
      const durationSeconds = Math.floor((endTime - startTime) / 1000);

      // 10. Actualizar batch con éxito
      await this.exportRepository.updateBatch(batchId, {
        status: "COMPLETED",
        fileName,
        fileUrl,
        fileSize: csvBuffer.length,
        fileHash,
        totalRecords: aeds.length,
        successfulRecords: aeds.length,
        failedRecords: 0,
        completedAt: new Date(),
        durationSeconds,
      });
    } catch (error) {
      // Marcar como fallido
      await this.exportRepository.updateBatch(batchId, {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
        errorDetails: {
          error: error instanceof Error ? error.stack : String(error),
          timestamp: new Date().toISOString(),
        },
        completedAt: new Date(),
      });

      throw error;
    }
  }
}
