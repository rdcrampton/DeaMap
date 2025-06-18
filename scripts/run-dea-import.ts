#!/usr/bin/env ts-node

/**
 * Script ejecutor para la importación de DEAs
 * Uso: npm run import-deas
 */

import { DeaImporter } from './import-dea-provisional';

async function runImport() {
  console.log('🎯 Iniciando importación de registros DEA desde CSV provisional...\n');
  
  const startTime = Date.now();
  
  try {
    const importer = new DeaImporter();
    await importer.importDeas();
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log(`\n⏱️ Importación completada en ${duration} segundos`);
    console.log('🎉 ¡Proceso finalizado exitosamente!');
    
  } catch (error) {
    console.error('\n💥 Error durante la importación:', error);
    process.exit(1);
  }
}

runImport();
