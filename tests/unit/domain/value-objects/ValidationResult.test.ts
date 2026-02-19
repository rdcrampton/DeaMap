import { describe, it, expect } from "vitest";
import { ValidationResult } from "@/import/domain/value-objects/ValidationResult";
import { ValidationError } from "@/import/domain/value-objects/ValidationError";

describe("ValidationResult", () => {
  describe("Creación de resultados", () => {
    it("debe crear un resultado exitoso sin errores", () => {
      const result = ValidationResult.success();

      expect(result.isValid).toBe(true);
      expect(result.hasWarnings).toBe(false);
      expect(result.hasCriticalErrors()).toBe(false);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getWarnings()).toHaveLength(0);
    });

    it("debe crear un resultado vacío", () => {
      const result = ValidationResult.empty();

      expect(result.isValid).toBe(true);
      expect(result.totalRecords).toBe(0);
      expect(result.validRecords).toBe(0);
      expect(result.invalidRecords).toBe(0);
    });

    it("debe crear un resultado con estadísticas y errores", () => {
      const errors = [
        ValidationError.create({
          row: 1,
          field: "codigo",
          value: "ABC",
          errorType: "INVALID_FORMAT",
          message: "Código inválido",
          severity: "error",
        }),
      ];

      const result = ValidationResult.create(errors, [], {
        totalRecords: 100,
        validRecords: 95,
        invalidRecords: 5,
        skippedRecords: 0,
        warningRecords: 0,
      });

      expect(result.isValid).toBe(false);
      expect(result.totalRecords).toBe(100);
      expect(result.validRecords).toBe(95);
      expect(result.invalidRecords).toBe(5);
      expect(result.getErrors()).toHaveLength(1);
    });
  });

  describe("Propiedades computadas", () => {
    it("debe calcular processedRecords correctamente", () => {
      const result = ValidationResult.create([], [], {
        totalRecords: 100,
        validRecords: 80,
        invalidRecords: 10,
        skippedRecords: 10,
        warningRecords: 5,
      });

      expect(result.processedRecords).toBe(100); // 80 + 10 + 10
    });

    it("debe retornar criticalErrors como array de mensajes", () => {
      const errors = [
        ValidationError.create({
          row: 1,
          field: "codigo",
          errorType: "MISSING_DATA",
          message: "Dato requerido",
          severity: "error",
        }),
        ValidationError.create({
          row: 2,
          field: "nombre",
          errorType: "INVALID_FORMAT",
          message: "Formato inválido",
          severity: "error",
        }),
      ];

      const result = ValidationResult.create(errors, [], {
        totalRecords: 10,
        validRecords: 8,
        invalidRecords: 2,
        skippedRecords: 0,
        warningRecords: 0,
      });

      expect(result.criticalErrors).toHaveLength(2);
      expect(result.criticalErrors[0]).toEqual({ message: "Dato requerido" });
      expect(result.criticalErrors[1]).toEqual({ message: "Formato inválido" });
    });
  });

  describe("Estado de validez", () => {
    it("debe ser válido cuando no hay errores (solo warnings)", () => {
      const warnings = [
        ValidationError.create({
          row: 1,
          field: "telefono",
          errorType: "BUSINESS_RULE_VIOLATION",
          message: "Teléfono corto",
          severity: "warning",
        }),
      ];

      const result = ValidationResult.create([], warnings, {
        totalRecords: 10,
        validRecords: 10,
        invalidRecords: 0,
        skippedRecords: 0,
        warningRecords: 1,
      });

      expect(result.isValid).toBe(true);
      expect(result.hasWarnings).toBe(true);
      expect(result.hasCriticalErrors()).toBe(false);
    });

    it("debe ser inválido cuando hay errores", () => {
      const errors = [
        ValidationError.create({
          row: 1,
          field: "codigo",
          errorType: "MISSING_DATA",
          message: "Campo requerido",
          severity: "error",
        }),
      ];

      const result = ValidationResult.create(errors, [], {
        totalRecords: 10,
        validRecords: 9,
        invalidRecords: 1,
        skippedRecords: 0,
        warningRecords: 0,
      });

      expect(result.isValid).toBe(false);
      expect(result.hasCriticalErrors()).toBe(true);
    });
  });

  describe("Copias defensivas", () => {
    it("debe retornar copias de errores", () => {
      const errors = [
        ValidationError.create({
          row: 1,
          field: "codigo",
          errorType: "MISSING_DATA",
          message: "Error",
          severity: "error",
        }),
      ];

      const result = ValidationResult.create(errors, [], {
        totalRecords: 1,
        validRecords: 0,
        invalidRecords: 1,
        skippedRecords: 0,
        warningRecords: 0,
      });

      const errors1 = result.getErrors();
      const errors2 = result.getErrors();

      expect(errors1).toEqual(errors2);
      expect(errors1).not.toBe(errors2);
    });

    it("debe retornar copias de warnings", () => {
      const warnings = [
        ValidationError.create({
          row: 1,
          field: "tel",
          errorType: "BUSINESS_RULE_VIOLATION",
          message: "Warning",
          severity: "warning",
        }),
      ];

      const result = ValidationResult.create([], warnings, {
        totalRecords: 1,
        validRecords: 1,
        invalidRecords: 0,
        skippedRecords: 0,
        warningRecords: 1,
      });

      const w1 = result.getWarnings();
      const w2 = result.getWarnings();

      expect(w1).toEqual(w2);
      expect(w1).not.toBe(w2);
    });
  });

  describe("Agrupación de errores", () => {
    const errors = [
      ValidationError.create({
        row: 1,
        field: "codigo",
        errorType: "MISSING_DATA",
        message: "Error 1",
        severity: "error",
      }),
      ValidationError.create({
        row: 2,
        field: "codigo",
        errorType: "INVALID_FORMAT",
        message: "Error 2",
        severity: "error",
      }),
      ValidationError.create({
        row: 3,
        field: "direccion",
        errorType: "MISSING_DATA",
        message: "Error 3",
        severity: "error",
      }),
    ];

    it("debe agrupar errores por tipo", () => {
      const result = ValidationResult.create(errors, [], {
        totalRecords: 3,
        validRecords: 0,
        invalidRecords: 3,
        skippedRecords: 0,
        warningRecords: 0,
      });

      const byType = result.getErrorsByType();

      expect(byType["MISSING_DATA"]).toBe(2);
      expect(byType["INVALID_FORMAT"]).toBe(1);
    });

    it("debe agrupar errores por campo", () => {
      const result = ValidationResult.create(errors, [], {
        totalRecords: 3,
        validRecords: 0,
        invalidRecords: 3,
        skippedRecords: 0,
        warningRecords: 0,
      });

      const byField = result.getErrorsByField();

      expect(byField["codigo"]).toBe(2);
      expect(byField["direccion"]).toBe(1);
    });
  });

  describe("Resumen (toSummary)", () => {
    it("debe generar un resumen correcto", () => {
      const errors = [
        ValidationError.create({
          row: 1,
          field: "codigo",
          errorType: "MISSING_DATA",
          message: "Error",
          severity: "error",
        }),
      ];
      const warnings = [
        ValidationError.create({
          row: 2,
          field: "telefono",
          errorType: "BUSINESS_RULE_VIOLATION",
          message: "Advertencia",
          severity: "warning",
        }),
      ];

      const result = ValidationResult.create(errors, warnings, {
        totalRecords: 10,
        validRecords: 8,
        invalidRecords: 1,
        skippedRecords: 1,
        warningRecords: 1,
      });

      const summary = result.toSummary();

      expect(summary.isValid).toBe(false);
      expect(summary.totalRecords).toBe(10);
      expect(summary.validRecords).toBe(8);
      expect(summary.invalidRecords).toBe(1);
      expect(summary.skippedRecords).toBe(1);
      expect(summary.warningRecords).toBe(1);
      expect(summary.processedRecords).toBe(10);
      expect(summary.errors).toHaveLength(1);
      expect(summary.warnings).toHaveLength(1);
      expect(summary.errorSummary.total).toBe(1);
    });

    it("debe limitar errores y warnings en el resumen", () => {
      const errors = Array.from({ length: 100 }, (_, i) =>
        ValidationError.create({
          row: i + 1,
          field: "campo",
          errorType: "MISSING_DATA",
          message: `Error ${i + 1}`,
          severity: "error",
        })
      );

      const result = ValidationResult.create(errors, [], {
        totalRecords: 100,
        validRecords: 0,
        invalidRecords: 100,
        skippedRecords: 0,
        warningRecords: 0,
      });

      const summary = result.toSummary(10, 5);

      expect(summary.errors).toHaveLength(10);
      expect(summary.errorSummary.total).toBe(100);
    });
  });

  describe("withIssues (compatibilidad con adaptadores)", () => {
    it("debe crear resultado desde issues CRITICAL/ERROR como errores", () => {
      const result = ValidationResult.withIssues([
        { severity: "CRITICAL", message: "Crítico", row: 1, field: "codigo" },
        { severity: "ERROR", message: "Error", row: 2, field: "direccion" },
      ]);

      expect(result.isValid).toBe(false);
      expect(result.getErrors()).toHaveLength(2);
      expect(result.hasCriticalErrors()).toBe(true);
    });

    it("debe crear resultado desde issues WARNING como warnings", () => {
      const result = ValidationResult.withIssues([
        { severity: "WARNING", message: "Advertencia", row: 1, field: "telefono" },
      ]);

      expect(result.isValid).toBe(true);
      expect(result.hasWarnings).toBe(true);
      expect(result.getWarnings()).toHaveLength(1);
    });

    it("debe separar correctamente errores y warnings", () => {
      const result = ValidationResult.withIssues([
        { severity: "CRITICAL", message: "Crítico", row: 1 },
        { severity: "ERROR", message: "Error", row: 2 },
        { severity: "WARNING", message: "Warning", row: 3 },
      ]);

      expect(result.getErrors()).toHaveLength(2);
      expect(result.getWarnings()).toHaveLength(1);
    });
  });

  describe("Serialización", () => {
    it("debe serializar y deserializar correctamente", () => {
      const errors = [
        ValidationError.create({
          row: 1,
          field: "codigo",
          errorType: "MISSING_DATA",
          message: "Error",
          severity: "error",
        }),
      ];

      const original = ValidationResult.create(errors, [], {
        totalRecords: 10,
        validRecords: 9,
        invalidRecords: 1,
        skippedRecords: 0,
        warningRecords: 0,
      });

      const json = original.toJSON();
      const restored = ValidationResult.fromJSON(json);

      expect(restored.isValid).toBe(original.isValid);
      expect(restored.totalRecords).toBe(original.totalRecords);
      expect(restored.validRecords).toBe(original.validRecords);
      expect(restored.invalidRecords).toBe(original.invalidRecords);
      expect(restored.getErrors()).toHaveLength(1);
      expect(restored.getErrors()[0].message).toBe("Error");
    });
  });
});
