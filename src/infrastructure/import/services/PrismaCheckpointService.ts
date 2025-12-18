/**
 * Implementación del servicio de checkpoints con Prisma
 * Capa de Infraestructura - Implementa ICheckpointService
 */

import { createHash } from "crypto";
import type { PrismaClient } from "@/generated/client/client";
import type { ICheckpointService } from "@/domain/import/ports/ICheckpointService";
import type { CheckpointData, CheckpointStats } from "@/domain/import/value-objects/CheckpointData";

export class PrismaCheckpointService implements ICheckpointService {
  constructor(private readonly prisma: PrismaClient) {}

  async save(checkpoint: CheckpointData): Promise<void> {
    const recordHash = checkpoint.recordData
      ? this.generateHash(checkpoint.recordData)
      : checkpoint.contentHash;

    await this.prisma.importCheckpoint.upsert({
      where: {
        import_batch_id_record_index: {
          import_batch_id: checkpoint.batchId,
          record_index: checkpoint.recordIndex,
        },
      },
      create: {
        import_batch_id: checkpoint.batchId,
        record_index: checkpoint.recordIndex,
        record_reference: checkpoint.recordReference,
        record_hash: recordHash,
        status: checkpoint.status,
        error_message: checkpoint.errorMessage,
        processing_time_ms: checkpoint.processingTimeMs,
        record_data: checkpoint.recordData as object,
      },
      update: {
        record_reference: checkpoint.recordReference,
        record_hash: recordHash,
        status: checkpoint.status,
        error_message: checkpoint.errorMessage,
        processing_time_ms: checkpoint.processingTimeMs,
        record_data: checkpoint.recordData as object,
      },
    });

    // Actualizar el last_checkpoint_index del batch
    await this.prisma.importBatch.update({
      where: { id: checkpoint.batchId },
      data: { last_checkpoint_index: checkpoint.recordIndex },
    });
  }

  async saveBatch(checkpoints: CheckpointData[]): Promise<void> {
    if (checkpoints.length === 0) return;

    const batchId = checkpoints[0]!.batchId;

    await this.prisma.$transaction(async (tx) => {
      // Usar upsert para cada checkpoint para evitar errores de duplicados
      for (const cp of checkpoints) {
        const recordHash = cp.recordData ? this.generateHash(cp.recordData) : cp.contentHash;

        await tx.importCheckpoint.upsert({
          where: {
            import_batch_id_record_index: {
              import_batch_id: cp.batchId,
              record_index: cp.recordIndex,
            },
          },
          create: {
            import_batch_id: cp.batchId,
            record_index: cp.recordIndex,
            record_reference: cp.recordReference,
            record_hash: recordHash,
            status: cp.status,
            error_message: cp.errorMessage,
            processing_time_ms: cp.processingTimeMs,
            record_data: cp.recordData as object,
          },
          update: {
            status: cp.status,
            error_message: cp.errorMessage,
          },
        });
      }

      // Actualizar el último índice procesado
      const lastIndex = Math.max(...checkpoints.map((cp) => cp.recordIndex));
      await tx.importBatch.update({
        where: { id: batchId },
        data: { last_checkpoint_index: lastIndex },
      });
    });
  }

  async getLastIndex(batchId: string): Promise<number> {
    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: { last_checkpoint_index: true },
    });

    return batch?.last_checkpoint_index ?? -1;
  }

  async getStats(batchId: string): Promise<CheckpointStats> {
    const [total, success, failed, skipped, lastCheckpoint, totalTime] = await Promise.all([
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId },
      }),
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId, status: "SUCCESS" },
      }),
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId, status: "FAILED" },
      }),
      this.prisma.importCheckpoint.count({
        where: { import_batch_id: batchId, status: "SKIPPED" },
      }),
      this.prisma.importCheckpoint.findFirst({
        where: { import_batch_id: batchId },
        orderBy: { record_index: "desc" },
        select: { record_index: true },
      }),
      this.prisma.importCheckpoint.aggregate({
        where: { import_batch_id: batchId },
        _sum: { processing_time_ms: true },
      }),
    ]);

    const totalProcessingTimeMs = totalTime._sum.processing_time_ms ?? 0;
    const avgProcessingTimeMs = total > 0 ? totalProcessingTimeMs / total : 0;

    return {
      total,
      success,
      failed,
      skipped,
      lastIndex: lastCheckpoint?.record_index ?? -1,
      totalProcessingTimeMs,
      avgProcessingTimeMs,
    };
  }

  async isProcessed(batchId: string, recordIndex: number): Promise<boolean> {
    const checkpoint = await this.prisma.importCheckpoint.findUnique({
      where: {
        import_batch_id_record_index: {
          import_batch_id: batchId,
          record_index: recordIndex,
        },
      },
      select: { id: true },
    });

    return checkpoint !== null;
  }

  async hasDuplicateHash(batchId: string, contentHash: string): Promise<boolean> {
    const checkpoint = await this.prisma.importCheckpoint.findFirst({
      where: {
        import_batch_id: batchId,
        record_hash: contentHash,
        status: "SUCCESS",
      },
      select: { id: true },
    });

    return checkpoint !== null;
  }

  async getFailedIndices(batchId: string): Promise<number[]> {
    const failedCheckpoints = await this.prisma.importCheckpoint.findMany({
      where: {
        import_batch_id: batchId,
        status: "FAILED",
      },
      select: { record_index: true },
      orderBy: { record_index: "asc" },
    });

    return failedCheckpoints.map((cp) => cp.record_index);
  }

  async getCheckpoint(batchId: string, recordIndex: number): Promise<CheckpointData | null> {
    const checkpoint = await this.prisma.importCheckpoint.findUnique({
      where: {
        import_batch_id_record_index: {
          import_batch_id: batchId,
          record_index: recordIndex,
        },
      },
    });

    if (!checkpoint) return null;

    return {
      batchId: checkpoint.import_batch_id,
      recordIndex: checkpoint.record_index,
      recordReference: checkpoint.record_reference ?? undefined,
      contentHash: checkpoint.record_hash ?? undefined,
      status: checkpoint.status as "SUCCESS" | "FAILED" | "SKIPPED",
      errorMessage: checkpoint.error_message ?? undefined,
      processingTimeMs: checkpoint.processing_time_ms ?? undefined,
      recordData: checkpoint.record_data as Record<string, unknown> | undefined,
      createdAt: checkpoint.created_at,
    };
  }

  async cleanup(batchId: string): Promise<number> {
    const result = await this.prisma.importCheckpoint.deleteMany({
      where: { import_batch_id: batchId },
    });

    return result.count;
  }

  async cleanupOlderThan(olderThan: Date): Promise<number> {
    const result = await this.prisma.importCheckpoint.deleteMany({
      where: {
        created_at: { lt: olderThan },
      },
    });

    return result.count;
  }

  /**
   * Genera un hash único para un registro
   */
  private generateHash(data: Record<string, unknown>): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return createHash("sha256").update(normalized).digest("hex").substring(0, 16);
  }
}
