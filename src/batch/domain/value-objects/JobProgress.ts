/**
 * Job Progress Value Object
 *
 * Immutable value object that represents the current progress of a batch job.
 * Designed for real-time progress tracking and UI updates.
 */

export interface JobProgressData {
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  warningRecords: number;
  currentChunk: number;
  totalChunks: number;
  lastProcessedIndex: number;
  estimatedRemainingMs: number | null;
  startedAt: Date | null;
  lastActivityAt: Date | null;
}

export class JobProgress {
  private readonly data: JobProgressData;

  private constructor(data: JobProgressData) {
    this.data = Object.freeze({ ...data });
  }

  static create(data: Partial<JobProgressData> = {}): JobProgress {
    return new JobProgress({
      totalRecords: data.totalRecords ?? 0,
      processedRecords: data.processedRecords ?? 0,
      successfulRecords: data.successfulRecords ?? 0,
      failedRecords: data.failedRecords ?? 0,
      skippedRecords: data.skippedRecords ?? 0,
      warningRecords: data.warningRecords ?? 0,
      currentChunk: data.currentChunk ?? 0,
      totalChunks: data.totalChunks ?? 0,
      lastProcessedIndex: data.lastProcessedIndex ?? -1,
      estimatedRemainingMs: data.estimatedRemainingMs ?? null,
      startedAt: data.startedAt ?? null,
      lastActivityAt: data.lastActivityAt ?? null,
    });
  }

  static empty(): JobProgress {
    return JobProgress.create();
  }

  // Getters
  get totalRecords(): number {
    return this.data.totalRecords;
  }

  get processedRecords(): number {
    return this.data.processedRecords;
  }

  get successfulRecords(): number {
    return this.data.successfulRecords;
  }

  get failedRecords(): number {
    return this.data.failedRecords;
  }

  get skippedRecords(): number {
    return this.data.skippedRecords;
  }

  get warningRecords(): number {
    return this.data.warningRecords;
  }

  get currentChunk(): number {
    return this.data.currentChunk;
  }

  get totalChunks(): number {
    return this.data.totalChunks;
  }

  get lastProcessedIndex(): number {
    return this.data.lastProcessedIndex;
  }

  get estimatedRemainingMs(): number | null {
    return this.data.estimatedRemainingMs;
  }

  get startedAt(): Date | null {
    return this.data.startedAt;
  }

  get lastActivityAt(): Date | null {
    return this.data.lastActivityAt;
  }

  // Computed properties
  get percentage(): number {
    if (this.data.totalRecords === 0) return 0;
    return Math.round((this.data.processedRecords / this.data.totalRecords) * 100);
  }

  get remainingRecords(): number {
    return Math.max(0, this.data.totalRecords - this.data.processedRecords);
  }

  get isComplete(): boolean {
    return this.data.totalRecords > 0 && this.data.processedRecords >= this.data.totalRecords;
  }

  get hasMore(): boolean {
    return !this.isComplete;
  }

  get errorRate(): number {
    if (this.data.processedRecords === 0) return 0;
    return (this.data.failedRecords / this.data.processedRecords) * 100;
  }

  get successRate(): number {
    if (this.data.processedRecords === 0) return 0;
    return (this.data.successfulRecords / this.data.processedRecords) * 100;
  }

  get elapsedMs(): number {
    if (!this.data.startedAt) return 0;
    const endTime = this.data.lastActivityAt || new Date();
    return endTime.getTime() - this.data.startedAt.getTime();
  }

  get averageTimePerRecordMs(): number {
    if (this.data.processedRecords === 0) return 0;
    return this.elapsedMs / this.data.processedRecords;
  }

  // Immutable update methods
  withTotal(totalRecords: number, totalChunks?: number): JobProgress {
    return JobProgress.create({
      ...this.data,
      totalRecords,
      totalChunks: totalChunks ?? Math.ceil(totalRecords / 100),
    });
  }

  withProcessed(count: number): JobProgress {
    return JobProgress.create({
      ...this.data,
      processedRecords: count,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Increment successful records count without incrementing processedRecords
   * Use this when processedRecords is already updated separately
   */
  incrementSuccessCount(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      successfulRecords: this.data.successfulRecords + count,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Increment failed records count without incrementing processedRecords
   * Use this when processedRecords is already updated separately
   */
  incrementFailedCount(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      failedRecords: this.data.failedRecords + count,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Increment skipped records count without incrementing processedRecords
   * Use this when processedRecords is already updated separately
   */
  incrementSkippedCount(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      skippedRecords: this.data.skippedRecords + count,
      lastActivityAt: new Date(),
    });
  }

  /**
   * @deprecated Use incrementSuccessCount() when processedRecords is managed separately
   * Increments both processedRecords and successfulRecords
   */
  incrementSuccess(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      processedRecords: this.data.processedRecords + count,
      successfulRecords: this.data.successfulRecords + count,
      lastActivityAt: new Date(),
    });
  }

  /**
   * @deprecated Use incrementFailedCount() when processedRecords is managed separately
   * Increments both processedRecords and failedRecords
   */
  incrementFailed(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      processedRecords: this.data.processedRecords + count,
      failedRecords: this.data.failedRecords + count,
      lastActivityAt: new Date(),
    });
  }

  /**
   * @deprecated Use incrementSkippedCount() when processedRecords is managed separately
   * Increments both processedRecords and skippedRecords
   */
  incrementSkipped(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      processedRecords: this.data.processedRecords + count,
      skippedRecords: this.data.skippedRecords + count,
      lastActivityAt: new Date(),
    });
  }

  incrementWarning(count: number = 1): JobProgress {
    return JobProgress.create({
      ...this.data,
      warningRecords: this.data.warningRecords + count,
      lastActivityAt: new Date(),
    });
  }

  advanceChunk(): JobProgress {
    return JobProgress.create({
      ...this.data,
      currentChunk: this.data.currentChunk + 1,
      lastActivityAt: new Date(),
    });
  }

  withLastProcessedIndex(index: number): JobProgress {
    return JobProgress.create({
      ...this.data,
      lastProcessedIndex: index,
      lastActivityAt: new Date(),
    });
  }

  withEstimatedRemaining(ms: number): JobProgress {
    return JobProgress.create({
      ...this.data,
      estimatedRemainingMs: ms,
    });
  }

  start(): JobProgress {
    return JobProgress.create({
      ...this.data,
      startedAt: new Date(),
      lastActivityAt: new Date(),
    });
  }

  /**
   * Calculate estimated remaining time based on current progress
   */
  calculateEstimatedRemaining(): JobProgress {
    if (this.data.processedRecords === 0 || this.remainingRecords === 0) {
      return this.withEstimatedRemaining(0);
    }

    const estimatedMs = Math.round(this.averageTimePerRecordMs * this.remainingRecords);
    return this.withEstimatedRemaining(estimatedMs);
  }

  // Serialization
  toJSON(): JobProgressData & { percentage: number; hasMore: boolean } {
    return {
      ...this.data,
      percentage: this.percentage,
      hasMore: this.hasMore,
    };
  }

  static fromJSON(json: JobProgressData): JobProgress {
    return JobProgress.create({
      ...json,
      startedAt: json.startedAt ? new Date(json.startedAt) : null,
      lastActivityAt: json.lastActivityAt ? new Date(json.lastActivityAt) : null,
    });
  }
}
