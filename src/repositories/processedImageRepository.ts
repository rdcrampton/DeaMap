import { prisma } from '@/lib/db';
import type { ProcessedImage, ImageType } from '@/types/verification';

export interface IProcessedImageRepository {
  findBySessionId(sessionId: string): Promise<ProcessedImage[]>;
  create(data: Omit<ProcessedImage, 'id' | 'createdAt'>): Promise<ProcessedImage>;
  update(id: string, data: Partial<ProcessedImage>): Promise<ProcessedImage>;
  delete(id: string): Promise<ProcessedImage>;
  deleteBySessionId(sessionId: string): Promise<void>;
  findByType(sessionId: string, imageType: ImageType): Promise<ProcessedImage | null>;
}

export class ProcessedImageRepository implements IProcessedImageRepository {
  async findBySessionId(sessionId: string): Promise<ProcessedImage[]> {
    const images = await prisma.processedImage.findMany({
      where: { verificationSessionId: sessionId },
      orderBy: { createdAt: 'asc' }
    });

    return images.map(this.mapToProcessedImage);
  }

  async create(data: Omit<ProcessedImage, 'id' | 'createdAt'>): Promise<ProcessedImage> {
    const image = await prisma.processedImage.create({
      data: {
        verificationSessionId: data.verificationSessionId,
        originalFilename: data.originalFilename,
        processedFilename: data.processedFilename,
        imageType: data.imageType,
        fileSize: data.fileSize,
        dimensions: data.dimensions
      }
    });

    return this.mapToProcessedImage(image);
  }

  async update(id: string, data: Partial<ProcessedImage>): Promise<ProcessedImage> {
    const updateData: Record<string, unknown> = {};
    
    if (data.originalFilename !== undefined) updateData.originalFilename = data.originalFilename;
    if (data.processedFilename !== undefined) updateData.processedFilename = data.processedFilename;
    if (data.imageType !== undefined) updateData.imageType = data.imageType;
    if (data.fileSize !== undefined) updateData.fileSize = data.fileSize;
    if (data.dimensions !== undefined) updateData.dimensions = data.dimensions;

    const image = await prisma.processedImage.update({
      where: { id },
      data: updateData
    });

    return this.mapToProcessedImage(image);
  }

  async delete(id: string): Promise<ProcessedImage> {
    const image = await prisma.processedImage.delete({
      where: { id }
    });

    return this.mapToProcessedImage(image);
  }

  async deleteBySessionId(sessionId: string): Promise<void> {
    await prisma.processedImage.deleteMany({
      where: { verificationSessionId: sessionId }
    });
  }

  async findByType(sessionId: string, imageType: ImageType): Promise<ProcessedImage | null> {
    const image = await prisma.processedImage.findFirst({
      where: { 
        verificationSessionId: sessionId,
        imageType: imageType
      },
      orderBy: { createdAt: 'desc' }
    });

    return image ? this.mapToProcessedImage(image) : null;
  }

  private mapToProcessedImage(image: Record<string, unknown>): ProcessedImage {
    return {
      id: image.id as string,
      verificationSessionId: image.verificationSessionId as string,
      originalFilename: image.originalFilename as string,
      processedFilename: image.processedFilename as string,
      imageType: image.imageType as ImageType,
      fileSize: image.fileSize as number,
      dimensions: image.dimensions as string,
      createdAt: (image.createdAt as Date).toISOString()
    };
  }
}
