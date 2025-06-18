import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface DeaWithValidation {
  id: number;
  numeroProvisionalDea: number;
  nombre: string;
  tipoEstablecimiento: string;
  tipoVia: string;
  nombreVia: string;
  numeroVia?: string;
  distrito: string;
  codigoPostal: number;
  latitud: number;
  longitud: number;
  overall_status?: string;
  recommended_actions?: string;
  validation_processed_at?: string;
  needs_reprocessing?: boolean;
}

async function exportDeaWithValidation() {
  console.log('🔍 Exportando registros DEA con información de validación...\n');
  
  try {
    // Obtener todos los registros DEA con sus validaciones de dirección
    const records = await prisma.deaRecord.findMany({
      include: {
        addressValidation: true
      },
      orderBy: { id: 'asc' }
    });

    console.log(`📊 Total de registros DEA encontrados: ${records.length.toLocaleString()}`);

    // Procesar los datos
    const processedData: DeaWithValidation[] = records.map(record => {
      const baseData: DeaWithValidation = {
        id: record.id,
        numeroProvisionalDea: record.numeroProvisionalDea,
        nombre: record.nombre,
        tipoEstablecimiento: record.tipoEstablecimiento,
        tipoVia: record.tipoVia,
        nombreVia: record.nombreVia,
        numeroVia: record.numeroVia ?? undefined,
        distrito: record.distrito,
        codigoPostal: record.codigoPostal,
        latitud: record.latitud,
        longitud: record.longitud
      };

      // Agregar información de validación si existe
      if (record.addressValidation) {
        baseData.overall_status = record.addressValidation.overallStatus;
        baseData.recommended_actions = JSON.stringify(record.addressValidation.recommendedActions);
        baseData.validation_processed_at = record.addressValidation.processedAt.toISOString();
        baseData.needs_reprocessing = record.addressValidation.needsReprocessing;
      }

      return baseData;
    });

    // Estadísticas
    const withValidation = processedData.filter(r => r.overall_status);
    const needsReview = processedData.filter(r => r.overall_status === 'needs_review');
    const invalid = processedData.filter(r => r.overall_status === 'invalid');
    const valid = processedData.filter(r => r.overall_status === 'valid');

    console.log('\n📈 ESTADÍSTICAS DE VALIDACIÓN:');
    console.log(`   Total con validación: ${withValidation.length.toLocaleString()}`);
    console.log(`   Válidos: ${valid.length.toLocaleString()}`);
    console.log(`   Necesitan revisión: ${needsReview.length.toLocaleString()}`);
    console.log(`   Inválidos: ${invalid.length.toLocaleString()}`);
    console.log(`   Sin validar: ${(records.length - withValidation.length).toLocaleString()}`);

    // Crear CSV
    const csvHeaders = [
      'id',
      'numeroProvisionalDea',
      'nombre',
      'tipoEstablecimiento',
      'tipoVia',
      'nombreVia',
      'numeroVia',
      'distrito',
      'codigoPostal',
      'latitud',
      'longitud',
      'overall_status',
      'recommended_actions',
      'validation_processed_at',
      'needs_reprocessing'
    ];

    const csvRows = processedData.map(record => {
      return csvHeaders.map(header => {
        const value = record[header as keyof DeaWithValidation];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',');
    });

    const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');

    // Guardar archivo
    const outputDir = path.join(process.cwd(), 'data', 'exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `dea_with_validation_${timestamp}.csv`;
    const filepath = path.join(outputDir, filename);

    fs.writeFileSync(filepath, csvContent, 'utf8');

    console.log(`\n✅ Archivo exportado exitosamente:`);
    console.log(`   📁 Ubicación: ${filepath}`);
    console.log(`   📊 Registros: ${processedData.length.toLocaleString()}`);
    console.log(`   💾 Tamaño: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);

    // Crear también un archivo JSON para análisis más detallado
    const jsonFilename = `dea_with_validation_${timestamp}.json`;
    const jsonFilepath = path.join(outputDir, jsonFilename);
    
    const jsonData = {
      metadata: {
        exportDate: new Date().toISOString(),
        totalRecords: processedData.length,
        statistics: {
          withValidation: withValidation.length,
          valid: valid.length,
          needsReview: needsReview.length,
          invalid: invalid.length,
          withoutValidation: records.length - withValidation.length
        }
      },
      data: processedData
    };

    fs.writeFileSync(jsonFilepath, JSON.stringify(jsonData, null, 2), 'utf8');
    console.log(`   📄 JSON: ${jsonFilepath}`);

    // Mostrar algunos ejemplos
    console.log('\n📋 EJEMPLOS DE REGISTROS:');
    
    if (needsReview.length > 0) {
      console.log('\n⚠️  Ejemplo - Necesita Revisión:');
      const example = needsReview[0];
      console.log(`   ID: ${example.id}, DEA: ${example.numeroProvisionalDea}`);
      console.log(`   Nombre: ${example.nombre}`);
      console.log(`   Estado: ${example.overall_status}`);
      console.log(`   Acciones: ${example.recommended_actions?.substring(0, 100)}...`);
    }

    if (invalid.length > 0) {
      console.log('\n❌ Ejemplo - Inválido:');
      const example = invalid[0];
      console.log(`   ID: ${example.id}, DEA: ${example.numeroProvisionalDea}`);
      console.log(`   Nombre: ${example.nombre}`);
      console.log(`   Estado: ${example.overall_status}`);
      console.log(`   Acciones: ${example.recommended_actions?.substring(0, 100)}...`);
    }

    console.log('\n🎉 Exportación completada exitosamente!');

  } catch (error) {
    console.error('❌ Error durante la exportación:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportDeaWithValidation();
