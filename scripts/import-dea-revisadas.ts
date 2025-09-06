import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface CSVRow {
  [key: string]: string;
}

interface DeaRecordInput {
  horaInicio: Date;
  horaFinalizacion: Date;
  correoElectronico: string;
  nombre: string;
  numeroProvisionalDea: number;
  tipoEstablecimiento: string;
  titularidadLocal: string;
  usoLocal: string;
  titularidad: string;
  propuestaDenominacion: string;
  tipoVia: string;
  nombreVia: string;
  numeroVia?: string;
  complementoDireccion?: string;
  codigoPostal: number;
  distrito: string;
  latitud: number;
  longitud: number;
  horarioApertura: string;
  aperturaLunesViernes: number;
  cierreLunesViernes: number;
  aperturaSabados: number;
  cierreSabados: number;
  aperturaDomingos: number;
  cierreDomingos: number;
  vigilante24h: string;
  foto1?: string;
  foto2?: string;
  descripcionAcceso?: string;
  comentarioLibre?: string;
  gmTipoVia?: string;
  gmNombreVia?: string;
  gmNumero?: string;
  gmCp?: string;
  gmDistrito?: string;
  gmBarrio?: string;
  gmLat?: number;
  gmLon?: number;
  defTipoVia?: string;
  defNombreVia?: string;
  defNumero?: string;
  defCp?: string;
  defDistrito?: string;
  defBarrio?: string;
  defLat?: number;
  defLon?: number;
  defCodDea?: string;
  dataVerificationStatus: string;
}

/**
 * Importador de registros DEA revisados desde CSV
 */
class DeaRevisadasImporter {
  private batchSize = 100;

  async importDeas() {
    console.log('🚀 Iniciando importación de registros DEA revisados...');
    
    try {
      // Leer y parsear el CSV
      const csvData = await this.parseCSV();
      console.log(`📊 Encontrados ${csvData.length} registros en el CSV`);
      
      // Procesar y validar datos
      const validRecords = this.processAndValidateData(csvData);
      console.log(`✅ ${validRecords.length} registros válidos para importar`);
      
      // Importar en lotes
      await this.importInBatches(validRecords);
      
      // Mostrar estadísticas
      await this.showImportStats();
      
      console.log('✅ Importación de DEAs revisados completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error durante la importación:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  private async parseCSV(): Promise<CSVRow[]> {
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'dea_revisadas.csv');
    
    if (!fs.existsSync(csvPath)) {
      throw new Error(`Archivo CSV no encontrado: ${csvPath}`);
    }

    let content: string;
    
    try {
      // Intentar UTF-8 primero
      content = fs.readFileSync(csvPath, 'utf8');
      
      // Verificar si hay caracteres de encoding incorrecto
      if (content.includes('�') || content.includes('Ã')) {
        console.log('⚠️ Detectado encoding incorrecto, intentando latin1...');
        content = fs.readFileSync(csvPath, 'latin1');
      }
    } catch {
      console.log('⚠️ Error leyendo con UTF-8, intentando latin1...');
      content = fs.readFileSync(csvPath, 'latin1');
    }
    
    // Remover BOM si existe
    if (content.charCodeAt(0) === 0xEF && content.charCodeAt(1) === 0xBB && content.charCodeAt(2) === 0xBF) {
      content = content.slice(3);
    }
    
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('El archivo CSV está vacío');
    }
    
    const headers = lines[0].split(';').map(h => h.trim().replace(/^ï»¿/, ''));
    const data: CSVRow[] = [];
    
    console.log(`📋 Headers encontrados: ${headers.length} columnas`);
    console.log(`📋 Primeras columnas: ${headers.slice(0, 10).join(', ')}`);
    
    // Identificar columnas que no se van a importar
    const excludedColumns = ['overall_status', 'recommended_actions'];
    const excludedFound = headers.filter(h => excludedColumns.includes(h));
    if (excludedFound.length > 0) {
      console.log(`⚠️ Columnas excluidas de la importación: ${excludedFound.join(', ')}`);
    }
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(';');
      const row: CSVRow = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      
      // Solo agregar filas que tengan al menos algunos datos
      if (this.hasMinimumData(row)) {
        data.push(row);
      }
    }
    
    return data;
  }

  private hasMinimumData(row: CSVRow): boolean {
    // Verificar que tenga al menos ID, tipo de establecimiento y coordenadas
    return !!(
      row['Id'] &&
      row['tipoEstablecimiento'] &&
      row['latitud'] &&
      row['longitud']
    );
  }

  private processAndValidateData(csvData: CSVRow[]): DeaRecordInput[] {
    const validRecords: DeaRecordInput[] = [];
    let skippedCount = 0;

    for (let i = 0; i < csvData.length; i++) {
      const row = csvData[i];
      
      try {
        const record = this.mapCsvToDeaRecord(row, i);
        
        if (this.validateRecord(record)) {
          validRecords.push(record);
        } else {
          skippedCount++;
          console.warn(`⚠️ Registro ${i + 1} (ID: ${row['Id']}) omitido por validación fallida`);
        }
      } catch (error) {
        skippedCount++;
        console.warn(`⚠️ Error procesando registro ${i + 1} (ID: ${row['Id']}):`, error);
      }
    }

    if (skippedCount > 0) {
      console.log(`⚠️ ${skippedCount} registros omitidos por errores de validación`);
    }

    return validRecords;
  }

  private mapCsvToDeaRecord(row: CSVRow, index: number): DeaRecordInput {
    // Parsear fechas
    const horaInicio = this.parseDate(row['horaInicio']);
    const horaFinalizacion = this.parseDate(row['horaFinalizacion']);
    
    if (!horaInicio || !horaFinalizacion) {
      throw new Error(`Fechas inválidas en registro ${index + 1}`);
    }

    // Parsear coordenadas
    const latitud = this.parseFloat(row['latitud']);
    const longitud = this.parseFloat(row['longitud']);
    
    if (!latitud || !longitud) {
      throw new Error(`Coordenadas inválidas en registro ${index + 1}`);
    }

    // Parsear código postal
    const codigoPostal = this.parseInt(row['codigoPostal']);
    if (!codigoPostal) {
        console.debug(row,row['codigoPostal']);
      throw new Error(`Código postal inválido en registro ${index + 1}`);
    }

    // Parsear número provisional DEA
    const numeroProvisionalDea = this.parseInt(row['numeroProvisionalDea']) || 0;

    // Parsear horarios
    const aperturaLunesViernes = this.parseInt(row['aperturaLunesViernes']) || 0;
    const cierreLunesViernes = this.parseInt(row['cierreLunesViernes']) || 0;
    const aperturaSabados = this.parseInt(row['aperturaSabados']) || 0;
    const cierreSabados = this.parseInt(row['cierreSabados']) || 0;
    const aperturaDomingos = this.parseInt(row['aperturaDomingos']) || 0;
    const cierreDomingos = this.parseInt(row['cierreDomingos']) || 0;

    // Parsear campos definitivos para determinar estado de verificación
    const defLat = this.parseFloat(row['defLat']);
    const defLon = this.parseFloat(row['defLon']);
    const defTipoVia = row['defTipoVia'];
    const defNombreVia = row['defNombreVia'];
    const defDistrito = row['defDistrito'];

    // Determinar estado de verificación
    const dataVerificationStatus = this.determineVerificationStatus(
      defLat, defLon, defTipoVia, defNombreVia, defDistrito
    );

    return {
      // Campos básicos
      horaInicio,
      horaFinalizacion,
      correoElectronico: row['correoElectronico'] || 'importacion@dea.madrid.es',
      nombre: row['nombre'] || `DEA ${numeroProvisionalDea || index + 1}`,
      numeroProvisionalDea,
      tipoEstablecimiento: row['tipoEstablecimiento'] || 'No especificado',
      titularidadLocal: row['titularidadLocal'] || 'No especificado',
      usoLocal: row['usoLocal'] || 'No especificado',
      titularidad: row['titularidad'] || 'No especificado',
      propuestaDenominacion: row['propuestaDenominacion'] || 'Sin denominación',
      
      // Campos de dirección
      tipoVia: row['tipoVia'] || 'Calle',
      nombreVia: row['nombreVia'] || 'Sin nombre',
      numeroVia: row['numeroVia'] || undefined,
      complementoDireccion: row['complementoDireccion'] || undefined,
      codigoPostal,
      distrito: row['distrito'] || 'No especificado',
      latitud,
      longitud,
      
      // Campos de horarios
      horarioApertura: row['horarioApertura'] || '24 horas',
      aperturaLunesViernes,
      cierreLunesViernes,
      aperturaSabados,
      cierreSabados,
      aperturaDomingos,
      cierreDomingos,
      vigilante24h: row['vigilante24h'] || 'No especificado',
      
      // Campos opcionales
      foto1: row['foto1'] || undefined,
      foto2: row['foto2'] || undefined,
      descripcionAcceso: row['descripcionAcceso'] || undefined,
      comentarioLibre: row['comentarioLibre'] || undefined,
      
      // Campos de Google Maps
      gmTipoVia: row['gmTipoVia'] || undefined,
      gmNombreVia: row['gmNombreVia'] || undefined,
      gmNumero: row['gmNumero'] || undefined,
      gmCp: row['gmCp'] || undefined,
      gmDistrito: row['gmDistrito'] || undefined,
      gmBarrio: row['gmBarrio'] || undefined,
      gmLat: this.parseFloat(row['gmLat']) || undefined,
      gmLon: this.parseFloat(row['gmLon']) || undefined,
      
      // Campos definitivos
      defTipoVia: row['defTipoVia'] || undefined,
      defNombreVia: row['defNombreVia'] || undefined,
      defNumero: row['defNumero'] || undefined,
      defCp: row['defCp'] || undefined,
      defDistrito: row['defDistrito'] || undefined,
      defBarrio: row['defBarrio'] || undefined,
      defLat: this.parseFloat(row['defLat']) || undefined,
      defLon: this.parseFloat(row['defLon']) || undefined,
      defCodDea: row['defCodDea'] || undefined,
      
      // Estado de verificación
      dataVerificationStatus,
    };
  }

  /**
   * Determina el estado de verificación basado en los datos definitivos
   */
  private determineVerificationStatus(
    defLat: number | null,
    defLon: number | null,
    defTipoVia: string | undefined,
    defNombreVia: string | undefined,
    defDistrito: string | undefined
  ): string {
    // Un DEA se considera pre-verificado si tiene:
    // - Coordenadas definitivas (defLat, defLon)
    // - Dirección definitiva (defTipoVia, defNombreVia)
    // - Distrito definitivo
    const hasDefinitiveCoordinates = defLat !== null && defLon !== null;
    const hasDefinitiveAddress = defTipoVia && defNombreVia && defTipoVia.trim() !== '' && defNombreVia.trim() !== '';
    const hasDefinitiveDistrict = defDistrito && defDistrito.trim() !== '';

    if (hasDefinitiveCoordinates && hasDefinitiveAddress && hasDefinitiveDistrict) {
      return 'pre_verified';
    }

    return 'pending';
  }

  private validateRecord(record: DeaRecordInput): boolean {
    // Validar coordenadas (rango aproximado para Madrid)
    if (record.latitud < 40.0 || record.latitud > 41.0) {
      console.warn(`Latitud fuera de rango para Madrid: ${record.latitud}`);
      return false;
    }
    
    if (record.longitud > -3.0 || record.longitud < -4.0) {
      console.warn(`Longitud fuera de rango para Madrid: ${record.longitud}`);
      return false;
    }

    // Validar código postal (Madrid: 28xxx)
    if (record.codigoPostal < 28000 || record.codigoPostal > 28999) {
      console.warn(`Código postal fuera de rango para Madrid: ${record.codigoPostal}`);
      return false;
    }

    // Validar campos obligatorios
    if (!record.tipoEstablecimiento || !record.nombreVia) {
      console.warn('Campos obligatorios faltantes');
      return false;
    }

    // // Validar fechas
    // if (record.horaInicio >= record.horaFinalizacion) {
    //   console.warn('Fecha de inicio debe ser anterior a fecha de finalización');
    //   return false;
    // }

    return true;
  }

  private async importInBatches(records: DeaRecordInput[]) {
    const batches = this.createBatches(records, this.batchSize);
    
    console.log(`📦 Importando ${records.length} registros en ${batches.length} lotes...`);
    
    const importedRecords: DeaRecordInput[] = [];
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        await prisma.deaRecord.createMany({
          data: batch,
          skipDuplicates: true,
        });
        
        // Agregar registros exitosos para crear validaciones después
        importedRecords.push(...batch);
        
        console.log(`✅ Lote ${i + 1}/${batches.length} importado (${batch.length} registros)`);
      } catch (error) {
        console.error(`❌ Error en lote ${i + 1}:`, error);
        
        // Intentar importar registros individualmente para identificar el problema
        for (const record of batch) {
          try {
            await prisma.deaRecord.create({ data: record });
            importedRecords.push(record);
          } catch (individualError) {
            console.error(`❌ Error en registro individual:`, {
              numeroProvisionalDea: record.numeroProvisionalDea,
              propuestaDenominacion: record.propuestaDenominacion,
              error: individualError
            });
          }
        }
      }
    }

    // Crear validaciones de direcciones para DEAs pre-verificados
    await this.createAddressValidationsForPreVerified(importedRecords);
  }

  /**
   * Crea registros de validación de direcciones para DEAs pre-verificados
   */
  private async createAddressValidationsForPreVerified(records: DeaRecordInput[]) {
    const preVerifiedRecords = records.filter(record => record.dataVerificationStatus === 'pre_verified');
    
    if (preVerifiedRecords.length === 0) {
      console.log('📝 No hay DEAs pre-verificados para crear validaciones de direcciones');
      return;
    }

    console.log(`📝 Creando validaciones de direcciones para ${preVerifiedRecords.length} DEAs pre-verificados...`);

    let createdValidations = 0;
    let skippedValidations = 0;

    for (const record of preVerifiedRecords) {
      try {
        // Buscar el DEA recién creado por número provisional
        const deaRecord = await prisma.deaRecord.findFirst({
          where: {
            numeroProvisionalDea: record.numeroProvisionalDea,
            dataVerificationStatus: 'pre_verified'
          }
        });

        if (!deaRecord) {
          console.warn(`⚠️ No se encontró DEA con número provisional ${record.numeroProvisionalDea}`);
          skippedValidations++;
          continue;
        }

        // Verificar si ya existe una validación para este DEA
        const existingValidation = await prisma.deaAddressValidation.findUnique({
          where: { deaRecordId: deaRecord.id }
        });

        if (existingValidation) {
          skippedValidations++;
          continue;
        }

        // Crear validación de dirección
        await prisma.deaAddressValidation.create({
          data: {
            deaRecordId: deaRecord.id,
            searchResults: [],
            validationDetails: {
              source: 'manual_import_script',
              verifiedBy: 'dea_revisadas_importer',
              verificationDate: new Date().toISOString(),
              confidence: 1.0,
              method: 'pre_verified_import',
              definitive_data: {
                defTipoVia: record.defTipoVia,
                defNombreVia: record.defNombreVia,
                defNumero: record.defNumero,
                defDistrito: record.defDistrito,
                defBarrio: record.defBarrio,
                defLat: record.defLat,
                defLon: record.defLon,
                defCp: record.defCp,
                defCodDea: record.defCodDea
              }
            },
            overallStatus: 'valid',
            recommendedActions: [],
            detectedNeighborhoodName: record.defBarrio || null,
            processingDurationMs: 0,
            searchStrategiesUsed: ['pre_verified_import'],
            validationVersion: '2.0',
            needsReprocessing: false,
            errorMessage: null,
            retryCount: 0
          }
        });

        createdValidations++;

      } catch (error) {
        console.error(`❌ Error creando validación para DEA ${record.numeroProvisionalDea}:`, error);
        skippedValidations++;
      }
    }

    console.log(`✅ Validaciones de direcciones creadas: ${createdValidations}`);
    if (skippedValidations > 0) {
      console.log(`⚠️ Validaciones omitidas: ${skippedValidations}`);
    }
  }

  private async showImportStats() {
    console.log('\n📊 ESTADÍSTICAS DE IMPORTACIÓN:');
    
    const totalCount = await prisma.deaRecord.count();
    console.log(`📋 Total de registros DEA: ${totalCount.toLocaleString()}`);
    
    // Estadísticas por tipo de establecimiento
    const tipoStats = await prisma.deaRecord.groupBy({
      by: ['tipoEstablecimiento'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });
    
    console.log('\n🏢 TOP 10 TIPOS DE ESTABLECIMIENTO:');
    tipoStats.forEach(stat => {
      console.log(`   ${stat.tipoEstablecimiento}: ${stat._count.id.toLocaleString()}`);
    });
    
    // Estadísticas por distrito
    const distritoStats = await prisma.deaRecord.groupBy({
      by: ['distrito'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      }
    });
    
    console.log('\n🏛️ REGISTROS POR DISTRITO:');
    distritoStats.forEach(stat => {
      console.log(`   ${stat.distrito}: ${stat._count.id.toLocaleString()}`);
    });
    
    // Verificar coordenadas válidas
    const coordenadasValidas = await prisma.deaRecord.count({
      where: {
        AND: [
          { latitud: { gte: 40.0, lte: 41.0 } },
          { longitud: { gte: -4.0, lte: -3.0 } }
        ]
      }
    });
    
    console.log(`\n🌍 Registros con coordenadas válidas: ${coordenadasValidas.toLocaleString()} (${((coordenadasValidas / totalCount) * 100).toFixed(1)}%)`);
    
    // Verificar registros con datos de Google Maps
    const conGoogleMaps = await prisma.deaRecord.count({
      where: {
        AND: [
          { gmLat: { not: null } },
          { gmLon: { not: null } }
        ]
      }
    });
    
    console.log(`🗺️ Registros con datos de Google Maps: ${conGoogleMaps.toLocaleString()} (${((conGoogleMaps / totalCount) * 100).toFixed(1)}%)`);
    
    // Verificar registros con datos definitivos
    const conDatosDefinitivos = await prisma.deaRecord.count({
      where: {
        AND: [
          { defLat: { not: null } },
          { defLon: { not: null } }
        ]
      }
    });
    
    console.log(`✅ Registros con datos definitivos: ${conDatosDefinitivos.toLocaleString()} (${((conDatosDefinitivos / totalCount) * 100).toFixed(1)}%)`);
  }

  // Funciones de utilidad
  private parseDate(value: string): Date | null {
    if (!value || value.trim() === '' || value === '\\N') return null;
    
    try {
      // Formato esperado: DD/MM/YYYY HH:mm
      const [datePart, timePart] = value.split(' ');
      const [day, month, year] = datePart.split('/');
      const [hour, minute] = (timePart || '00:00').split(':');
      
      const date = new Date(
        parseInt(year),
        parseInt(month) - 1, // Los meses en JS van de 0-11
        parseInt(day),
        parseInt(hour),
        parseInt(minute)
      );
      
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  private parseFloat(value: string): number | null {
    if (!value || value.trim() === '' || value === '\\N') return null;
    
    // Reemplazar coma por punto para decimales
    const cleanValue = value.replace(',', '.');
    const parsed = parseFloat(cleanValue);
    
    return isNaN(parsed) ? null : parsed;
  }

  private parseInt(value: string): number | null {
    if (!value || value.trim() === '' || value === '\\N') return null;
    
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }
}

// Ejecutar el script
async function main() {
  const importer = new DeaRevisadasImporter();
  await importer.importDeas();
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

export { DeaRevisadasImporter };
