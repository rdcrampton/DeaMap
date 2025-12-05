/**
 * Hook para gestionar exportaciones de AED
 */

import { useEffect, useState, useCallback } from "react";

import { ExportBatchInfo } from "@/domain/export/ports/IExportRepository";

interface UseExportBatchesOptions {
  page?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // milliseconds
}

interface ExportBatchesResponse {
  success: boolean;
  data: ExportBatchInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function useExportBatches(options: UseExportBatchesOptions = {}) {
  const { page = 1, limit = 20, autoRefresh = false, refreshInterval = 5000 } = options;

  const [batches, setBatches] = useState<ExportBatchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  const fetchBatches = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/export?${params}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autenticado");
        }
        if (response.status === 403) {
          throw new Error("Acceso denegado");
        }
        throw new Error("Error al cargar exportaciones");
      }

      const data: ExportBatchesResponse = await response.json();

      setBatches(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchBatches();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchBatches]);

  return {
    batches,
    loading,
    error,
    pagination,
    refetch: fetchBatches,
  };
}
