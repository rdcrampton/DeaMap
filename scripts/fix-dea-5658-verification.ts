// Script para corregir las sesiones de verificación del DEA #5658
// Actualiza las sesiones canceladas a completadas

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDea5658Verification() {
  try {
    console.log('🔍 Buscando DEA con sesiones problemáticas...');
    
    // Primero buscar por el ID que vimos en los datos (10284)
    let deaRecord = await prisma.deaRecord.findUnique({
      where: {
        id: 10284
      }
    });

    if (!deaRecord) {
      console.log('🔍 No se encontró DEA con ID 10284, buscando por número provisional 5658...');
      // Buscar el DEA por número provisional como fallback
      deaRecord = await prisma.deaRecord.findFirst({
        where: {
          numeroProvisionalDea: 5658
        }
      });
    }

    if (!deaRecord) {
      console.log('❌ No se encontró el DEA');
      return;
    }

    console.log(`✅ DEA encontrado: ID ${deaRecord.id} - ${deaRecord.nombre} (DEA #${deaRecord.numeroProvisionalDea})`);

    // Buscar sesiones de verificación para este DEA
    const sessions = await prisma.verificationSession.findMany({
      where: {
        deaRecordId: deaRecord.id
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📋 Sesiones encontradas: ${sessions.length}`);
    
    for (const session of sessions) {
      console.log(`  - Sesión ${session.id}: status="${session.status}", step="${session.currentStep}"`);
    }

    // Buscar sesiones canceladas que deberían estar completadas
    const cancelledSessions = sessions.filter(s => s.status === 'cancelled');
    
    if (cancelledSessions.length === 0) {
      console.log('✅ No hay sesiones canceladas que corregir');
      return;
    }

    console.log(`🔧 Corrigiendo ${cancelledSessions.length} sesiones canceladas...`);

    // Actualizar las sesiones canceladas a completadas
    for (const session of cancelledSessions) {
      const updated = await prisma.verificationSession.update({
        where: {
          id: session.id
        },
        data: {
          status: 'completed',
          currentStep: 'completed',
          completedAt: session.completedAt || new Date()
        }
      });

      console.log(`  ✅ Sesión ${session.id} actualizada: ${session.status} → ${updated.status}`);
    }

    // Verificar el resultado
    const updatedSessions = await prisma.verificationSession.findMany({
      where: {
        deaRecordId: deaRecord.id
      }
    });

    const completedCount = updatedSessions.filter(s => s.status === 'completed').length;
    console.log(`\n🎉 Resultado final:`);
    console.log(`  - Total de sesiones: ${updatedSessions.length}`);
    console.log(`  - Sesiones completadas: ${completedCount}`);
    console.log(`  - DEA #5658 ahora debería estar marcado como verificado`);

  } catch (error) {
    console.error('❌ Error al corregir las sesiones:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar el script
if (require.main === module) {
  fixDea5658Verification()
    .then(() => {
      console.log('\n✅ Script completado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Error fatal:', error);
      process.exit(1);
    });
}

export { fixDea5658Verification };
