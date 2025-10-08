import { prisma } from '../src/lib/db';

async function applyImageSelectionMigration() {
  console.log('🚀 Starting image selection fields migration...');
  
  try {
    // Verificar si las columnas ya existen
    console.log('📋 Checking if columns already exist...');
    
    try {
      await prisma.$queryRaw`
        SELECT image1_valid, image2_valid, images_swapped, marked_as_invalid 
        FROM verification_sessions 
        LIMIT 1
      `;
      console.log('✅ Columns already exist, skipping migration');
      return;
    } catch {
      console.log('📝 Columns do not exist, proceeding with migration...');
    }

    // Aplicar la migración
    console.log('🔧 Adding new columns to verification_sessions table...');
    
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "verification_sessions" 
      ADD COLUMN "image1_valid" BOOLEAN,
      ADD COLUMN "image2_valid" BOOLEAN,
      ADD COLUMN "images_swapped" BOOLEAN,
      ADD COLUMN "marked_as_invalid" BOOLEAN NOT NULL DEFAULT false
    `);

    console.log('✅ Migration applied successfully!');

    // Verificar que las columnas se crearon correctamente
    console.log('🔍 Verifying migration...');
    
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'verification_sessions'
      AND column_name IN ('image1_valid', 'image2_valid', 'images_swapped', 'marked_as_invalid')
      ORDER BY column_name
    `;
    
    console.log('📊 New columns:', result);
    console.log('✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error applying migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la migración
applyImageSelectionMigration()
  .then(() => {
    console.log('🎉 Migration process completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Migration process failed:', error);
    process.exit(1);
  });
