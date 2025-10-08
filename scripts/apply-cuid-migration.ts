import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('🔄 Reading migration file...');
    const migrationPath = path.join(
      __dirname,
      '../prisma/migrations/20250108172000_change_verification_ids_to_cuid/migration.sql'
    );
    
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('📝 Splitting migration into individual statements...');
    
    // Remove comments first (lines starting with --)
    const sqlWithoutComments = migrationSQL
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    // Split SQL into individual statements
    const statements = sqlWithoutComments
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} statements to execute\n`);
    
    // Execute each statement individually
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`${i + 1}/${statements.length}: Executing...`);
        console.log(statement.substring(0, 100) + '...\n');
        await prisma.$executeRawUnsafe(statement);
      }
    }
    
    console.log('✅ All migration statements applied successfully!');
    
    // Mark migration as applied in _prisma_migrations table
    await prisma.$executeRaw`
      INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES (
        gen_random_uuid()::text,
        '',
        NOW(),
        '20250108172000_change_verification_ids_to_cuid',
        '',
        NULL,
        NOW(),
        1
      )
      ON CONFLICT DO NOTHING;
    `;
    
    console.log('✅ Migration recorded in database');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .then(() => {
    console.log('\n✅ Done! Now regenerating Prisma Client...');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });
