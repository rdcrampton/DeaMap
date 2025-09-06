import { DeaRevisadasImporter } from './import-dea-revisadas';
import * as readline from 'readline';

/**
 * Script ejecutor para importar registros DEA revisados
 * 
 * Uso:
 * npm run ts-node scripts/run-dea-revisadas-import.ts
 * 
 * O directamente:
 * npx ts-node scripts/run-dea-revisadas-import.ts
 */

async function main() {
  console.log('🚀 IMPORTADOR DE REGISTROS DEA REVISADOS');
  console.log('=====================================');
  console.log('');
  console.log('Este script importará los registros del archivo:');
  console.log('📁 data/CSV/dea_revisadas.csv');
  console.log('');
  console.log('⚠️  IMPORTANTE:');
  console.log('   - Se excluirán las columnas: overall_status, recommended_actions');
  console.log('   - Solo se importarán las columnas que existen en la tabla dea_records');
  console.log('   - Los registros se procesarán en lotes de 100');
  console.log('');
  
  // Preguntar confirmación
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question('¿Desea continuar con la importación? (s/N): ', resolve);
  });
  
  rl.close();

  if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'si' && answer.toLowerCase() !== 'sí') {
    console.log('❌ Importación cancelada por el usuario');
    process.exit(0);
  }

  console.log('');
  console.log('🔄 Iniciando importación...');
  console.log('');

  try {
    const importer = new DeaRevisadasImporter();
    await importer.importDeas();
    
    console.log('');
    console.log('🎉 ¡Importación completada exitosamente!');
    console.log('');
    console.log('📋 Próximos pasos recomendados:');
    console.log('   1. Verificar los datos importados en la base de datos');
    console.log('   2. Ejecutar validaciones de integridad si es necesario');
    console.log('   3. Revisar los logs para identificar registros omitidos');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR DURANTE LA IMPORTACIÓN:');
    console.error('================================');
    console.error(error);
    console.error('');
    console.error('🔧 Posibles soluciones:');
    console.error('   1. Verificar que el archivo CSV existe y es accesible');
    console.error('   2. Comprobar la conexión a la base de datos');
    console.error('   3. Revisar el formato de los datos en el CSV');
    console.error('   4. Verificar que no hay conflictos de duplicados');
    
    process.exit(1);
  }
}

// Ejecutar el script
main().catch((error) => {
  console.error('❌ Error fatal:', error);
  process.exit(1);
});
