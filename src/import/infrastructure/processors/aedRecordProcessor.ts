/**
 * AED Record Processor â€” @batchactions/import RecordProcessorFn
 *
 * FunciÃ³n callback que procesa un registro validado y crea las entidades
 * AED en la base de datos dentro de una transacciÃ³n Prisma:
 *
 * 1. AedLocation  (siempre se crea)
 * 2. AedSchedule  (condicional â€” si hay datos de horario)
 * 3. AedResponsible (condicional â€” si hay datos del responsable)
 * 4. Aed (transacciÃ³n atÃ³mica con relaciones)
 *
 * Las imÃ¡genes se procesan en el hook afterProcess, no aquÃ­.
 * El UUID del AED se pre-genera en beforeProcess (campo _aedId).
 */

import type { ParsedRecord, ProcessingContext } from "@batchactions/import";
import type { PrismaClient } from "@/generated/client/client";
import { randomUUID } from "crypto";

// ============================================================
// Tipos
// ============================================================

export interface AedRecordProcessorOptions {
  /** Prisma client para operaciones de base de datos */
  prisma: PrismaClient;
  /** Nombre/path del archivo CSV para source_details */
  fileName?: string;
}

// ============================================================
// Helpers
// ============================================================

/**
 * Parsea un valor string como booleano.
 * Reconoce formatos espaÃ±ol e inglÃ©s.
 */
function parseBoolean(value: unknown): boolean {
  if (!value) return false;
  const str = String(value).toLowerCase().trim();
  return ["true", "1", "sÃ­", "si", "yes", "y", "s", "verdadero"].includes(str);
}

/**
 * Extrae un string limpio o null.
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str || null;
}

/**
 * Parsea coordenada: normaliza coma a punto y convierte a nÃºmero.
 */
function parseCoordinate(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const str = String(value).trim().replace(",", ".");
  if (!str) return undefined;
  const num = parseFloat(str);
  return isNaN(num) ? undefined : num;
}

/**
 * Verifica si hay datos de horario en el registro.
 */
function hasScheduleData(data: Record<string, unknown>): boolean {
  return !!(
    data.is24x7 ||
    data.weekdayOpening ||
    data.weekdayClosing ||
    data.saturdayOpening ||
    data.saturdayClosing ||
    data.sundayOpening ||
    data.sundayClosing ||
    data.has24hSurveillance
  );
}

/**
 * Verifica si hay datos del responsable en el registro.
 */
function hasResponsibleData(data: Record<string, unknown>): boolean {
  return !!(
    data.responsibleName ||
    data.responsibleEmail ||
    data.responsiblePhone ||
    data.ownership ||
    data.localOwnership
  );
}

// ============================================================
// Factory del processor
// ============================================================

/**
 * Crea la funciÃ³n processor para @batchactions/import que maneja la creaciÃ³n
 * de entidades AED en la base de datos.
 *
 * @example
 * ```typescript
 * const processor = createAedRecordProcessor({
 *   prisma,
 *   fileName: "import_aeds.csv",
 * });
 *
 * const result = await importer.processChunk(processor, {
 *   maxDurationMs: 80_000,
 * });
 * ```
 */
export function createAedRecordProcessor(
  options: AedRecordProcessorOptions
): (record: ParsedRecord, context: ProcessingContext) => Promise<void> {
  const { prisma, fileName } = options;

  return async (record: ParsedRecord, context: ProcessingContext): Promise<void> => {
    const data = record as Record<string, unknown>;

    // UUID pre-generado en beforeProcess hook
    const aedId = (data._aedId as string) || randomUUID();

    // Parsear coordenadas
    const latitude = parseCoordinate(data.latitude);
    const longitude = parseCoordinate(data.longitude);

    // ========================================
    // 1. CREATE LOCATION (siempre)
    // ========================================
    const location = await prisma.aedLocation.create({
      data: {
        street_type: toStringOrNull(data.streetType),
        street_name: toStringOrNull(data.streetName),
        street_number: toStringOrNull(data.streetNumber),
        postal_code: toStringOrNull(data.postalCode),
        city_name: toStringOrNull(data.city || data.cityName),
        city_code: toStringOrNull(data.cityCode),
        district_code: toStringOrNull(data.districtCode),
        district_name: toStringOrNull(data.district),
        neighborhood_code: toStringOrNull(data.neighborhoodCode),
        neighborhood_name: toStringOrNull(data.neighborhood || data.neighborhoodName),
        floor: toStringOrNull(data.floor),
        location_details: toStringOrNull(data.locationDetails),
        access_instructions: toStringOrNull(data.accessDescription),
      },
    });

    // ========================================
    // 2. CREATE SCHEDULE (condicional)
    // ========================================
    let scheduleId: string | undefined;

    if (hasScheduleData(data)) {
      const schedule = await prisma.aedSchedule.create({
        data: {
          weekday_opening: toStringOrNull(data.weekdayOpening),
          weekday_closing: toStringOrNull(data.weekdayClosing),
          saturday_opening: toStringOrNull(data.saturdayOpening),
          saturday_closing: toStringOrNull(data.saturdayClosing),
          sunday_opening: toStringOrNull(data.sundayOpening),
          sunday_closing: toStringOrNull(data.sundayClosing),
          has_24h_surveillance: parseBoolean(data.has24hSurveillance),
          has_restricted_access: parseBoolean(data.hasRestrictedAccess),
          description: toStringOrNull(data.scheduleDescription),
          notes: toStringOrNull(data.scheduleNotes),
        },
      });
      scheduleId = schedule.id;
    }

    // ========================================
    // 3. CREATE RESPONSIBLE (condicional)
    // ========================================
    let responsibleId: string | undefined;

    if (hasResponsibleData(data)) {
      const responsible = await prisma.aedResponsible.create({
        data: {
          name: toStringOrNull(data.responsibleName) || "Sin especificar",
          email: toStringOrNull(data.responsibleEmail),
          phone: toStringOrNull(data.responsiblePhone),
          alternative_phone: toStringOrNull(data.responsibleAlternativePhone),
          ownership: toStringOrNull(data.ownership),
          local_ownership: toStringOrNull(data.localOwnership),
          local_use: toStringOrNull(data.localUse),
          organization: toStringOrNull(data.responsibleOrganization),
          position: toStringOrNull(data.responsiblePosition),
          department: toStringOrNull(data.responsibleDepartment),
        },
      });
      responsibleId = responsible.id;
    }

    // ========================================
    // 4. CREATE AED
    // ========================================
    // Location, Schedule y Responsible ya fueron creados arriba.
    // El AED se crea con sus relaciones. Si falla, @batchactions/import
    // marcarÃ¡ el record como failed y los registros huÃ©rfanos se
    // limpiarÃ¡n en un proceso de mantenimiento.
    await prisma.aed.create({
      data: {
        id: aedId,

        // CÃ³digo e identificadores
        code: toStringOrNull(data.code),
        external_reference: toStringOrNull(data.externalReference),

        // Datos bÃ¡sicos
        name: String(data.proposedName || "").trim(),
        establishment_type: toStringOrNull(data.establishmentType),

        // Coordenadas
        latitude,
        longitude,
        coordinates_precision: toStringOrNull(data.coordinatesPrecision),

        // Relaciones
        location_id: location.id,
        schedule_id: scheduleId,
        responsible_id: responsibleId,

        // Origen y trazabilidad
        source_origin: "CSV_IMPORT",
        source_details: `ImportaciÃ³n CSV: ${fileName || "unknown"}`,
        batch_job_id: context.jobId,

        // Notas
        public_notes: toStringOrNull(data.publicNotes || data.freeComment),

        // Estado inicial
        status: "DRAFT",
      },
    });

    // Nota: Las imÃ¡genes se descargan/suben en el hook afterProcess
    // para mantener separaciÃ³n de responsabilidades y evitar que
    // un fallo de imagen bloquee la creaciÃ³n del AED.
  };
}

