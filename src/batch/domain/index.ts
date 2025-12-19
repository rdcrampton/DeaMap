/**
 * Batch Processing Domain
 *
 * This module provides a generic, extensible batch processing system
 * designed for Vercel's serverless execution model.
 *
 * Architecture:
 * - Entities: BatchJob (aggregate root)
 * - Value Objects: JobType, JobStatus, JobProgress, JobResult, JobConfig
 * - Ports: IBatchJobRepository, IBatchJobProcessor, IProcessorRegistry
 *
 * Usage:
 * 1. Create a processor implementing IBatchJobProcessor
 * 2. Register it with the ProcessorRegistry
 * 3. Create a BatchJob with the appropriate JobType and config
 * 4. Use the BatchJobOrchestrator to execute
 */

export * from "./entities";
export * from "./value-objects";
export * from "./ports";
