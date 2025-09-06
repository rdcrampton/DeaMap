import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationStats {
  totalRecords: number;
  recordsWithS3: number;
  imagesChecked: number;
  imagesWorking: number;
  imagesBroken: number;
  errors: string[];
}

/**
 * Verifica si una URL es de S3
 */
function isS3Url(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('.s3.') && urlObj.hostname.includes('.amazonaws.com');
  } catch {
    return false;
  }
}

/**
 * Verifica si una imagen de S3 es accesible
 */
async function checkImageUrl(url: string): Promise<{ accessible: boolean; error?: string; size?: number }> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    
    if (!response.ok) {
      return {
        accessible: false,
        error: `HTTP ${response.status}: ${response.statusText}`
      };
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      return {
        accessible: false,
        error: `Contenido no es imagen: ${contentType}`
      };
    }

    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength) : undefined;

    return {
      accessible: true,
      size
    };
  } catch (error) {
    return {
      accessible: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

/**
 * Verifica un lote de registros
 */
async function verifyBatch(
  records: Array<{ id: number; numeroProvisionalDea: number; foto1: string | null; foto2: string | null }>,
  stats: VerificationStats
): Promise<void> {
  for (const record of records) {
    console.log(`\n🔍 Verificando DEA ${record.numeroProvisionalDea} (ID: ${record.id})`);
    
    // Verificar foto1
    if (record.foto1 && isS3Url(record.foto1)) {
      console.log(`📸 Verificando foto1: ${record.foto1.substring(0, 80)}...`);
      stats.imagesChecked++;
      
      const result = await checkImageUrl(record.foto1);
      
      if (result.accessible) {
        stats.imagesWorking++;
        const sizeText = result.size ? ` (${(result.size / 1024 / 1024).toFixed(2)} MB)` : '';
        console.log(`✅ Foto1 accesible${sizeText}`);
      } else {
        stats.imagesBroken++;
        stats.errors.push(`DEA ${record.numeroProvisionalDea} foto1: ${result.error}`);
        console.log(`❌ Foto1 no accesible: ${result.error}`);
      }
    }

    // Verificar foto2
    if (record.foto2 && isS3Url(record.foto2)) {
      console.log(`📸 Verificando foto2: ${record.foto2.substring(0, 80)}...`);
      stats.imagesChecked++;
      
      const result = await checkImageUrl(record.foto2);
      
      if (result.accessible) {
        stats.imagesWorking++;
        const sizeText = result.size ? ` (${(result.size / 1024 / 1024).toFixed(2)} MB)` : '';
        console.log(`✅ Foto2 accesible${sizeText}`);
      } else {
        stats.imagesBroken++;
        stats.errors.push(`DEA ${record.numeroProvisionalDea} foto2: ${result.error}`);
        console.log(`❌ Foto2 no accesible: ${result.error}`);
      }
    }

    // Pausa pequeña entre registros
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

/**
 * Función principal de verificación
 */
async function verifyS3Migration(options: {
  specificIds?: number[];
  batchSize?: number;
  onlyMigrated?: boolean;
} = {}) {
  const { specificIds, batchSize = 10, onlyMigrated = true } = options;
  
  console.log('🔍 Iniciando verificación de imágenes migradas a S3');
  console.log(`📋 Verificando: ${onlyMigrated ? 'Solo imágenes migradas de SharePoint' : 'Todas las imágenes de S3'}`);
  
  const stats: VerificationStats = {
    totalRecords: 0,
    recordsWithS3: 0,
    imagesChecked: 0,
    imagesWorking: 0,
    imagesBroken: 0,
    errors: []
  };

  try {
    // Construir query para obtener registros
    let whereClause: {
      id?: { in: number[] };
      OR?: Array<{ foto1?: { contains: string } } | { foto2?: { contains: string } }>;
    };
    
    if (specificIds) {
      whereClause = { id: { in: specificIds } };
    } else if (onlyMigrated) {
      // Solo registros que fueron migrados de SharePoint (contienen "sharepoint-migration" en el nombre)
      whereClause = {
        OR: [
          { foto1: { contains: 'sharepoint-migration' } },
          { foto2: { contains: 'sharepoint-migration' } }
        ]
      };
    } else {
      // Todos los registros con URLs de S3
      whereClause = {
        OR: [
          { foto1: { contains: '.s3.' } },
          { foto2: { contains: '.s3.' } }
        ]
      };
    }

    // Obtener registros
    const records = await prisma.deaRecord.findMany({
      where: whereClause,
      select: {
        id: true,
        numeroProvisionalDea: true,
        foto1: true,
        foto2: true
      }
    });

    stats.totalRecords = records.length;
    
    // Filtrar registros que realmente tienen URLs de S3
    const recordsWithS3 = records.filter(record => 
      (record.foto1 && isS3Url(record.foto1)) ||
      (record.foto2 && isS3Url(record.foto2))
    );
    
    stats.recordsWithS3 = recordsWithS3.length;

    console.log(`📊 Encontrados ${stats.totalRecords} registros totales`);
    console.log(`📊 ${stats.recordsWithS3} registros tienen imágenes de S3`);

    if (stats.recordsWithS3 === 0) {
      console.log('✅ No hay imágenes de S3 para verificar');
      return stats;
    }

    // Procesar en lotes
    for (let i = 0; i < recordsWithS3.length; i += batchSize) {
      const batch = recordsWithS3.slice(i, i + batchSize);
      
      console.log(`\n📦 Verificando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(recordsWithS3.length / batchSize)}`);
      console.log(`📈 Progreso: ${i}/${recordsWithS3.length} registros verificados`);
      
      await verifyBatch(batch, stats);
      
      // Pausa entre lotes
      if (i + batchSize < recordsWithS3.length) {
        console.log('⏸️ Pausa entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Mostrar estadísticas finales
    console.log('\n🎉 ¡Verificación completada!');
    console.log('\n📊 ESTADÍSTICAS FINALES:');
    console.log(`📋 Total de registros analizados: ${stats.totalRecords}`);
    console.log(`📋 Registros con S3: ${stats.recordsWithS3}`);
    console.log(`📸 Imágenes verificadas: ${stats.imagesChecked}`);
    console.log(`✅ Imágenes funcionando: ${stats.imagesWorking}`);
    console.log(`❌ Imágenes con problemas: ${stats.imagesBroken}`);
    
    if (stats.imagesChecked > 0) {
      const successRate = ((stats.imagesWorking / stats.imagesChecked) * 100).toFixed(1);
      console.log(`📈 Tasa de éxito: ${successRate}%`);
    }
    
    if (stats.errors.length > 0) {
      console.log('\n❌ PROBLEMAS ENCONTRADOS:');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    } else {
      console.log('\n🎉 ¡Todas las imágenes están funcionando correctamente!');
    }

    return stats;

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options: {
    specificIds?: number[];
    batchSize?: number;
    onlyMigrated?: boolean;
  } = {};

  // Parsear argumentos
  if (args.includes('--all-s3')) {
    options.onlyMigrated = false;
  }

  const idsIndex = args.indexOf('--ids');
  if (idsIndex !== -1 && args[idsIndex + 1]) {
    options.specificIds = args[idsIndex + 1].split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
  }

  const batchIndex = args.indexOf('--batch-size');
  if (batchIndex !== -1 && args[batchIndex + 1]) {
    const batchSize = parseInt(args[batchIndex + 1]);
    if (!isNaN(batchSize) && batchSize > 0) {
      options.batchSize = batchSize;
    }
  }

  verifyS3Migration(options)
    .then(() => {
      console.log('\n✅ Verificación completada exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Verificación falló:', error);
      process.exit(1);
    });
}

export { verifyS3Migration, isS3Url };
