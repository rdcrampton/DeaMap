/**
 * Unit tests for JobProgress Value Object
 * Tests the fix for double-counting bug
 */

import { describe, it, expect } from "vitest";
import { JobProgress } from "@/batch/domain/value-objects/JobProgress";

describe("JobProgress", () => {
  describe("Progress counting (bug fix validation)", () => {
    it("should_not_double_count_when_using_new_increment_methods", () => {
      // Arrange: Start with empty progress
      let progress = JobProgress.empty().withTotal(100);

      // Act: Simulate processing 30 records in a chunk
      const processedCount = 30;
      const successCount = 25;
      const failedCount = 3;
      const skippedCount = 2;

      // First update total processed records
      progress = progress.withProcessed(progress.processedRecords + processedCount);

      // Then classify each result WITHOUT incrementing processedRecords again
      for (let i = 0; i < successCount; i++) {
        progress = progress.incrementSuccessCount();
      }
      for (let i = 0; i < failedCount; i++) {
        progress = progress.incrementFailedCount();
      }
      for (let i = 0; i < skippedCount; i++) {
        progress = progress.incrementSkippedCount();
      }

      // Assert: processedRecords should be 30, not 60
      expect(progress.processedRecords).toBe(30);
      expect(progress.successfulRecords).toBe(25);
      expect(progress.failedRecords).toBe(3);
      expect(progress.skippedRecords).toBe(2);

      // Verify categorization adds up
      const totalCategorized =
        progress.successfulRecords + progress.failedRecords + progress.skippedRecords;
      expect(totalCategorized).toBe(30);

      // Verify percentage
      expect(progress.percentage).toBe(30); // 30/100 = 30%
    });

    it("should_double_count_with_deprecated_methods_for_backward_compatibility", () => {
      // Arrange
      let progress = JobProgress.empty().withTotal(100);

      // Act: Use deprecated methods (old behavior)
      progress = progress.incrementSuccess(10);
      progress = progress.incrementFailed(5);

      // Assert: This WILL double count (deprecated behavior)
      expect(progress.processedRecords).toBe(15);
      expect(progress.successfulRecords).toBe(10);
      expect(progress.failedRecords).toBe(5);
    });

    it("should_calculate_correct_percentage_after_multiple_chunks", () => {
      // Arrange: Simulate a job with 10,728 total records
      let progress = JobProgress.empty().withTotal(10728);

      // Act: Process 358 chunks of 30 records each
      const chunkSize = 30;
      const totalChunks = 358;

      for (let chunk = 0; chunk < totalChunks; chunk++) {
        // Process chunk
        progress = progress.withProcessed(progress.processedRecords + chunkSize);

        // Classify results (all successful for simplicity)
        for (let i = 0; i < chunkSize; i++) {
          progress = progress.incrementSuccessCount();
        }

        progress = progress.advanceChunk();
      }

      // Assert
      expect(progress.processedRecords).toBe(10740); // 358 * 30
      expect(progress.successfulRecords).toBe(10740);
      expect(progress.currentChunk).toBe(358);

      // Percentage should be 100% (10740/10728 = 100.11% → 100%)
      expect(progress.percentage).toBe(100);
    });

    it("should_allow_percentage_over_100_when_processed_exceeds_total", () => {
      // Arrange
      let progress = JobProgress.empty().withTotal(100);

      // Act: Process 110 records (more than total - can happen with estimation)
      progress = progress.withProcessed(110);

      // Assert: Percentage reflects reality (110%)
      expect(progress.percentage).toBe(110); // 110/100 = 110%
      expect(progress.isComplete).toBe(true); // Still complete
      expect(progress.hasMore).toBe(false);
    });
  });

  describe("Immutability", () => {
    it("should_return_new_instance_on_every_update", () => {
      // Arrange
      const original = JobProgress.empty();

      // Act
      const updated = original.incrementSuccessCount(5);

      // Assert
      expect(original).not.toBe(updated);
      expect(original.successfulRecords).toBe(0);
      expect(updated.successfulRecords).toBe(5);
    });
  });

  describe("Computed properties", () => {
    it("should_calculate_success_rate_correctly", () => {
      // Arrange
      let progress = JobProgress.empty();

      // Act: 80 success, 20 failed out of 100 processed
      progress = progress.withProcessed(100);
      for (let i = 0; i < 80; i++) {
        progress = progress.incrementSuccessCount();
      }
      for (let i = 0; i < 20; i++) {
        progress = progress.incrementFailedCount();
      }

      // Assert
      expect(progress.successRate).toBe(80);
      expect(progress.errorRate).toBe(20);
    });

    it("should_calculate_remaining_records_correctly", () => {
      // Arrange
      let progress = JobProgress.empty().withTotal(1000);

      // Act
      progress = progress.withProcessed(300);

      // Assert
      expect(progress.remainingRecords).toBe(700);
    });
  });
});
