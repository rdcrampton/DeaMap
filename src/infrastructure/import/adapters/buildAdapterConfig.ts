/**
 * Utilidad para construir configuración de adaptadores de fuentes de datos
 * Capa de Infraestructura - Utilidad compartida
 *
 * Esta función normaliza la configuración almacenada en la BD para que sea
 * compatible con los adaptadores (CkanApiAdapter, etc.)
 *
 * Soporta:
 * - URLs directas de JSON (apiEndpoint)
 * - APIs CKAN tradicionales (baseUrl + resourceId)
 */

import type { DataSourceConfig, DataSourceType } from "@/domain/import/ports/IDataSourceAdapter";

/**
 * Construye la configuración del adapter a partir de los datos almacenados
 * Mapea los campos del formulario a los esperados por el adapter
 * Soporta tanto URLs directas de JSON como APIs CKAN tradicionales
 */
export function buildDataSourceConfig(
  type: DataSourceType,
  configData: DataSourceConfig | Record<string, unknown>
): DataSourceConfig {
  const apiEndpoint = (configData as any).apiEndpoint as string | undefined;

  // Extraer baseUrl desde apiEndpoint si es necesario (para API CKAN tradicional)
  let baseUrl = (configData as any).baseUrl as string | undefined;
  if (!baseUrl && apiEndpoint) {
    try {
      const url = new URL(apiEndpoint);
      baseUrl = `${url.protocol}//${url.host}`;
    } catch {
      baseUrl = undefined;
    }
  }

  return {
    type,
    // Pasar apiEndpoint para soportar URLs directas de JSON
    apiEndpoint,
    baseUrl,
    resourceId: (configData as any).resourceId as string | undefined,
    fieldMappings: (configData as any).fieldMapping as Record<string, string> | undefined,
    pageSize: (configData as any).pageSize as number | undefined,
  };
}
