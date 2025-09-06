import dotenv from 'dotenv';
import path from 'path';

// Cargar .env.local primero (mayor prioridad)
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
// Luego cargar .env como fallback
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';


const prisma = new PrismaClient();

// Configuración del cliente S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

interface MigrationStats {
  totalRecords: number;
  recordsWithSharePoint: number;
  imagesProcessed: number;
  imagesSuccessful: number;
  imagesFailed: number;
  recordsUpdated: number;
  errors: string[];
}

interface ImageMigrationResult {
  success: boolean;
  originalUrl: string;
  newUrl?: string;
  error?: string;
}

/**
 * Verifica si una URL es de SharePoint
 */
function isSharePointUrl(url: string): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    return hostname.includes('sharepoint.com') || 
           hostname.includes('sharepoint-df.com') ||
           hostname.includes('sharepointonline.com');
  } catch {
    return false;
  }
}

/**
 * Descarga una imagen de SharePoint usando cookies de sesión
 */
async function downloadImageFromSharePoint(url: string): Promise<Buffer> {
  const cookies = process.env.SHAREPOINT_COOKIES;
  if (!cookies) {
    throw new Error('SHAREPOINT_COOKIES no está configurado en las variables de entorno');
  }

  console.log(`📥 Descargando imagen de SharePoint: ${url.substring(0, 100)}...`);

  // Crear AbortController para timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': 'https://madrid-my.sharepoint.com/',
        'Cookie': cookies,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Error HTTP ${response.status}: ${response.statusText}`);
    }

    // Verificar que el contenido sea una imagen
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      throw new Error(`El contenido no es una imagen válida. Content-Type: ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`✅ Imagen descargada exitosamente (${buffer.length} bytes)`);
    
    return buffer;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Timeout: La descarga de la imagen tardó más de 30 segundos');
    }
    throw error;
  }
}

/**
 * Sube una imagen a S3
 */
async function uploadImageToS3(
  buffer: Buffer,
  originalUrl: string,
  deaId: number,
  imageType: 'foto1' | 'foto2'
): Promise<string> {
  // Determinar extensión del archivo desde la URL original
  let fileExtension = 'jpg'; // default
  try {
    const urlPath = new URL(originalUrl).pathname;
    const match = urlPath.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    if (match) {
      fileExtension = match[1].toLowerCase();
    }
  } catch {
    console.warn(`⚠️ No se pudo determinar la extensión del archivo, usando .jpg`);
  }

  // Generar nombre único para el archivo
  const timestamp = Date.now();
  const fileName = `sharepoint-migration-${deaId}-${imageType}-${timestamp}.${fileExtension}`;
  const key = `original/${fileName}`;

  console.log(`📤 Subiendo a S3: ${key}`);

  // Determinar Content-Type basado en la extensión
  const contentTypeMap: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp'
  };
  const contentType = contentTypeMap[fileExtension] || 'image/jpeg';

  // Configurar el comando de subida
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Hacer el objeto público para lectura
    ACL: 'public-read',
  });

  // Subir el archivo
  await s3Client.send(command);

  // Construir la URL pública
  const s3Url = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  
  console.log(`✅ Imagen subida exitosamente a S3: ${s3Url}`);
  
  return s3Url;
}

/**
 * Migra una imagen individual de SharePoint a S3
 */
async function migrateImage(
  originalUrl: string,
  deaId: number,
  imageType: 'foto1' | 'foto2'
): Promise<ImageMigrationResult> {
  try {
    // Descargar imagen de SharePoint
    const buffer = await downloadImageFromSharePoint(originalUrl);
    
    // Subir a S3
    const s3Url = await uploadImageToS3(buffer, originalUrl, deaId, imageType);
    
    return {
      success: true,
      originalUrl,
      newUrl: s3Url
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
    console.error(`❌ Error migrando imagen ${imageType} del DEA ${deaId}: ${errorMessage}`);
    
    return {
      success: false,
      originalUrl,
      error: errorMessage
    };
  }
}

/**
 * Procesa un lote de registros DEA
 */
async function processBatch(
  records: Array<{ id: number; numeroProvisionalDea: number; foto1: string | null; foto2: string | null }>,
  dryRun: boolean,
  stats: MigrationStats
): Promise<void> {
  for (const record of records) {
    console.log(`\n🔄 Procesando DEA ${record.numeroProvisionalDea} (ID: ${record.id})`);
    
    const updates: { foto1?: string; foto2?: string } = {};
    let hasUpdates = false;

    // Procesar foto1
    if (record.foto1 && isSharePointUrl(record.foto1)) {
      console.log(`📸 Migrando foto1...`);
      stats.imagesProcessed++;
      
      const result = await migrateImage(record.foto1, record.id, 'foto1');
      
      if (result.success && result.newUrl) {
        updates.foto1 = result.newUrl;
        hasUpdates = true;
        stats.imagesSuccessful++;
        console.log(`✅ Foto1 migrada: ${result.newUrl}`);
      } else {
        stats.imagesFailed++;
        stats.errors.push(`DEA ${record.numeroProvisionalDea} foto1: ${result.error}`);
      }
    }

    // Procesar foto2
    if (record.foto2 && isSharePointUrl(record.foto2)) {
      console.log(`📸 Migrando foto2...`);
      stats.imagesProcessed++;
      
      const result = await migrateImage(record.foto2, record.id, 'foto2');
      
      if (result.success && result.newUrl) {
        updates.foto2 = result.newUrl;
        hasUpdates = true;
        stats.imagesSuccessful++;
        console.log(`✅ Foto2 migrada: ${result.newUrl}`);
      } else {
        stats.imagesFailed++;
        stats.errors.push(`DEA ${record.numeroProvisionalDea} foto2: ${result.error}`);
      }
    }

    // Actualizar base de datos si hay cambios
    if (hasUpdates && !dryRun) {
      try {
        await prisma.deaRecord.update({
          where: { id: record.id },
          data: updates
        });
        
        stats.recordsUpdated++;
        console.log(`✅ Base de datos actualizada para DEA ${record.numeroProvisionalDea}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        stats.errors.push(`Error actualizando DEA ${record.numeroProvisionalDea}: ${errorMessage}`);
        console.error(`❌ Error actualizando base de datos: ${errorMessage}`);
      }
    } else if (hasUpdates && dryRun) {
      console.log(`🔍 [DRY RUN] Se actualizaría DEA ${record.numeroProvisionalDea} con:`, updates);
    }

    // Pausa pequeña entre registros para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Función principal de migración
 */
async function migrateSharePointToS3(options: {
  dryRun?: boolean;
  specificIds?: number[];
  batchSize?: number;
} = {}) {
  const { dryRun = false, specificIds, batchSize = 5 } = options;
  
  console.log('🚀 Iniciando migración de imágenes SharePoint → S3');
  console.log(`📋 Modo: ${dryRun ? 'DRY RUN (sin cambios)' : 'MIGRACIÓN REAL'}`);
  
  // Verificar variables de entorno
  const requiredEnvVars = [
    'SHAREPOINT_COOKIES',
    'AWS_REGION',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET_NAME'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Variable de entorno requerida no encontrada: ${envVar}`);
    }
  }
  
  const stats: MigrationStats = {
    totalRecords: 0,
    recordsWithSharePoint: 0,
    imagesProcessed: 0,
    imagesSuccessful: 0,
    imagesFailed: 0,
    recordsUpdated: 0,
    errors: []
  };

  try {
    // Construir query para obtener registros
    const whereClause = specificIds 
      ? { id: { in: specificIds } }
      : {
          OR: [
            { foto1: { contains: 'sharepoint' } },
            { foto2: { contains: 'sharepoint' } }
          ]
        };

    // Obtener registros con URLs de SharePoint
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
    
    // Filtrar registros que realmente tienen URLs de SharePoint
    const recordsWithSharePoint = records.filter(record => 
      (record.foto1 && isSharePointUrl(record.foto1)) ||
      (record.foto2 && isSharePointUrl(record.foto2))
    );
    
    stats.recordsWithSharePoint = recordsWithSharePoint.length;

    console.log(`📊 Encontrados ${stats.totalRecords} registros totales`);
    console.log(`📊 ${stats.recordsWithSharePoint} registros tienen imágenes de SharePoint`);

    if (stats.recordsWithSharePoint === 0) {
      console.log('✅ No hay imágenes de SharePoint para migrar');
      return stats;
    }

    // Procesar en lotes
    for (let i = 0; i < recordsWithSharePoint.length; i += batchSize) {
      const batch = recordsWithSharePoint.slice(i, i + batchSize);
      
      console.log(`\n📦 Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(recordsWithSharePoint.length / batchSize)}`);
      console.log(`📈 Progreso: ${i}/${recordsWithSharePoint.length} registros procesados`);
      
      await processBatch(batch, dryRun, stats);
      
      // Pausa entre lotes
      if (i + batchSize < recordsWithSharePoint.length) {
        console.log('⏸️ Pausa entre lotes...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Mostrar estadísticas finales
    console.log('\n🎉 ¡Migración completada!');
    console.log('\n📊 ESTADÍSTICAS FINALES:');
    console.log(`📋 Total de registros analizados: ${stats.totalRecords}`);
    console.log(`📋 Registros con SharePoint: ${stats.recordsWithSharePoint}`);
    console.log(`📸 Imágenes procesadas: ${stats.imagesProcessed}`);
    console.log(`✅ Imágenes migradas exitosamente: ${stats.imagesSuccessful}`);
    console.log(`❌ Imágenes con errores: ${stats.imagesFailed}`);
    console.log(`💾 Registros actualizados en BD: ${stats.recordsUpdated}`);
    
    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORES ENCONTRADOS:');
      stats.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    return stats;

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options: {
    dryRun?: boolean;
    specificIds?: number[];
    batchSize?: number;
  } = {};

  // Parsear argumentos
  if (args.includes('--dry-run')) {
    options.dryRun = true;
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

  migrateSharePointToS3(options)
    .then(() => {
      console.log('\n✅ Script completado exitosamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script falló:', error);
      process.exit(1);
    });
}

export { migrateSharePointToS3, isSharePointUrl };
