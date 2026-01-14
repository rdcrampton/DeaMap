/**
 * Import Batches API
 *
 * GET /api/import - List import batches (filtered by AED_CSV_IMPORT type)
 *
 * This is a convenience endpoint that wraps the generic batch job API
 * with filtering for CSV imports and transforms the response to the
 * legacy format expected by the frontend.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { JobType, type JobConfig, mergeWithDefaults } from "@/batch/domain";
import { BatchJobOrchestrator } from "@/batch/application/orchestrator/BatchJobOrchestrator";
import { PrismaBatchJobRepository } from "@/batch/infrastructure/repositories/PrismaBatchJobRepository";
import { initializeProcessors } from "@/batch/application/processors";
import { PrismaDataSourceRepository } from "@/import/infrastructure/repositories/PrismaDataSourceRepository";
import { uploadToS3 } from "@/lib/s3";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

/**
 * GET /api/import
 * List import batches with pagination
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") ?? "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
    const skip = (page - 1) * limit;

    // Query batch jobs of type AED_CSV_IMPORT
    const [jobs, total] = await Promise.all([
      prisma.batchJob.findMany({
        where: {
          type: JobType.AED_CSV_IMPORT,
        },
        orderBy: {
          created_at: "desc",
        },
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              errors: true,
              created_aeds: true,
            },
          },
          artifacts: {
            where: {
              type: "FILE",
            },
            take: 1,
          },
        },
      }),
      prisma.batchJob.count({
        where: {
          type: JobType.AED_CSV_IMPORT,
        },
      }),
    ]);

    // Transform to legacy format expected by frontend
    const batches = jobs.map((job) => {
      const config = job.config as Record<string, unknown>;
      const sourceFile = job.artifacts[0];

      return {
        id: job.id,
        name: job.name,
        description: job.description,
        source_origin: (config?.sourceOrigin as string) ?? "CSV_IMPORT",
        file_name: sourceFile?.name ?? (config?.fileName as string) ?? null,
        file_url: sourceFile?.file_url ?? (config?.fileUrl as string) ?? null,
        file_size: sourceFile?.file_size ?? (config?.fileSize as number) ?? null,
        total_records: job.total_records,
        successful_records: job.successful_records,
        failed_records: job.failed_records,
        warning_records: job.skipped_records,
        status: job.status,
        completed_at: job.completed_at?.toISOString() ?? null,
        duration_seconds: job.duration_seconds,
        imported_by: job.created_by,
        created_at: job.created_at.toISOString(),
        _count: {
          errors: job._count.errors,
          aeds: job._count.created_aeds,
        },
      };
    });

    return NextResponse.json({
      batches,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing import batches:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error desconocido",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/import
 * Create and start a new import batch job
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { filePath, mappings, batchName, sharepointCookies } = body;

    if (!filePath || !mappings || !Array.isArray(mappings)) {
      return NextResponse.json(
        { error: "Faltan parámetros requeridos (filePath, mappings)" },
        { status: 400 }
      );
    }

    // Initialize processors
    const dataSourceRepository = new PrismaDataSourceRepository(prisma);
    initializeProcessors(prisma, dataSourceRepository);

    // Create orchestrator and repository
    const repository = new PrismaBatchJobRepository(prisma);
    const orchestrator = new BatchJobOrchestrator(repository);

    // Upload CSV file to S3 for persistent storage
    console.log(`📤 [Import] Uploading CSV to S3: ${filePath}`);

    let s3Url: string;
    let fileSize: number;
    let fileHash: string;
    const fileName = path.basename(filePath);

    try {
      // Read file from /tmp
      const fileBuffer = await fs.readFile(filePath);
      fileSize = fileBuffer.length;

      // Calculate file hash for integrity verification
      fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

      // Upload to S3
      s3Url = await uploadToS3({
        buffer: fileBuffer,
        filename: fileName,
        contentType: "text/csv",
        prefix: "batch-jobs/csv-imports",
      });

      console.log(`✅ [Import] CSV uploaded to S3: ${s3Url} (${fileSize} bytes, hash: ${fileHash.substring(0, 8)}...)`);

      // Clean up temporary file
      await fs.unlink(filePath);
      console.log(`🗑️ [Import] Temporary file deleted: ${filePath}`);
    } catch (error) {
      console.error(`❌ [Import] Failed to upload CSV to S3:`, error);
      return NextResponse.json(
        { error: "Error al subir el archivo CSV a almacenamiento permanente" },
        { status: 500 }
      );
    }

    // Create configuration with S3 URL instead of /tmp path
    const config: JobConfig = mergeWithDefaults({
      type: JobType.AED_CSV_IMPORT,
      filePath: s3Url, // Use S3 URL instead of /tmp path
      columnMappings: mappings.map((m: { csvColumn: string; systemField: string }) => ({
        csvColumn: m.csvColumn,
        systemField: m.systemField,
      })),
      delimiter: ";",
      skipDuplicates: true,
      duplicateThreshold: 0.9,
      chunkSize: 50, // Process 50 records per chunk
      sharePointAuth: sharepointCookies
        ? {
            fedAuth: sharepointCookies.FedAuth || "",
            rtFa: sharepointCookies.rtFa,
          }
        : undefined,
    });

    // Create the batch job (DO NOT START IT - let the CRON handle it)
    const job = await orchestrator.create({
      type: JobType.AED_CSV_IMPORT,
      name: batchName || `Importación CSV ${new Date().toISOString()}`,
      description: `Importación de ${fileName}`,
      config,
      createdBy: user.userId, // JWT payload has userId as UUID
      tags: ["csv-import", "manual-upload"],
    });

    // Create artifact record to track the uploaded CSV file
    await prisma.batchJobArtifact.create({
      data: {
        job_id: job.id,
        type: "FILE",
        name: fileName,
        description: `CSV source file for import job`,
        mime_type: "text/csv",
        file_size: fileSize,
        file_url: s3Url,
        file_hash: fileHash,
      },
    });

    console.log(`📋 [Import] Job ${job.id} created with S3 artifact and queued for CRON processing`);

    return NextResponse.json({
      success: true,
      batchId: job.id,
      status: job.status, // Will be PENDING
      progress: {
        totalRecords: 0,
        processedRecords: 0,
        successfulRecords: 0,
        failedRecords: 0,
        percentage: 0,
        hasMore: true,
      },
      message: "Importación en cola. El procesamiento comenzará automáticamente en breve.",
    });
  } catch (error) {
    console.error("Error creating import batch:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error al crear la importación",
      },
      { status: 500 }
    );
  }
}
