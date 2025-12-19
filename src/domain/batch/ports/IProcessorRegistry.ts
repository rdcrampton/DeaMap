/**
 * Processor Registry Port
 *
 * Defines the contract for registering and retrieving job processors.
 * Implements the registry pattern for extensibility.
 */

import { JobConfig, JobType } from '../value-objects';
import { IBatchJobProcessor } from './IBatchJobProcessor';

/**
 * Registry for batch job processors
 */
export interface IProcessorRegistry {
  /**
   * Register a processor for a job type
   */
  register<TConfig extends JobConfig>(
    jobType: JobType,
    processor: IBatchJobProcessor<TConfig>
  ): void;

  /**
   * Get a processor for a job type
   */
  get<TConfig extends JobConfig>(
    jobType: JobType
  ): IBatchJobProcessor<TConfig> | undefined;

  /**
   * Check if a processor is registered for a job type
   */
  has(jobType: JobType): boolean;

  /**
   * Get all registered job types
   */
  getRegisteredTypes(): JobType[];

  /**
   * Unregister a processor
   */
  unregister(jobType: JobType): boolean;
}

/**
 * Default implementation of processor registry
 */
export class ProcessorRegistry implements IProcessorRegistry {
  private processors: Map<JobType, IBatchJobProcessor<JobConfig>> = new Map();

  register<TConfig extends JobConfig>(
    jobType: JobType,
    processor: IBatchJobProcessor<TConfig>
  ): void {
    if (this.processors.has(jobType)) {
      throw new Error(`Processor already registered for job type: ${jobType}`);
    }
    this.processors.set(jobType, processor as IBatchJobProcessor<JobConfig>);
  }

  get<TConfig extends JobConfig>(
    jobType: JobType
  ): IBatchJobProcessor<TConfig> | undefined {
    return this.processors.get(jobType) as IBatchJobProcessor<TConfig> | undefined;
  }

  has(jobType: JobType): boolean {
    return this.processors.has(jobType);
  }

  getRegisteredTypes(): JobType[] {
    return Array.from(this.processors.keys());
  }

  unregister(jobType: JobType): boolean {
    return this.processors.delete(jobType);
  }
}

/**
 * Singleton instance of the processor registry
 */
let registryInstance: ProcessorRegistry | null = null;

export function getProcessorRegistry(): ProcessorRegistry {
  if (!registryInstance) {
    registryInstance = new ProcessorRegistry();
  }
  return registryInstance;
}

/**
 * Decorator for auto-registering processors
 * Usage: @RegisterProcessor(JobType.AED_CSV_IMPORT)
 */
export function RegisterProcessor(jobType: JobType) {
  return function <T extends new (...args: unknown[]) => IBatchJobProcessor>(
    constructor: T
  ) {
    const instance = new constructor();
    getProcessorRegistry().register(jobType, instance);
    return constructor;
  };
}
