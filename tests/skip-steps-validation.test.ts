/**
 * Test para verificar que el sistema salta los pasos 1 y 2 cuando 
 * dea_address_validations tiene overall_status = 'valid'
 */

import { stepValidationService } from '@/services/stepValidationService';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSkipStepsValidation() {
  console.log('🧪 Iniciando test de salto de pasos para validaciones válidas...\n');

  try {
    // 1. Buscar un registro DEA que tenga validación previa válida
    console.log('🔍 Buscando registros DEA con validación previa válida...');
    
    const validValidations = await prisma.$queryRaw`
      SELECT 
        dav.dea_record_id,
        dav.overall_status,
        dav.search_results,
        dr."tipoVia",
        dr."nombreVia",
        dr."numeroVia"
      FROM dea_address_validations dav
      JOIN dea_records dr ON dr.id = dav.dea_record_id
      WHERE dav.overall_status = 'valid'
      AND dav.needs_reprocessing = false
      LIMIT 3
    ` as Array<{
      dea_record_id: number;
      overall_status: string;
      search_results: unknown;
      tipoVia: string;
      nombreVia: string;
      numeroVia: string;
    }>;

    if (validValidations.length === 0) {
      console.log('⚠️ No se encontraron registros con validación válida. Creando uno de prueba...');
      
      // Crear un registro de prueba
      const testRecord = await prisma.deaRecord.findFirst();
      if (testRecord) {
        await prisma.$executeRaw`
          INSERT INTO dea_address_validations (
            dea_record_id,
            search_results,
            overall_status,
            needs_reprocessing,
            processing_duration_ms
          ) VALUES (
            ${testRecord.id},
            '[{"claseVia":"CALLE","nombreViaAcentos":"Test","numero":"1","codigoPostal":"28001","distrito":1,"latitud":40.4168,"longitud":-3.7038,"confidence":0.95,"matchType":"exact"}]'::json,
            'valid',
            false,
            100
          )
          ON CONFLICT (dea_record_id) 
          DO UPDATE SET
            overall_status = 'valid',
            needs_reprocessing = false,
            search_results = '[{"claseVia":"CALLE","nombreViaAcentos":"Test","numero":"1","codigoPostal":"28001","distrito":1,"latitud":40.4168,"longitud":-3.7038,"confidence":0.95,"matchType":"exact"}]'::json
        `;
        
        validValidations.push({
          dea_record_id: testRecord.id,
          overall_status: 'valid',
          search_results: [],
          tipoVia: testRecord.tipoVia,
          nombreVia: testRecord.nombreVia,
          numeroVia: testRecord.numeroVia || ''
        });
      }
    }

    console.log(`✅ Encontrados ${validValidations.length} registros con validación válida\n`);

    // 2. Probar cada registro
    for (const validation of validValidations) {
      console.log(`🧪 Probando DEA ${validation.dea_record_id}: ${validation.tipoVia} ${validation.nombreVia} ${validation.numeroVia}`);
      
      // Inicializar validación
      const result = await stepValidationService.initializeStepValidation(validation.dea_record_id);
      
      if (result.success) {
        console.log(`   📊 Paso actual: ${result.progress.currentStep}`);
        console.log(`   📋 Total pasos: ${result.progress.totalSteps}`);
        console.log(`   ✅ Mensaje: ${result.message}`);
        
        // Verificar que saltó al paso 3
        if (result.progress.currentStep === 3) {
          console.log(`   🎯 ¡ÉXITO! Saltó correctamente al paso 3`);
          
          // Verificar que los pasos 1 y 2 están marcados como saltados
          const step1 = result.progress.steps.find(s => s.stepNumber === 1);
          const step2 = result.progress.steps.find(s => s.stepNumber === 2);
          const step3 = result.progress.steps.find(s => s.stepNumber === 3);
          
          console.log(`   📝 Paso 1: ${step1?.status} (${step1?.skipReason || 'N/A'})`);
          console.log(`   📝 Paso 2: ${step2?.status} (${step2?.skipReason || 'N/A'})`);
          console.log(`   📝 Paso 3: ${step3?.status}`);
          
          if (step1?.status === 'skipped' && step2?.status === 'skipped' && step3?.status === 'current') {
            console.log(`   ✅ Estados de pasos correctos`);
          } else {
            console.log(`   ❌ Estados de pasos incorrectos`);
          }
          
          // Verificar que tiene datos de step1 y step2
          if (result.progress.stepData.step1 && result.progress.stepData.step2) {
            console.log(`   ✅ Datos de step1 y step2 pre-poblados correctamente`);
          } else {
            console.log(`   ❌ Faltan datos de step1 o step2`);
          }
          
        } else if (result.progress.currentStep === 1) {
          console.log(`   ⚠️ No saltó pasos - empezó en paso 1 (posible validación no válida)`);
        } else {
          console.log(`   ❓ Comportamiento inesperado - paso actual: ${result.progress.currentStep}`);
        }
      } else {
        console.log(`   ❌ Error: ${result.error}`);
      }
      
      console.log(''); // Línea en blanco
    }

    // 3. Probar un registro sin validación válida
    console.log('🧪 Probando registro sin validación válida...');
    
    const recordWithoutValidation = await prisma.deaRecord.findFirst({
      where: {
        NOT: {
          id: {
            in: validValidations.map(v => v.dea_record_id)
          }
        }
      }
    });

    if (recordWithoutValidation) {
      console.log(`   🔍 Probando DEA ${recordWithoutValidation.id}: ${recordWithoutValidation.tipoVia} ${recordWithoutValidation.nombreVia}`);
      
      const result = await stepValidationService.initializeStepValidation(recordWithoutValidation.id);
      
      if (result.success && result.progress.currentStep === 1) {
        console.log(`   ✅ Comportamiento correcto - empezó en paso 1 (sin validación válida previa)`);
      } else {
        console.log(`   ❓ Comportamiento inesperado para registro sin validación válida`);
      }
    }

    console.log('\n🎉 Test completado!');

  } catch (error) {
    console.error('❌ Error en test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar test si se llama directamente
if (require.main === module) {
  testSkipStepsValidation();
}

export { testSkipStepsValidation };
