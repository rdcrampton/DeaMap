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
}

/**
 * Importador de registros DEA desde CSV provisional
 */
class DeaImporter {
  private batchSize = 50;
  private defaultStartTime = new Date('2024-01-01T09:00:00Z');
  private defaultEndTime = new Date('2024-01-01T18:00:00Z');

  async importDeas() {
    console.log('🚀 Iniciando importación de registros DEA...');
    
    try {
      // Leer y parsear el CSV
      const csvData = await this.parseCSV();
      console.log(`📊 Encontrados ${csvData.length} registros en el CSV`);
      
      // Limpiar registros existentes (opcional - comentar si no se desea)
      // await this.clearExistingDeas();
      
      // Procesar y validar datos
      const validRecords = this.processAndValidateData(csvData);
      console.log(`✅ ${validRecords.length} registros válidos para importar`);
      
      // Importar en lotes
      await this.importInBatches(validRecords);
      
      // Mostrar estadísticas
      await this.showImportStats();
      
      console.log('✅ Importación de DEAs completada exitosamente');
      
    } catch (error) {
      console.error('❌ Error durante la importación:', error);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }

  private async parseCSV(): Promise<CSVRow[]> {
    const csvPath = path.join(process.cwd(), 'data', 'CSV', 'dea provisional.csv');
    
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
    
    console.log(`📋 Headers encontrados: ${headers.join(', ')}`);
    
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
    // Verificar que tenga al menos tipo de establecimiento y coordenadas
    return !!(
      row['Tipo de establecimiento'] &&
      row['Coordenadas-Latitud (norte)'] &&
      row['Coordenadas-Longitud (oeste, por lo tanto, negativa)']
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
          console.warn(`⚠️ Registro ${i + 1} omitido por validación fallida`);
        }
      } catch (error) {
        skippedCount++;
        console.warn(`⚠️ Error procesando registro ${i + 1}:`, error);
      }
    }

    if (skippedCount > 0) {
      console.log(`⚠️ ${skippedCount} registros omitidos por errores de validación`);
    }

    return validRecords;
  }

  private mapCsvToDeaRecord(row: CSVRow, index: number): DeaRecordInput {
    // Parsear coordenadas
    const latitud = this.parseFloat(row['Coordenadas-Latitud (norte)']);
    const longitud = this.parseFloat(row['Coordenadas-Longitud (oeste, por lo tanto, negativa)']);
    
    if (!latitud || !longitud) {
      throw new Error(`Coordenadas inválidas en registro ${index + 1}`);
    }

    // Parsear código postal
    const codigoPostal = this.parseInt(row['Código postal']);
    if (!codigoPostal) {
      throw new Error(`Código postal inválido en registro ${index + 1}`);
    }

    // Parsear número provisional DEA (puede estar vacío)
    const numeroProvisionalDea = this.parseInt(row['Número provisional DEA']) || 0;

    // Generar valores por defecto para campos obligatorios faltantes
    const now = new Date();
    const horaInicio = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Ayer
    const horaFinalizacion = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Mañana

    return {
      // Campos del CSV
      numeroProvisionalDea,
      tipoEstablecimiento: row['Tipo de establecimiento'] || 'No especificado',
      titularidadLocal: row['Titularidad del local'] || 'No especificado',
      usoLocal: row['Uso del local'] || 'No especificado',
      titularidad: row['Titularidad'] || 'No especificado',
      propuestaDenominacion: row['Propuesta de denominación'] || 'Sin denominación',
      tipoVia: row['Tipo de vía'] || 'Calle',
      nombreVia: row['Nombre de la vía'] || 'Sin nombre',
      numeroVia: row['Número de la vía'] || undefined,
      complementoDireccion: row['Complemento de dirección'] || undefined,
      codigoPostal,
      distrito: row['Distrito'] || 'No especificado',
      latitud,
      longitud,
      
      // Campos con valores por defecto
      horaInicio,
      horaFinalizacion,
      correoElectronico: 'importacion@dea.madrid.es',
      nombre: `DEA ${numeroProvisionalDea || index + 1}`,
      horarioApertura: '24/7',
      aperturaLunesViernes: 0,
      cierreLunesViernes: 2359,
      aperturaSabados: 0,
      cierreSabados: 2359,
      aperturaDomingos: 0,
      cierreDomingos: 2359,
      vigilante24h: 'No especificado',
      
      // Campos opcionales
      foto1: undefined,
      foto2: undefined,
      descripcionAcceso: row['Complemento de dirección'] || undefined,
      comentarioLibre: `Importado desde CSV provisional - Fila ${index + 1}`,
    };
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

    return true;
  }

  private async importInBatches(records: DeaRecordInput[]) {
    const batches = this.createBatches(records, this.batchSize);
    
    console.log(`📦 Importando ${records.length} registros en ${batches.length} lotes...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      
      try {
        await prisma.deaRecord.createMany({
          data: batch,
          skipDuplicates: true,
        });
        
        console.log(`✅ Lote ${i + 1}/${batches.length} importado (${batch.length} registros)`);
      } catch (error) {
        console.error(`❌ Error en lote ${i + 1}:`, error);
        
        // Intentar importar registros individualmente para identificar el problema
        for (const record of batch) {
          try {
            await prisma.deaRecord.create({ data: record });
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
  }

  private async clearExistingDeas() {
    console.log('🧹 Limpiando registros DEA existentes...');
    
    const deleteResult = await prisma.deaRecord.deleteMany();
    console.log(`✅ ${deleteResult.count} registros eliminados`);
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
      }
    });
    
    console.log('\n🏢 REGISTROS POR TIPO DE ESTABLECIMIENTO:');
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
  }

  // Funciones de utilidad
  private parseFloat(value: string): number | null {
    if (!value || value.trim() === '') return null;
    
    // Reemplazar coma por punto para decimales
    const cleanValue = value.replace(',', '.');
    const parsed = parseFloat(cleanValue);
    
    return isNaN(parsed) ? null : parsed;
  }

  private parseInt(value: string): number | null {
    if (!value || value.trim() === '') return null;
    
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
  const importer = new DeaImporter();
  await importer.importDeas();
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main().catch(console.error);
}

export { DeaImporter };
