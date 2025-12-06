/**
 * Implementación del repositorio de exportación con Prisma
 * Capa de Infraestructura
 */

import { PrismaClient } from "@/generated/client/client";

import {
  IExportRepository,
  CreateExportBatchData,
  ExportBatchInfo,
  UpdateExportBatchData,
} from "@/domain/export/ports/IExportRepository";

export class PrismaExportRepository implements IExportRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createBatch(data: CreateExportBatchData): Promise<string> {
    const batch = await this.prisma.exportBatch.create({
      data: {
        name: data.name,
        description: data.description,
        filters: data.filters ? JSON.parse(JSON.stringify(data.filters)) : null,
        exported_by: data.exportedBy,
        ip_address: data.ipAddress,
        status: "PENDING",
      },
    });

    return batch.id;
  }

  async updateBatch(
    batchId: string,
    data: UpdateExportBatchData
  ): Promise<void> {
    await this.prisma.exportBatch.update({
      where: { id: batchId },
      data: {
        status: data.status as any,
        file_name: data.fileName,
        file_url: data.fileUrl,
        file_size: data.fileSize,
        file_hash: data.fileHash,
        total_records: data.totalRecords,
        successful_records: data.successfulRecords,
        failed_records: data.failedRecords,
        started_at: data.startedAt,
        completed_at: data.completedAt,
        duration_seconds: data.durationSeconds,
        error_message: data.errorMessage,
        error_details: data.errorDetails
          ? JSON.parse(JSON.stringify(data.errorDetails))
          : undefined,
      },
    });
  }

  async getBatchInfo(batchId: string): Promise<ExportBatchInfo | null> {
    const batch = await this.prisma.exportBatch.findUnique({
      where: { id: batchId },
    });

    if (!batch) {
      return null;
    }

    return {
      id: batch.id,
      name: batch.name,
      description: batch.description,
      filters: batch.filters as any,
      fileName: batch.file_name,
      fileUrl: batch.file_url,
      fileSize: batch.file_size,
      fileHash: batch.file_hash,
      totalRecords: batch.total_records,
      successfulRecords: batch.successful_records,
      failedRecords: batch.failed_records,
      status: batch.status,
      startedAt: batch.started_at,
      completedAt: batch.completed_at,
      durationSeconds: batch.duration_seconds,
      errorMessage: batch.error_message,
      exportedBy: batch.exported_by,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at,
    };
  }

  async listBatches(params: {
    page: number;
    limit: number;
    userId?: string;
  }): Promise<{
    batches: ExportBatchInfo[];
    total: number;
  }> {
    const { page, limit, userId } = params;
    const skip = (page - 1) * limit;

    const where = userId ? { exported_by: userId } : {};

    const [batches, total] = await Promise.all([
      this.prisma.exportBatch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: "desc" },
      }),
      this.prisma.exportBatch.count({ where }),
    ]);

    return {
      batches: batches.map((batch) => ({
        id: batch.id,
        name: batch.name,
        description: batch.description,
        filters: batch.filters as any,
        fileName: batch.file_name,
        fileUrl: batch.file_url,
        fileSize: batch.file_size,
        fileHash: batch.file_hash,
        totalRecords: batch.total_records,
        successfulRecords: batch.successful_records,
        failedRecords: batch.failed_records,
        status: batch.status,
        startedAt: batch.started_at,
        completedAt: batch.completed_at,
        durationSeconds: batch.duration_seconds,
        errorMessage: batch.error_message,
        exportedBy: batch.exported_by,
        createdAt: batch.created_at,
        updatedAt: batch.updated_at,
      })),
      total,
    };
  }

  async deleteBatch(batchId: string): Promise<void> {
    await this.prisma.exportBatch.delete({
      where: { id: batchId },
    });
  }
}
