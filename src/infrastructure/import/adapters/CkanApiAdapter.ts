/**
 * Adapter: API CKAN (datos.comunidad.madrid)
 * Capa de Infraestructura - Implementa IDataSourceAdapter para APIs CKAN
 */

import type {
  IDataSourceAdapter,
  DataSourceConfig,
  ConnectionTestResult,
} from "@/domain/import/ports/IDataSourceAdapter";
import { ImportRecord } from "@/domain/import/value-objects/ImportRecord";
import {
  ValidationResult,
  type ValidationIssue,
} from "@/domain/import/value-objects/ValidationResult";

/**
 * Respuesta de la API CKAN
 */
interface CkanResponse {
  success: boolean;
  result: {
    records: Record<string, unknown>[];
    total: number;
    fields?: Array<{ id: string; type: string }>;
    _links?: {
      start: string;
      next?: string;
    };
  };
  error?: {
    message: string;
    __type: string;
  };
}

/**
 * Mapeo predefinido de campos para la API de Madrid
 */
export const MADRID_FIELD_MAPPINGS: Record<string, string> = {
  codigo_dea: "id",
  direccion_via_codigo: "streetType",
  direccion_via_nombre: "streetName",
  direccion_portal_numero: "streetNumber",
  direccion_piso: "floor",
  direccion_puerta: "additionalInfo",
  direccion_ubicacion: "specificLocation",
  direccion_codigo_postal: "postalCode",
  direccion_latitud: "latitude",
  direccion_longitud: "longitude",
  direccion_coordenada_x: "utmX",
  direccion_coordenada_y: "utmY",
  municipio_codigo: "cityCode",
  municipio_nombre: "city",
  tipo_establecimiento: "establishmentType",
  tipo_titularidad: "ownershipType",
  horario_acceso: "accessSchedule",
};

export class CkanApiAdapter implements IDataSourceAdapter {
  readonly type = "CKAN_API" as const;

  private readonly defaultPageSize = 100;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  async *fetchRecords(config: DataSourceConfig): AsyncGenerator<ImportRecord> {
    this.validateCkanConfig(config);

    const baseUrl = config.baseUrl!;
    const resourceId = config.resourceId!;
    const pageSize = config.pageSize || this.defaultPageSize;
    const fieldMappings = config.fieldMappings || MADRID_FIELD_MAPPINGS;

    let offset = 0;
    let rowIndex = 0;
    let hasMore = true;

    while (hasMore) {
      const url = this.buildSearchUrl(baseUrl, resourceId, pageSize, offset);
      const response = await this.fetchWithRetry(url);

      if (!response.success) {
        throw new Error(`CKAN API error: ${response.error?.message || "Unknown error"}`);
      }

      const records = response.result.records;

      for (const record of records) {
        yield ImportRecord.fromApiRecord(
          record,
          fieldMappings,
          rowIndex,
          "codigo_dea" // Campo de ID externo para Madrid
        );
        rowIndex++;
      }

      // Verificar si hay más páginas
      hasMore = records.length >= pageSize;
      offset += pageSize;

      // Log de progreso cada 1000 registros
      if (rowIndex % 1000 === 0) {
        console.log(`📥 Fetched ${rowIndex} records from CKAN API...`);
      }
    }

    console.log(`✅ Finished fetching ${rowIndex} records from CKAN API`);
  }

  async getRecordCount(config: DataSourceConfig): Promise<number> {
    this.validateCkanConfig(config);

    const url = this.buildSearchUrl(config.baseUrl!, config.resourceId!, 0, 0);
    const response = await this.fetchWithRetry(url);

    if (!response.success) {
      throw new Error(`CKAN API error: ${response.error?.message || "Unknown error"}`);
    }

    return response.result.total;
  }

  async validateConfig(config: DataSourceConfig): Promise<ValidationResult> {
    const issues: ValidationIssue[] = [];

    if (!config.baseUrl) {
      issues.push({
        row: 0,
        field: "baseUrl",
        value: "",
        severity: "CRITICAL",
        message: "La URL base de la API es requerida",
      });
    } else {
      try {
        new URL(config.baseUrl);
      } catch {
        issues.push({
          row: 0,
          field: "baseUrl",
          value: config.baseUrl,
          severity: "CRITICAL",
          message: "La URL base no es válida",
        });
      }
    }

    if (!config.resourceId) {
      issues.push({
        row: 0,
        field: "resourceId",
        value: "",
        severity: "CRITICAL",
        message: "El ID del recurso es requerido",
      });
    } else if (!/^[0-9a-f-]{36}$/i.test(config.resourceId)) {
      issues.push({
        row: 0,
        field: "resourceId",
        value: config.resourceId,
        severity: "WARNING",
        message: "El ID del recurso no parece ser un UUID válido",
      });
    }

    if (config.pageSize && (config.pageSize < 1 || config.pageSize > 1000)) {
      issues.push({
        row: 0,
        field: "pageSize",
        value: config.pageSize.toString(),
        severity: "WARNING",
        message: "El tamaño de página debe estar entre 1 y 1000",
      });
    }

    return issues.length > 0 ? ValidationResult.withIssues(issues) : ValidationResult.success();
  }

  async getPreview(config: DataSourceConfig, limit: number = 5): Promise<ImportRecord[]> {
    this.validateCkanConfig(config);

    const url = this.buildSearchUrl(config.baseUrl!, config.resourceId!, limit, 0);
    const response = await this.fetchWithRetry(url);

    if (!response.success) {
      throw new Error(`CKAN API error: ${response.error?.message || "Unknown error"}`);
    }

    const fieldMappings = config.fieldMappings || MADRID_FIELD_MAPPINGS;

    return response.result.records.map((record, index) =>
      ImportRecord.fromApiRecord(record, fieldMappings, index, "codigo_dea")
    );
  }

  async testConnection(config: DataSourceConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const validation = await this.validateConfig(config);

      if (validation.hasCriticalErrors()) {
        return {
          success: false,
          message: validation.criticalErrors[0]?.message || "Error de validación",
        };
      }

      const url = this.buildSearchUrl(config.baseUrl!, config.resourceId!, 1, 0);
      const response = await this.fetchWithRetry(url);
      const responseTimeMs = Date.now() - startTime;

      if (!response.success) {
        return {
          success: false,
          message: `Error de API: ${response.error?.message || "Unknown error"}`,
          responseTimeMs,
        };
      }

      // Obtener campos disponibles
      const sampleFields = response.result.fields?.map((f) => f.id) || [];

      return {
        success: true,
        message: `Conexión exitosa. ${response.result.total} registros disponibles.`,
        recordCount: response.result.total,
        sampleFields,
        responseTimeMs,
      };
    } catch (error) {
      return {
        success: false,
        message: `Error de conexión: ${error instanceof Error ? error.message : "Error desconocido"}`,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Construye la URL de búsqueda CKAN
   */
  private buildSearchUrl(
    baseUrl: string,
    resourceId: string,
    limit: number,
    offset: number
  ): string {
    const url = new URL(`${baseUrl}/api/3/action/datastore_search`);
    url.searchParams.set("resource_id", resourceId);
    url.searchParams.set("limit", limit.toString());
    url.searchParams.set("offset", offset.toString());
    return url.toString();
  }

  /**
   * Fetch con reintentos
   */
  private async fetchWithRetry(url: string, attempt: number = 1): Promise<CkanResponse> {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return (await response.json()) as CkanResponse;
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.warn(
          `⚠️ CKAN API request failed (attempt ${attempt}/${this.maxRetries}), retrying...`
        );
        await this.delay(this.retryDelayMs * attempt);
        return this.fetchWithRetry(url, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Valida la configuración CKAN
   */
  private validateCkanConfig(config: DataSourceConfig): void {
    if (!config.baseUrl) {
      throw new Error("baseUrl is required for CKAN API source");
    }
    if (!config.resourceId) {
      throw new Error("resourceId is required for CKAN API source");
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Configuración predefinida para la API de la Comunidad de Madrid
 */
export function createMadridConfig(resourceId: string): DataSourceConfig {
  return {
    type: "CKAN_API",
    baseUrl: "https://datos.comunidad.madrid",
    resourceId,
    pageSize: 100,
    fieldMappings: MADRID_FIELD_MAPPINGS,
  };
}

/**
 * Resource ID conocido para DEAs de Madrid
 */
export const MADRID_DEA_RESOURCE_ID = "42d08814-3361-4c2a-93fe-36664abc7953";
