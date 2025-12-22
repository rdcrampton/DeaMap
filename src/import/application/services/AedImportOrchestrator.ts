/**
 * AED Import Orchestrator (Application Service)
 *
 * Orquesta el flujo completo de validación e importación de AEDs.
 * Usa todos los servicios de dominio y aplicación de forma coordinada.
 * Este orchestrador es reutilizable tanto para validación previa como para importación real.
 */

import { ValidationResult } from "../../domain/value-objects/ValidationResult";
import { ValidationError } from "../../domain/value-objects/ValidationError";
import { AedImportData } from "../../domain/value-objects/AedImportData";
import { AedValidationService } from "../../domain/services/AedValidationService";
import { CoordinateValidationService } from "../../domain/services/CoordinateValidationService";
import { DuplicateDetectionService } from "../../domain/services/DuplicateDetectionService";
import { CsvParsingService } from "./CsvParsingService";
import { ColumnMappingService, ColumnMapping } from "./ColumnMappingService";

export interface ValidationOptions {
  filePath: string;
  mappings: ColumnMapping[];
  delimiter?: string;
  maxRows?: number;
  skipDuplicates?: boolean;
  checkTimeout?: () => boolean;
}

export class AedImportOrchestrator {
  constructor(
    private readonly csvParser: CsvParsingService,
    private readonly mapper: ColumnMappingService,
    private readonly aedValidator: AedValidationService,
    private readonly coordValidator: CoordinateValidationService,
    private readonly duplicateDetector: DuplicateDetectionService
  ) {}

  /**
   * Valida registros de un archivo CSV (usado para validación previa)
   * NO crea nada en BD, solo valida
   */
  async validateRecords(options: ValidationOptions): Promise<ValidationResult> {
    const startTime = Date.now();
    const {
      filePath,
      mappings,
      delimiter = ";",
      maxRows = 100,
      skipDuplicates = true,
      checkTimeout,
    } = options;

    try {
      // 1. Parsear CSV
      const parseResult = this.csvParser.parsePreview(filePath, maxRows, delimiter);

      if (parseResult.totalRows === 0) {
        return ValidationResult.create(
          [
            ValidationError.create({
              row: 0,
              errorType: "PROCESSING_ERROR",
              message: "El archivo CSV está vacío",
              severity: "error",
            }),
          ],
          [],
          {
            totalRecords: 0,
            validRecords: 0,
            invalidRecords: 0,
            skippedRecords: 0,
            warningRecords: 0,
          }
        );
      }

      // 2. Mapear columnas
      const mappedRecords = this.mapper.mapRecords(parseResult.records, mappings);
      const mappingIndex = this.mapper.createMappingIndex(mappings);

      // 3. Validar cada registro
      const allErrors: ValidationError[] = [];
      const allWarnings: ValidationError[] = [];
      let validCount = 0;
      let invalidCount = 0;
      let skippedCount = 0;
      let warningCount = 0;

      for (let i = 0; i < mappedRecords.length; i++) {
        // Check timeout si está configurado
        if (checkTimeout && checkTimeout()) {
          console.warn(`Validation timeout at record ${i + 1}`);
          break;
        }

        const data = mappedRecords[i];
        const row = i + 2; // +2 porque Excel empieza en 1 y tiene header
        let hasErrors = false;
        let hasWarnings = false;

        // Validar campos obligatorios y formato
        const aedValidation = this.aedValidator.validateAedRecord(data, row, mappingIndex);
        if (!aedValidation.isValid) {
          hasErrors = true;
          allErrors.push(...aedValidation.errors.filter((e) => e.severity === "error"));
          allWarnings.push(...aedValidation.errors.filter((e) => e.severity === "warning"));
          if (aedValidation.errors.some((e) => e.severity === "warning")) {
            hasWarnings = true;
          }
        }

        // Validar coordenadas
        const coordValidation = this.coordValidator.validateCoordinates(
          data.latitude,
          data.longitude,
          row,
          mappingIndex.get("latitude"),
          mappingIndex.get("longitude")
        );
        if (!coordValidation.isValid && coordValidation.error) {
          hasErrors = true;
          allErrors.push(coordValidation.error);
        }

        // Verificar duplicados
        const duplicateCheck = await this.duplicateDetector.checkDuplicate(
          data,
          row,
          skipDuplicates
        );

        if (duplicateCheck.isDuplicate) {
          if (skipDuplicates) {
            skippedCount++;
          } else if (duplicateCheck.error) {
            hasErrors = true;
            allErrors.push(duplicateCheck.error);
          }
        } else if (!hasErrors) {
          validCount++;
        }

        if (hasErrors) {
          invalidCount++;
        }

        if (hasWarnings && !hasErrors) {
          warningCount++;
        }

        // Log de progreso cada 10 registros
        if ((i + 1) % 10 === 0) {
          const elapsed = Date.now() - startTime;
          console.log(
            `Validated ${i + 1}/${mappedRecords.length} records in ${elapsed}ms (${Math.round(elapsed / (i + 1))}ms/record)`
          );
        }
      }

      return ValidationResult.create(allErrors, allWarnings, {
        totalRecords: parseResult.totalRows,
        validRecords: validCount,
        invalidRecords: invalidCount,
        skippedRecords: skippedCount,
        warningRecords: warningCount,
      });
    } catch (error) {
      return ValidationResult.create(
        [
          ValidationError.create({
            row: -1,
            errorType: "PROCESSING_ERROR",
            message: error instanceof Error ? error.message : "Error desconocido en la validación",
            severity: "error",
          }),
        ],
        [],
        {
          totalRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          skippedRecords: 0,
          warningRecords: 0,
        }
      );
    }
  }

  /**
   * Valida un solo registro (usado por AedCsvImportProcessor)
   */
  async validateSingleRecord(
    data: AedImportData,
    row: number,
    mappings: ColumnMapping[],
    skipDuplicates: boolean = true
  ): Promise<{
    isValid: boolean;
    errors: ValidationError[];
    isDuplicate: boolean;
  }> {
    const errors: ValidationError[] = [];
    const mappingIndex = this.mapper.createMappingIndex(mappings);

    // Validar AED
    const aedValidation = this.aedValidator.validateAedRecord(data, row, mappingIndex);
    if (!aedValidation.isValid) {
      errors.push(...aedValidation.errors.filter((e) => e.severity === "error"));
    }

    // Validar coordenadas
    const coordValidation = this.coordValidator.validateCoordinates(
      data.latitude,
      data.longitude,
      row,
      mappingIndex.get("latitude"),
      mappingIndex.get("longitude")
    );
    if (!coordValidation.isValid && coordValidation.error) {
      errors.push(coordValidation.error);
    }

    // Verificar duplicados
    const duplicateCheck = await this.duplicateDetector.checkDuplicate(
      data,
      row,
      skipDuplicates
    );

    if (duplicateCheck.isDuplicate && !skipDuplicates && duplicateCheck.error) {
      errors.push(duplicateCheck.error);
    }

    return {
      isValid: errors.length === 0,
      errors,
      isDuplicate: duplicateCheck.isDuplicate,
    };
  }
}
