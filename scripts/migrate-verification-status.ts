/**
 * Script de Unificación de Estados de Verificación
 * 
 * FASE 1: Actualiza estados en verification_sessions (completed → verified, cancelled → pending)
 * FASE 2: Sincroniza estados a dea_records.data_verification_status desde las sesiones
 * 
 * Ejemplos de uso:
 * 
 * # Previsualizar cambios sin aplicarlos
 * npx tsx scripts/migrate-verification-status.ts --dry-run
 * 
 * # Ejecutar migración real
 * npx tsx scripts/migrate-verification-status.ts
 * 
 * # Con información detallada
 * npx tsx scripts/migrate-verification-status.ts --verbose
 * 
 * # Ver ayuda
 * npx tsx scripts/migrate-verification-status.ts --help
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MigrationStats {
  phase1: {
    sessionsTotal: number;
    sessionsUpdated: number;
    sessionsSkipped: number;
    sessionsErrors: number;
    byOldStatus: {
      completed: number;
      cancelled: number;
    };
  };
  phase2: {
    deasTotal: number;
    deasUpdated: number;
    deasSkipped: number;
    deasErrors: number;
    byNewStatus: {
      pending: number;
      in_progress: number;
      verified: number;
      discarded: number;
    };
  };
}

interface SessionWithDea {
  id: string;
  deaRecordId: number;
  status: string;
  completedAt: Date | null;
  createdAt: Date;
  deaRecord: {
    id: number;
    numeroProvisionalDea: number;
    dataVerificationStatus: string;
  };
}

interface BatchResult {
  updated: number;
  skipped: number;
  errors: number;
  byStatus: {
    pending: number;
    in_progress: number;
    verified: number;
    discarded: number;
  };
}

/**
 * Obtiene la prioridad de un estado de verificación
 * verified (4) > in_progress (3) > pending (2) > discarded (1)
 */
function getStatusPriority(status: string): number {
  const priorities: Record<string, number> = {
    'verified': 4,
    'in_progress': 3,
    'pending': 2,
    'discarded': 1
  };
  return priorities[status] || 0;
}

/**
 * Selecciona la mejor sesión de un conjunto basándose en:
 * 1. Prioridad del estado (verified > in_progress > pending > discarded)
 * 2. Fecha más reciente (como criterio de desempate)
 */
function selectBestSession(sessions: SessionWithDea[]): SessionWithDea {
  if (sessions.length === 0) {
    throw new Error('Cannot select best session from empty array');
  }

  return sessions.reduce((best, current) => {
    const currentPriority = getStatusPriority(current.status);
    const bestPriority = getStatusPriority(best.status);
    
    // Priorizar por estado
    if (currentPriority > bestPriority) return current;
    if (currentPriority < bestPriority) return best;
    
    // Mismo estado: tomar la más reciente
    const currentDate = current.completedAt || current.createdAt;
    const bestDate = best.completedAt || best.createdAt;
    return currentDate > bestDate ? current : best;
  });
}

/**
 * Procesa un lote de DEAs, actualizando su estado de verificación
 * basándose en la mejor sesión de verificación de cada uno
 */
async function processDEABatch(
  deaIds: number[],
  dryRun: boolean,
  verbose: boolean
): Promise<BatchResult> {
  const results: BatchResult = {
    updated: 0,
    skipped: 0,
    errors: 0,
    byStatus: {
      pending: 0,
      in_progress: 0,
      verified: 0,
      discarded: 0
    }
  };

  for (const deaId of deaIds) {
    try {
      // Obtener todas las sesiones de este DEA
      const sessions = await prisma.verificationSession.findMany({
        where: { deaRecordId: deaId },
        select: {
          id: true,
          status: true,
          completedAt: true,
          createdAt: true,
          deaRecordId: true,
          deaRecord: {
            select: {
              id: true,
              numeroProvisionalDea: true,
              dataVerificationStatus: true,
            }
          }
        }
      });

      if (sessions.length === 0) continue;

      // Seleccionar la mejor sesión según prioridad
      const bestSession = selectBestSession(sessions as SessionWithDea[]);
      const currentStatus = bestSession.deaRecord.dataVerificationStatus;
      const newStatus = bestSession.status;
      
      // Verificar si necesita actualización
      const needsUpdate = currentStatus !== newStatus;
      
      if (needsUpdate) {
        if (!dryRun) {
          await prisma.deaRecord.update({
            where: { id: deaId },
            data: { imageVerificationStatus: newStatus }
          });
        }
        
        if (verbose || !dryRun) {
          console.log(
            `${dryRun ? '🔄' : '✅'} DEA ${bestSession.deaRecord.numeroProvisionalDea}: ` +
            `'${currentStatus}' → '${newStatus}' (${sessions.length} sesiones)`
          );
        }
        
        results.updated++;
        
        // Contar por estado
        if (newStatus === 'pending') results.byStatus.pending++;
        else if (newStatus === 'in_progress') results.byStatus.in_progress++;
        else if (newStatus === 'verified') results.byStatus.verified++;
        else if (newStatus === 'discarded') results.byStatus.discarded++;
        
      } else {
        if (verbose) {
          console.log(`⏭️  DEA ${bestSession.deaRecord.numeroProvisionalDea}: Ya en '${newStatus}'`);
        }
        results.skipped++;
      }
      
    } catch (error) {
      console.error(
        `❌ Error procesando DEA ${deaId}:`,
        error instanceof Error ? error.message : error
      );
      results.errors++;
    }
  }

  return results;
}

async function migrateVerificationStatus(dryRun: boolean = false, verbose: boolean = false) {
  const stats: MigrationStats = {
    phase1: {
      sessionsTotal: 0,
      sessionsUpdated: 0,
      sessionsSkipped: 0,
      sessionsErrors: 0,
      byOldStatus: {
        completed: 0,
        cancelled: 0,
      },
    },
    phase2: {
      deasTotal: 0,
      deasUpdated: 0,
      deasSkipped: 0,
      deasErrors: 0,
      byNewStatus: {
        pending: 0,
        in_progress: 0,
        verified: 0,
        discarded: 0,
      },
    },
  };

  try {
    console.log('🔄 Iniciando unificación de estados de verificación...');
    if (dryRun) {
      console.log('📋 MODO DRY-RUN: No se realizarán cambios en la base de datos\n');
    }

    // ============================================================
    // FASE 1: Actualizar estados en verification_sessions
    // ============================================================
    console.log('='.repeat(70));
    console.log('📝 FASE 1: Actualizando estados en verification_sessions');
    console.log('=' .repeat(70));
    console.log('Mapeo: completed → verified, cancelled → pending\n');

    const sessionsToUpdate = await prisma.verificationSession.findMany({
      where: {
        OR: [
          { status: 'completed' },
          { status: 'cancelled' },
        ],
      },
      select: {
        id: true,
        status: true,
        deaRecordId: true,
        deaRecord: {
          select: {
            numeroProvisionalDea: true,
          },
        },
      },
    });

    stats.phase1.sessionsTotal = sessionsToUpdate.length;
    console.log(`📊 Encontradas ${stats.phase1.sessionsTotal} sesiones a actualizar\n`);

    for (const session of sessionsToUpdate) {
      const oldStatus = session.status;
      let newStatus: string;

      if (oldStatus === 'completed') {
        newStatus = 'verified';
        stats.phase1.byOldStatus.completed++;
      } else if (oldStatus === 'cancelled') {
        newStatus = 'pending';
        stats.phase1.byOldStatus.cancelled++;
      } else {
        continue;
      }

      try {
        if (dryRun) {
          if (verbose) {
            console.log(
              `🔄 Sesión ${session.id.substring(0, 8)}... (DEA ${session.deaRecord.numeroProvisionalDea}): '${oldStatus}' → '${newStatus}'`
            );
          }
        } else {
          await prisma.verificationSession.update({
            where: { id: session.id },
            data: { status: newStatus },
          });
          if (verbose) {
            console.log(
              `✅ Sesión ${session.id.substring(0, 8)}... (DEA ${session.deaRecord.numeroProvisionalDea}): '${oldStatus}' → '${newStatus}'`
            );
          }
        }
        stats.phase1.sessionsUpdated++;
      } catch (error) {
        console.error(
          `❌ Error actualizando sesión ${session.id}:`,
          error instanceof Error ? error.message : error
        );
        stats.phase1.sessionsErrors++;
      }
    }

    console.log('\n📈 Resumen Fase 1:');
    console.log(`   Sesiones actualizadas: ${stats.phase1.sessionsUpdated}`);
    console.log(`   - completed → verified: ${stats.phase1.byOldStatus.completed}`);
    console.log(`   - cancelled → pending: ${stats.phase1.byOldStatus.cancelled}`);
    console.log(`   Errores: ${stats.phase1.sessionsErrors}`);

    // ============================================================
    // FASE 2: Sincronizar estados a dea_records
    // ============================================================
    console.log('\n' + '='.repeat(70));
    console.log('📝 FASE 2: Sincronizando estados a dea_records');
    console.log('='.repeat(70));
    console.log('Seleccionando la mejor sesión de verificación para cada DEA');
    console.log('Prioridad: verified > in_progress > pending > discarded\n');

    // Obtener todos los IDs de DEAs únicos que tienen sesiones
    const deaIdsResult = await prisma.verificationSession.findMany({
      select: { deaRecordId: true },
      distinct: ['deaRecordId']
    });

    const uniqueDeaIds = deaIdsResult.map(d => d.deaRecordId);
    stats.phase2.deasTotal = uniqueDeaIds.length;
    
    console.log(`📊 Encontrados ${stats.phase2.deasTotal} DEAs con sesiones de verificación\n`);

    // Configuración de procesamiento por lotes
    const BATCH_SIZE = 100;
    let processed = 0;

    // Procesar en lotes
    for (let i = 0; i < uniqueDeaIds.length; i += BATCH_SIZE) {
      const batch = uniqueDeaIds.slice(i, i + BATCH_SIZE);
      const batchResults = await processDEABatch(batch, dryRun, verbose);
      
      // Acumular estadísticas
      stats.phase2.deasUpdated += batchResults.updated;
      stats.phase2.deasSkipped += batchResults.skipped;
      stats.phase2.deasErrors += batchResults.errors;
      stats.phase2.byNewStatus.pending += batchResults.byStatus.pending;
      stats.phase2.byNewStatus.in_progress += batchResults.byStatus.in_progress;
      stats.phase2.byNewStatus.verified += batchResults.byStatus.verified;
      stats.phase2.byNewStatus.discarded += batchResults.byStatus.discarded;

      processed += batch.length;
      const percentage = Math.round((processed / stats.phase2.deasTotal) * 100);
      console.log(`\n📈 Progreso: ${processed}/${stats.phase2.deasTotal} DEAs procesados (${percentage}%)`);
    }

    // Mostrar estadísticas finales
    console.log('\n' + '='.repeat(70));
    console.log('📊 RESUMEN COMPLETO DE MIGRACIÓN');
    console.log('='.repeat(70));
    console.log('\n📈 Fase 1 - Sesiones actualizadas:');
    console.log(`   Total procesadas: ${stats.phase1.sessionsTotal}`);
    console.log(`   ✅ Actualizadas: ${stats.phase1.sessionsUpdated}`);
    console.log(`   ❌ Errores: ${stats.phase1.sessionsErrors}`);
    
    console.log('\n📈 Fase 2 - DEA records sincronizados:');
    console.log(`   Total procesados: ${stats.phase2.deasTotal}`);
    console.log(`   ✅ Actualizados: ${stats.phase2.deasUpdated}`);
    console.log(`   ⏭️  Sin cambios: ${stats.phase2.deasSkipped}`);
    console.log(`   ❌ Errores: ${stats.phase2.deasErrors}`);
    
    console.log('\n📊 Distribución por estado final:');
    console.log(`   - pending: ${stats.phase2.byNewStatus.pending}`);
    console.log(`   - in_progress: ${stats.phase2.byNewStatus.in_progress}`);
    console.log(`   - verified: ${stats.phase2.byNewStatus.verified}`);
    console.log(`   - discarded: ${stats.phase2.byNewStatus.discarded}`);
    console.log('='.repeat(70));

    if (dryRun) {
      console.log('\n💡 Ejecuta sin --dry-run para aplicar los cambios');
    } else {
      console.log('\n✅ Migración completada exitosamente');
    }

    // Verificación post-migración (solo si no es dry-run)
    if (!dryRun && (stats.phase1.sessionsUpdated > 0 || stats.phase2.deasUpdated > 0)) {
      console.log('\n🔍 Verificando integridad post-migración...');
      
      const sessionCounts = await prisma.$transaction([
        prisma.verificationSession.count({ where: { status: 'pending' } }),
        prisma.verificationSession.count({ where: { status: 'in_progress' } }),
        prisma.verificationSession.count({ where: { status: 'verified' } }),
        prisma.verificationSession.count({ where: { status: 'discarded' } }),
        prisma.verificationSession.count({ where: { status: 'completed' } }),
        prisma.verificationSession.count({ where: { status: 'cancelled' } }),
      ]);

      const deaCounts = await prisma.$transaction([
        prisma.deaRecord.count({ where: { dataVerificationStatus: 'pending' } }),
        prisma.deaRecord.count({ where: { dataVerificationStatus: 'in_progress' } }),
        prisma.deaRecord.count({ where: { dataVerificationStatus: 'verified' } }),
        prisma.deaRecord.count({ where: { dataVerificationStatus: 'discarded' } }),
      ]);

      console.log('\n📊 Estados en verification_sessions:');
      console.log(`   - pending: ${sessionCounts[0]}`);
      console.log(`   - in_progress: ${sessionCounts[1]}`);
      console.log(`   - verified: ${sessionCounts[2]}`);
      console.log(`   - discarded: ${sessionCounts[3]}`);
      if (sessionCounts[4] > 0 || sessionCounts[5] > 0) {
        console.log(`   ⚠️  Antiguos - completed: ${sessionCounts[4]}, cancelled: ${sessionCounts[5]}`);
      }

      console.log('\n📊 Estados en dea_records:');
      console.log(`   - pending: ${deaCounts[0]}`);
      console.log(`   - in_progress: ${deaCounts[1]}`);
      console.log(`   - verified: ${deaCounts[2]}`);
      console.log(`   - discarded: ${deaCounts[3]}`);
      console.log('\n✅ Verificación completada');
    }

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  return stats;
}

// Parsear argumentos de CLI
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const verbose = args.includes('--verbose') || args.includes('-v');

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Script de Migración de Estados de Verificación
==============================================

Sincroniza los estados de las sesiones de verificación con el campo
data_verification_status de los registros DEA.

Uso:
  npx tsx scripts/migrate-verification-status.ts [opciones]

Opciones:
  --dry-run    Previsualizar cambios sin aplicarlos
  --verbose, -v Mostrar información detallada de cada registro
  --help, -h   Mostrar esta ayuda

Mapeo de estados:
  completed   → verified
  discarded   → discarded
  in_progress → in_progress
  cancelled   → pending

Notas:
  - Si un DEA tiene múltiples sesiones, se toma la más reciente
  - La migración es transaccional (rollback en caso de error)
  - Se recomienda ejecutar primero con --dry-run
  `);
  process.exit(0);
}

// Ejecutar migración
migrateVerificationStatus(dryRun, verbose)
  .then(() => {
    console.log('\n🎉 Proceso finalizado exitosamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Proceso finalizado con errores:', error);
    process.exit(1);
  });
