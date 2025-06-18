import { NextRequest, NextResponse } from 'next/server';
import { uploadImageToS3, validateImageFile } from '@/services/s3Service';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No se proporcionó ningún archivo' },
        { status: 400 }
      );
    }

    // Validar el archivo
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Obtener el prefijo del nombre del archivo (foto1 o foto2)
    const prefix = formData.get('prefix') as string || 'dea-foto';

    // Subir a S3
    const result = await uploadImageToS3(file, prefix);

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
    });

  } catch (error) {
    console.error('Error en upload:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al subir la imagen' },
      { status: 500 }
    );
  }
}
