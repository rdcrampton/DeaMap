'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { DeaRecord } from '@/types'

interface PaginatedResponse {
  data: DeaRecord[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * API client for DEA records
 */
const deaApiClient = {
  /**
   * Fetch paginated DEA records
   */
  fetchPaginated: async (page: number = 1, limit: number = 50): Promise<PaginatedResponse> => {
    const response = await fetch(`/api/dea?page=${page}&limit=${limit}`)
    if (!response.ok) {
      throw new Error(`Error en la carga: ${response.status}`)
    }
    return await response.json()
  },

  /**
   * Fetch all DEA records (deprecated - use fetchPaginated instead)
   * @deprecated This method loads all records at once and may cause memory issues
   */
  fetchAll: async (): Promise<DeaRecord[]> => {
    const response = await fetch('/api/dea')
    if (!response.ok) {
      throw new Error(`Error en la carga: ${response.status}`)
    }
    return await response.json()
  },

  /**
   * Create a new DEA record
   */
  create: async (recordData: Omit<DeaRecord, 'id'>): Promise<DeaRecord> => {
    const response = await fetch('/api/dea', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || 'Error al crear el registro')
    }

    return await response.json()
  },

  /**
   * Update an existing DEA record
   */
  update: async (id: number, recordData: Partial<DeaRecord>): Promise<DeaRecord> => {
    const response = await fetch(`/api/dea/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(recordData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Error al actualizar el registro ${id}`)
    }

    return await response.json()
  },

  /**
   * Delete a DEA record
   */
  delete: async (id: number): Promise<{ success: boolean; deletedRecord: DeaRecord }> => {
    const response = await fetch(`/api/dea/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `Error al eliminar el registro ${id}`)
    }

    return await response.json()
  }
}

/**
 * Hook for managing DEA records with optimized performance and pagination
 */
export default function useDeaRecords(pageSize: number = 50) {
  const [records, setRecords] = useState<DeaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalRecords, setTotalRecords] = useState(0)

  /**
   * Load records for a specific page (replaces existing records)
   */
  const loadPage = useCallback(async (page: number) => {
    setLoading(true)
    setError(null)
    try {
      const response = await deaApiClient.fetchPaginated(page, pageSize)
      setRecords(response.data)
      setCurrentPage(response.pagination.currentPage)
      setHasMore(response.pagination.hasNextPage)
      setTotalRecords(response.pagination.totalRecords)
    } catch (err) {
      console.error('Error al cargar los registros:', err)
      setError(err instanceof Error ? err : new Error('Error desconocido al cargar registros'))
    } finally {
      setLoading(false)
    }
  }, [pageSize])

  /**
   * Load more records (appends to existing records)
   */
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return

    setLoadingMore(true)
    setError(null)
    try {
      const nextPage = currentPage + 1
      const response = await deaApiClient.fetchPaginated(nextPage, pageSize)
      setRecords(prev => [...prev, ...response.data])
      setCurrentPage(response.pagination.currentPage)
      setHasMore(response.pagination.hasNextPage)
      setTotalRecords(response.pagination.totalRecords)
    } catch (err) {
      console.error('Error al cargar más registros:', err)
      setError(err instanceof Error ? err : new Error('Error desconocido al cargar más registros'))
    } finally {
      setLoadingMore(false)
    }
  }, [currentPage, hasMore, loadingMore, pageSize])

  /**
   * Refresh all records from the API (loads first page)
   */
  const refreshRecords = useCallback(async () => {
    await loadPage(1)
  }, [loadPage])

  /**
   * Create a new record
   */
  const createRecord = useCallback(async (recordData: Omit<DeaRecord, 'id'>) => {
    return await deaApiClient.create(recordData)
  }, [])

  /**
   * Update an existing record
   */
  const updateRecord = useCallback(async (id: number, recordData: Partial<DeaRecord>) => {
    return await deaApiClient.update(id, recordData)
  }, [])

  /**
   * Delete a record
   */
  const deleteRecord = useCallback(async (id: number) => {
    return await deaApiClient.delete(id)
  }, [])

  // Load records on initial mount
  useEffect(() => {
    refreshRecords()
  }, [refreshRecords])

  // Memoize the return value to prevent unnecessary re-renders
  const returnValue = useMemo(() => ({
    records,
    loading,
    loadingMore,
    error,
    hasMore,
    totalRecords,
    currentPage,
    loadMore,
    refreshRecords,
    createRecord,
    updateRecord,
    deleteRecord
  }), [records, loading, loadingMore, error, hasMore, totalRecords, currentPage, loadMore, refreshRecords, createRecord, updateRecord, deleteRecord])

  return returnValue
}
