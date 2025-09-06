#!/usr/bin/env tsx

/**
 * Script para ejecutar el pre-procesamiento de validaciones de direcciones
 * Uso: 
 *   npx tsx scripts/preprocess-address-validations.ts                    # 100 registros (por defecto)
 *   npx tsx scripts/preprocess-address-validations.ts --no-limit        # Todos los registros
 *   npx tsx scripts/preprocess-address-validations.ts --limit=500       # 500 registros
 *   npx tsx scripts/preprocess-address-validations.ts --batch-size=10   # Lotes de 10
 */

import { PrismaClient } from '@prisma/client';
import { newMadridValidationService } from '../src/services/newMadridValidationService';

const prisma = new PrismaClient();

// Type assertion to access deaAddressValidation model
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const deaAddressValidation = (prisma as any).deaAddressValidation;

interface ScriptOptions {
  limit?: number;
  batchSize: number;
  maxRetries: number;
  noLimit: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  const options: ScriptOptions = {
    limit: 100, // Límite por defecto
    batchSize: 5,
    maxRetries: 3,
    noLimit: false
  };

  for (const arg of args) {
    if (arg === '--no-limit') {
      options.noLimit = true;
      options.limit = undefined;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
      options.noLimit = false;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1]);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  
  console.log('🌙 === INICIO PRE-PROCESAMIENTO DE VALIDACIONES ===');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`⚙️  Configuración:`);
  console.log(`   Límite: ${options.noLimit ? 'Sin límite' : options.limit + ' registros'}`);
  console.log(`   Tamaño de lote: ${options.batchSize}`);
  console.log(`   Máximo reintentos: ${options.maxRetries}`);
  
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;
  const errors: Array<{ recordId: number; error: string }> = [];

  try {
    // 1. Obtener registros que necesitan procesamiento
    console.log('\n🔍 Analizando registros pendientes...');
    
    const existingValidations = await deaAddressValidation.findMany({
      select: { 
        deaRecordId: true,
        needsReprocessing: true,
        retryCount: true,
        errorMessage: true
      }
    });

    const existingIds = existingValidations.map((v: { deaRecordId: number }) => v.deaRecordId);
    const needsReprocessingIds = existingValidations
      .filter((v: { needsReprocessing: boolean; errorMessage: string | null; retryCount: number }) => 
        v.needsReprocessing || (v.errorMessage && v.retryCount < options.maxRetries))
      .map((v: { deaRecordId: number }) => v.deaRecordId);

    const queryOptions: {
      where: {
        OR: Array<{
          id: { notIn: number[] } | { in: number[] }
        }>
      },
      orderBy: { createdAt: 'asc' },
      take?: number
    } = {
      where: {
        OR: [
          // Registros sin validación
          { id: { notIn: existingIds } },
          // Registros que necesitan reprocesamiento
          { id: { in: needsReprocessingIds } }
        ]
      },
      orderBy: { createdAt: 'asc' }
    };

    // Aplicar límite si no es --no-limit
    if (!options.noLimit && options.limit) {
      queryOptions.take = options.limit;
    }

    const pendingRecords = await prisma.deaRecord.findMany(queryOptions);

    // Obtener estadísticas para mostrar el progreso
    const totalRecords = await prisma.deaRecord.count();
    const processedRecords = await deaAddressValidation.count({
      where: { needsReprocessing: false }
    });
    const needsReprocessingCount = await deaAddressValidation.count({
      where: { needsReprocessing: true }
    });

    console.log(`📊 Estado actual:`);
    console.log(`   Total registros DEA: ${totalRecords}`);
    console.log(`   Ya procesados: ${processedRecords}`);
    console.log(`   Necesitan reprocesamiento: ${needsReprocessingCount}`);
    console.log(`   Sin procesar: ${totalRecords - processedRecords - needsReprocessingCount}`);
    console.log(`📦 Encontrados ${pendingRecords.length} registros para procesar en este lote`);

    if (pendingRecords.length === 0) {
      console.log('✅ No hay registros pendientes de procesar');
      return;
    }

    // 2. Procesar registros en lotes
    const totalBatches = Math.ceil(pendingRecords.length / options.batchSize);
    
    for (let i = 0; i < pendingRecords.length; i += options.batchSize) {
      const batch = pendingRecords.slice(i, i + options.batchSize);
      const batchNumber = Math.floor(i / options.batchSize) + 1;
      
      console.log(`\n📦 Procesando lote ${batchNumber}/${totalBatches} (${batch.length} registros)`);
      
      // Procesar lote en paralelo
      const batchPromises = batch.map(async (record) => {
        try {
          const recordStartTime = Date.now();
          
          // Realizar validación
          const validation = await newMadridValidationService.validateAddress(
            record.tipoVia,
            record.nombreVia,
            record.numeroVia || undefined,
            record.codigoPostal.toString(),
            record.distrito,
            { latitude: record.latitud, longitude: record.longitud }
          );

          const processingTime = Date.now() - recordStartTime;

          // Extraer información del barrio del mejor resultado
          const bestMatch = validation.searchResult.suggestions[0];
          const neighborhoodInfo = bestMatch ? {
            detectedNeighborhoodId: bestMatch.barrioId || null,
            detectedNeighborhoodName: bestMatch.barrioNombre || null,
            detectedNeighborhoodCode: bestMatch.codigoBarrio || null,
          } : {};

          // Guardar resultados usando Prisma Client
          await deaAddressValidation.upsert({
            where: { deaRecordId: record.id },
            create: {
              deaRecordId: record.id,
              searchResults: validation.searchResult.suggestions,
              validationDetails: validation.validationDetails,
              overallStatus: validation.overallStatus,
              recommendedActions: validation.recommendedActions,
              processingDurationMs: processingTime,
              searchStrategiesUsed: ['exact', 'fuzzy'],
              needsReprocessing: false,
              errorMessage: null,
              retryCount: 0,
              ...neighborhoodInfo  // Incluir info del barrio
            },
            update: {
              searchResults: validation.searchResult.suggestions,
              validationDetails: validation.validationDetails,
              overallStatus: validation.overallStatus,
              recommendedActions: validation.recommendedActions,
              processingDurationMs: processingTime,
              searchStrategiesUsed: ['exact', 'fuzzy'],
              processedAt: new Date(),
              needsReprocessing: false,
              errorMessage: null,
              retryCount: 0,
              ...neighborhoodInfo  // Incluir info del barrio
            }
          });

          processedCount++;
          // Mostrar información del barrio si está disponible
          if (bestMatch?.barrioId) {
            console.log(`✅ DEA ${record.id}: ${processingTime}ms - Barrio: ${bestMatch.barrioNombre} (ID: ${bestMatch.barrioId})`);
          } else {
            console.log(`✅ DEA ${record.id}: ${processingTime}ms`);
          }
          
          return { success: true, recordId: record.id, processingTime };
          
        } catch (error) {
          errorCount++;
          const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
          
          console.error(`❌ DEA ${record.id}: ${errorMessage}`);
          
          errors.push({
            recordId: record.id,
            error: errorMessage
          });

          // Marcar como fallido
          try {
            await prisma.$executeRaw`
              INSERT INTO dea_address_validations (
                dea_record_id,
                search_results,
                overall_status,
                processing_duration_ms,
                needs_reprocessing,
                error_message,
                retry_count
              ) VALUES (
                ${record.id},
                '[]'::jsonb,
                'invalid',
                0,
                true,
                ${errorMessage},
                1
              )
              ON CONFLICT (dea_record_id) 
              DO UPDATE SET
                needs_reprocessing = true,
                error_message = EXCLUDED.error_message,
                processed_at = NOW(),
                retry_count = dea_address_validations.retry_count + 1,
                updated_at = NOW()
            `;
          } catch (dbError) {
            console.error(`❌ Error guardando fallo para DEA ${record.id}:`, dbError);
          }
          
          return { success: false, recordId: record.id, error: errorMessage };
        }
      });

      // Esperar a que termine el lote
      await Promise.allSettled(batchPromises);
      
      // Mostrar progreso (solo si hay múltiples lotes)
      if (totalBatches > 1) {
        const progress = ((batchNumber / totalBatches) * 100).toFixed(1);
        console.log(`📈 Progreso: ${progress}% (${batchNumber}/${totalBatches} lotes)`);
      }
      
      // Pausa entre lotes (excepto el último)
      if (i + options.batchSize < pendingRecords.length) {
        console.log('⏸️  Pausa entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const totalDuration = Date.now() - startTime;
    
    console.log('\n📊 === RESUMEN FINAL ===');
    console.log(`✅ Exitosos: ${processedCount}`);
    console.log(`❌ Fallidos: ${errorCount}`);
    console.log(`⏱️  Tiempo total: ${totalDuration}ms (${(totalDuration / 1000).toFixed(1)}s)`);
    console.log(`📈 Promedio por registro: ${processedCount > 0 ? Math.round(totalDuration / processedCount) : 0}ms`);
    
    // Mostrar velocidad solo si procesó más de 10 registros
    if (processedCount > 10) {
      console.log(`🚀 Velocidad: ${(processedCount / (totalDuration / 1000 / 60)).toFixed(1)} registros/min`);
    }
    
    if (errors.length > 0) {
      console.log('\n❌ Errores encontrados:');
      errors.slice(0, 5).forEach(error => {
        console.log(`  - DEA ${error.recordId}: ${error.error}`);
      });
      if (errors.length > 5) {
        console.log(`  ... y ${errors.length - 5} errores más`);
      }
    }

    // Mostrar estadísticas de la tabla
    const stats = await prisma.$queryRaw`
      SELECT 
        overall_status,
        COUNT(*) as count
      FROM dea_address_validations 
      GROUP BY overall_status
    ` as Array<{ overall_status: string; count: bigint }>;

    console.log('\n📈 Estadísticas de validaciones:');
    stats.forEach(stat => {
      console.log(`  ${stat.overall_status}: ${stat.count} registros`);
    });

    // Añadir estadísticas de barrios
    const neighborhoodStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_with_neighborhood,
        COUNT(DISTINCT detected_neighborhood_id) as unique_neighborhoods
      FROM dea_address_validations 
      WHERE detected_neighborhood_id IS NOT NULL
    ` as Array<{ total_with_neighborhood: bigint; unique_neighborhoods: bigint }>;

    if (neighborhoodStats.length > 0) {
      console.log('\n🏙️ Estadísticas de barrios:');
      console.log(`  DEAs con barrio identificado: ${neighborhoodStats[0].total_with_neighborhood}`);
      console.log(`  Barrios únicos detectados: ${neighborhoodStats[0].unique_neighborhoods}`);
    }

    // Mostrar progreso total solo si hay muchos registros
    if (totalRecords > 100) {
      const finalProcessedRecords = await deaAddressValidation.count({
        where: { needsReprocessing: false }
      });
      const finalProgress = ((finalProcessedRecords / totalRecords) * 100).toFixed(1);
      console.log(`\n🎯 Progreso total del sistema: ${finalProgress}% (${finalProcessedRecords}/${totalRecords} registros)`);
    }

    console.log('🏁 === FIN PRE-PROCESAMIENTO ===\n');

  } catch (error) {
    console.error('💥 Error crítico en pre-procesamiento:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error('Error ejecutando script:', error);
    process.exit(1);
  });
}

export { main };
