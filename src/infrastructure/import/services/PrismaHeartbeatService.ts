/**
 * Implementación del servicio de heartbeat con Prisma
 * Capa de Infraestructura - Implementa IHeartbeatService
 */

import type { PrismaClient } from "@/generated/client/client";
import type { IHeartbeatService, StaleBatchInfo } from "@/domain/import/ports/IHeartbeatService";

export class PrismaHeartbeatService implements IHeartbeatService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private currentBatchId: string | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private defaultIntervalMs: number = 30000
  ) {}

  start(batchId: string, intervalMs?: number): void {
    if (this.isRunning) {
      console.warn(`⚠️ Heartbeat already running for batch ${this.currentBatchId}`);
      return;
    }

    this.currentBatchId = batchId;
    this.isRunning = true;
    const interval = intervalMs ?? this.defaultIntervalMs;

    console.log(`💓 Starting heartbeat for batch ${batchId} (interval: ${interval}ms)`);

    // Actualizar inmediatamente
    this.pulse().catch((error) => {
      console.error("Failed to update initial heartbeat:", error);
    });

    // Configurar intervalo
    this.intervalId = setInterval(() => {
      this.pulse().catch((error) => {
        console.error("Failed to update heartbeat:", error);
      });
    }, interval);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log(`💓 Stopping heartbeat for batch ${this.currentBatchId}`);

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    this.currentBatchId = null;
  }

  async pulse(): Promise<void> {
    if (!this.currentBatchId) {
      throw new Error("Heartbeat not started - no batch ID");
    }

    try {
      await this.prisma.importBatch.update({
        where: { id: this.currentBatchId },
        data: { last_heartbeat: new Date() },
      });
    } catch (error) {
      console.error(`Failed to update heartbeat for batch ${this.currentBatchId}:`, error);
      // Si falla la actualización, detener el heartbeat
      this.stop();
      throw error;
    }
  }

  isActive(): boolean {
    return this.isRunning;
  }

  getCurrentBatchId(): string | null {
    return this.currentBatchId;
  }

  async findStaleBatches(thresholdMs: number = 60000): Promise<StaleBatchInfo[]> {
    const thresholdDate = new Date(Date.now() - thresholdMs);

    const staleBatches = await this.prisma.importBatch.findMany({
      where: {
        status: "IN_PROGRESS",
        last_heartbeat: {
          lt: thresholdDate,
        },
      },
      select: {
        id: true,
        last_heartbeat: true,
        status: true,
        total_records: true,
        successful_records: true,
        failed_records: true,
      },
    });

    return staleBatches.map((batch) => ({
      batchId: batch.id,
      lastHeartbeat: batch.last_heartbeat || new Date(0),
      status: batch.status,
      totalRecords: batch.total_records,
      processedRecords: batch.successful_records + batch.failed_records,
      staleDurationMs: Date.now() - (batch.last_heartbeat?.getTime() || 0),
    }));
  }

  async isStale(batchId: string, thresholdMs: number = 60000): Promise<boolean> {
    const thresholdDate = new Date(Date.now() - thresholdMs);

    const batch = await this.prisma.importBatch.findUnique({
      where: { id: batchId },
      select: {
        status: true,
        last_heartbeat: true,
      },
    });

    if (!batch) return false;

    // Solo considerar stale si está IN_PROGRESS
    if (batch.status !== "IN_PROGRESS") return false;

    // Si no tiene heartbeat, considerar stale
    if (!batch.last_heartbeat) return true;

    return batch.last_heartbeat < thresholdDate;
  }

  async markAsInterrupted(batchId: string): Promise<void> {
    await this.prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "INTERRUPTED",
        completed_at: new Date(),
      },
    });

    console.log(`⚠️ Batch ${batchId} marked as INTERRUPTED`);
  }
}

/**
 * Factory para crear instancias de PrismaHeartbeatService
 */
export class PrismaHeartbeatServiceFactory {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly defaultIntervalMs: number = 30000
  ) {}

  create(batchId: string, intervalMs?: number): PrismaHeartbeatService {
    const service = new PrismaHeartbeatService(this.prisma, intervalMs ?? this.defaultIntervalMs);
    // No iniciar automáticamente, el caller debe llamar a start()
    return service;
  }
}
