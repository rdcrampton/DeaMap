import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadToS3 } from "@/lib/s3";
import { buildImageKey, extractExtension } from "@/lib/s3-utils";
import { processVerificationImages, type ImageToProcess } from "@/lib/imageProcessing";
import type { ProcessedImageData } from "@/types/verification";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id } = await params;

    // Find the active validation
    const validation = await prisma.aedValidation.findFirst({
      where: {
        aed_id: id,
        status: "IN_PROGRESS",
      },
      include: {
        aed: {
          include: {
            images: true,
          },
        },
      },
    });

    if (!validation) {
      return NextResponse.json({ error: "Sesión de verificación no encontrada" }, { status: 404 });
    }

    console.log('🔄 Iniciando procesamiento de imágenes...');

    // Extraer datos de procesamiento
    const validationData = validation.data as any;
    const processedImages: ProcessedImageData[] = validationData?.processed_images || [];

    console.log(`📋 Imágenes a procesar: ${processedImages.length}`);

    // Procesar cada imagen
    const imagesToProcess: ImageToProcess[] = [];

    for (const processedImg of processedImages) {
      // Buscar la imagen en la BD
      const imageRecord = validation.aed.images.find(img => img.id === processedImg.image_id);

      if (!imageRecord) {
        console.warn(`⚠️ Imagen ${processedImg.image_id} no encontrada en BD`);
        continue;
      }

      imagesToProcess.push({
        imageId: processedImg.image_id,
        originalUrl: imageRecord.original_url,
        cropData: processedImg.crop_data,
        blurAreas: processedImg.blur_areas,
        arrowData: processedImg.arrow_data,
      });
    }

    // Procesar todas las imágenes
    const processedBuffers = await processVerificationImages(imagesToProcess);

    console.log(`✅ ${processedBuffers.size} imágenes procesadas`);

    // Subir imágenes procesadas a S3 y actualizar BD
    for (const [imageId, buffer] of processedBuffers) {
      const imageRecord = validation.aed.images.find(img => img.id === imageId);
      if (!imageRecord) continue;

      // Generar key para imagen procesada
      const extension = extractExtension(imageRecord.original_url);
      const processedKey = buildImageKey(id, imageId, 'processed', extension);

      // Subir a S3
      console.log(`☁️ Subiendo ${imageId} a S3...`);
      const processedUrl = await uploadToS3({
        buffer,
        filename: processedKey,
        contentType: 'image/jpeg',
        prefix: id, // Usar AED ID como prefix
      });

      // Actualizar registro de imagen
      await prisma.aedImage.update({
        where: { id: imageId },
        data: {
          processed_url: processedUrl,
          updated_at: new Date(),
        },
      });

      console.log(`✅ Imagen ${imageId} guardada: ${processedUrl}`);
    }

    // Update validation status to COMPLETED
    const updatedValidation = await prisma.aedValidation.update({
      where: { id: validation.id },
      data: {
        status: "COMPLETED",
        completed_at: new Date(),
        result: {
          completed_by: user.userId,
          completed_at: new Date(),
          processed_images_count: processedBuffers.size,
        },
      },
    });

    // Update AED status to PUBLISHED
    await prisma.aed.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        updated_by: user.userId,
      },
    });

    console.log('🎉 Verificación completada exitosamente');

    return NextResponse.json(updatedValidation);
  } catch (error) {
    console.error("Error completing verification:", error);
    return NextResponse.json({
      error: "Error al completar verificación",
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
