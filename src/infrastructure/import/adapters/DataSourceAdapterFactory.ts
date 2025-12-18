/**
 * Factory: Crea el adapter correcto según el tipo de fuente de datos
 * Capa de Infraestructura
 */

import type {
  IDataSourceAdapter,
  IDataSourceAdapterFactory,
  DataSourceType,
} from "@/domain/import/ports/IDataSourceAdapter";
import { CsvDataSourceAdapter } from "./CsvDataSourceAdapter";
import { CkanApiAdapter } from "./CkanApiAdapter";
import type { CsvParserAdapter } from "../parsers/CsvParserAdapter";

export class DataSourceAdapterFactory implements IDataSourceAdapterFactory {
  private readonly adapters: Map<DataSourceType, IDataSourceAdapter>;

  constructor(csvParser: CsvParserAdapter) {
    this.adapters = new Map<DataSourceType, IDataSourceAdapter>([
      ["CSV_FILE", new CsvDataSourceAdapter(csvParser)],
      ["CKAN_API", new CkanApiAdapter()],
      // Añadir más adapters aquí cuando se implementen:
      // ["JSON_FILE", new JsonFileAdapter()],
      // ["REST_API", new RestApiAdapter()],
    ]);
  }

  create(type: DataSourceType): IDataSourceAdapter {
    const adapter = this.adapters.get(type);

    if (!adapter) {
      throw new Error(
        `Unsupported data source type: ${type}. Supported types: ${this.getSupportedTypes().join(", ")}`
      );
    }

    return adapter;
  }

  supports(type: DataSourceType): boolean {
    return this.adapters.has(type);
  }

  getSupportedTypes(): DataSourceType[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Registra un nuevo adapter
   */
  registerAdapter(type: DataSourceType, adapter: IDataSourceAdapter): void {
    this.adapters.set(type, adapter);
  }
}
