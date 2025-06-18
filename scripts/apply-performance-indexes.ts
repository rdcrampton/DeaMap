// Script to apply performance optimization indexes
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function applyIndexes() {
  console.log('🚀 Applying performance optimization indexes...\n');

  const indexes = [
    {
      name: 'idx_dea_records_foto1_not_null',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_records_foto1_not_null" 
            ON "dea_records" ("foto1") 
            WHERE "foto1" IS NOT NULL AND "foto1" != '';`
    },
    {
      name: 'idx_verification_sessions_status_dea_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_verification_sessions_status_dea_id" 
            ON "verification_sessions" ("status", "dea_record_id");`
    },
    {
      name: 'idx_dea_address_validations_status_dea_id',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_address_validations_status_dea_id" 
            ON "dea_address_validations" ("overall_status", "dea_record_id");`
    },
    {
      name: 'idx_dea_records_foto1_created_at',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_records_foto1_created_at" 
            ON "dea_records" ("foto1", "created_at" DESC) 
            WHERE "foto1" IS NOT NULL AND "foto1" != '';`
    },
    {
      name: 'idx_dea_address_validations_dea_record_id_status',
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_dea_address_validations_dea_record_id_status" 
            ON "dea_address_validations" ("dea_record_id", "overall_status");`
    }
  ];

  try {
    for (const index of indexes) {
      console.log(`📝 Creating index: ${index.name}`);
      
      try {
        await prisma.$executeRawUnsafe(index.sql);
        console.log(`✅ Successfully created: ${index.name}`);
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          console.log(`ℹ️  Index already exists: ${index.name}`);
        } else {
          console.error(`❌ Failed to create ${index.name}:`, error);
        }
      }
    }

    console.log('\n🔍 Verifying indexes...');
    const allIndexes = await prisma.$queryRaw`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename IN ('dea_records', 'dea_address_validations', 'verification_sessions')
      AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;

    console.log('📋 Performance indexes found:');
    console.log(allIndexes);

    console.log('\n✅ Index application completed!');
    
  } catch (error) {
    console.error('❌ Error applying indexes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

applyIndexes().catch(console.error);
