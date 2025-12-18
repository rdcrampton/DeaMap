"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface DataSource {
  id: string;
  name: string;
  type: string;
  description: string | null;
  apiEndpoint: string | null;
  resourceId: string | null;
  fieldMapping: Record<string, string> | null;
  filterConfig: Record<string, unknown> | null;
  isActive: boolean;
  syncFrequency: string;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  totalRecordsSync: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsDeactivated: number;
  createdAt: string;
  updatedAt: string;
}

interface PreviewRecord {
  sourceId: string;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown>;
}

interface SyncResult {
  batchId: string;
  status: string;
  summary: {
    created: number;
    updated: number;
    skipped: number;
    deactivated: number;
    errors: number;
  };
}

export default function DataSourceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    message: string;
    recordCount?: number;
  } | null>(null);
  const [preview, setPreview] = useState<PreviewRecord[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    isActive: true,
    syncFrequency: "MANUAL",
  });

  const fetchDataSource = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/data-sources/${id}`);

      if (response.status === 401 || response.status === 403) {
        router.push("/");
        return;
      }

      if (response.status === 404) {
        setError("Fuente de datos no encontrada");
        return;
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar fuente de datos");
      }

      setDataSource(data.data);
      setEditForm({
        name: data.data.name,
        description: data.data.description || "",
        isActive: data.data.isActive,
        syncFrequency: data.data.syncFrequency,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchDataSource();
  }, [fetchDataSource]);

  const triggerSync = async (dryRun: boolean = false) => {
    try {
      setSyncing(true);
      setSyncResult(null);

      const response = await fetch(`/api/admin/data-sources/${id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al sincronizar");
      }

      setSyncResult(data.data);
      await fetchDataSource(); // Refrescar datos
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar");
    } finally {
      setSyncing(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setConnectionResult(null);

      const response = await fetch(`/api/admin/data-sources/${id}/preview`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.success) {
        setConnectionResult({ success: false, message: data.error || "Error de conexión" });
        return;
      }

      setConnectionResult({
        success: true,
        message: "Conexión exitosa",
        recordCount: data.data.recordCount,
      });
    } catch (err) {
      setConnectionResult({
        success: false,
        message: err instanceof Error ? err.message : "Error de conexión",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const loadPreview = async () => {
    try {
      setLoadingPreview(true);
      const response = await fetch(`/api/admin/data-sources/${id}/preview?limit=10`);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al cargar preview");
      }

      setPreview(data.data.records);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const updateDataSource = async () => {
    try {
      const response = await fetch(`/api/admin/data-sources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar");
      }

      setDataSource(data.data);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar");
    }
  };

  const deleteDataSource = async () => {
    if (
      !confirm(
        "¿Estás seguro de que deseas eliminar esta fuente de datos? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/data-sources/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al eliminar");
      }

      router.push("/admin/data-sources");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CKAN_API: "API CKAN",
      CSV_FILE: "Archivo CSV",
      JSON_FILE: "Archivo JSON",
      REST_API: "API REST",
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      CKAN_API: "bg-blue-100 text-blue-800",
      CSV_FILE: "bg-green-100 text-green-800",
      JSON_FILE: "bg-yellow-100 text-yellow-800",
      REST_API: "bg-purple-100 text-purple-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;

    const statusConfig: Record<string, { color: string; label: string }> = {
      COMPLETED: { color: "bg-green-100 text-green-800", label: "Completado" },
      IN_PROGRESS: { color: "bg-blue-100 text-blue-800", label: "En progreso" },
      FAILED: { color: "bg-red-100 text-red-800", label: "Fallido" },
      PENDING: { color: "bg-yellow-100 text-yellow-800", label: "Pendiente" },
    };

    const config = statusConfig[status] || { color: "bg-gray-100 text-gray-800", label: status };

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSyncFrequencyLabel = (freq: string) => {
    const labels: Record<string, string> = {
      MANUAL: "Manual",
      DAILY: "Diaria",
      WEEKLY: "Semanal",
      MONTHLY: "Mensual",
    };
    return labels[freq] || freq;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando fuente de datos...</div>
      </div>
    );
  }

  if (error && !dataSource) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin/data-sources"
            className="text-sm text-blue-600 hover:text-blue-800 mb-4 inline-block"
          >
            ← Volver a fuentes de datos
          </Link>
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dataSource) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/data-sources"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Volver a fuentes de datos
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{dataSource.name}</h1>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(dataSource.type)}`}
                >
                  {getTypeLabel(dataSource.type)}
                </span>
                {!dataSource.isActive && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    Inactiva
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-gray-600">
                {dataSource.description || "Sin descripción"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Editar
              </button>
              <button
                onClick={deleteDataSource}
                className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
              >
                <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Eliminar
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-xs text-red-600 underline mt-1"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {editing && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-lg font-semibold mb-4">Editar Fuente de Datos</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Nombre</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Frecuencia de Sincronización
                  </label>
                  <select
                    value={editForm.syncFrequency}
                    onChange={(e) => setEditForm({ ...editForm, syncFrequency: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="DAILY">Diaria</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={editForm.isActive}
                    onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                    Activa
                  </label>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={updateDataSource}
                  className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Sincronizados
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {dataSource.totalRecordsSync}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Creados</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-green-600">
                        {dataSource.recordsCreated}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Actualizados</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-blue-600">
                        {dataSource.recordsUpdated}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-6 w-6 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20 12H4"
                    />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Desactivados</dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-red-600">
                        {dataSource.recordsDeactivated}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Configuration Info */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Configuración</h2>
            </div>
            <div className="px-6 py-4">
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Endpoint API</dt>
                  <dd className="mt-1 text-sm text-gray-900 break-all">
                    {dataSource.apiEndpoint || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Resource ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {dataSource.resourceId || "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Frecuencia de Sincronización
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {getSyncFrequencyLabel(dataSource.syncFrequency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Última Sincronización</dt>
                  <dd className="mt-1 text-sm text-gray-900 flex items-center gap-2">
                    {formatDate(dataSource.lastSyncAt)}
                    {getStatusBadge(dataSource.lastSyncStatus)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Creado</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(dataSource.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Actualizado</dt>
                  <dd className="mt-1 text-sm text-gray-900">{formatDate(dataSource.updatedAt)}</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* Sync Controls */}
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Sincronización</h2>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Connection Test */}
              <div>
                <button
                  onClick={testConnection}
                  disabled={testingConnection}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium
                    ${testingConnection ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-gray-700 bg-white hover:bg-gray-50"}`}
                >
                  {testingConnection ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Probando conexión...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Probar Conexión
                    </>
                  )}
                </button>
                {connectionResult && (
                  <div
                    className={`mt-2 p-3 rounded-md ${connectionResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
                  >
                    <p className="text-sm">{connectionResult.message}</p>
                    {connectionResult.recordCount !== undefined && (
                      <p className="text-xs mt-1">
                        Registros disponibles: {connectionResult.recordCount}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Dry Run */}
              <div>
                <button
                  onClick={() => triggerSync(true)}
                  disabled={syncing || !dataSource.isActive}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-yellow-300 rounded-md shadow-sm text-sm font-medium
                    ${syncing || !dataSource.isActive ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-yellow-700 bg-yellow-50 hover:bg-yellow-100"}`}
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  Simulación (Dry Run)
                </button>
                <p className="mt-1 text-xs text-gray-500">
                  Simula la sincronización sin guardar cambios
                </p>
              </div>

              {/* Full Sync */}
              <div>
                <button
                  onClick={() => triggerSync(false)}
                  disabled={syncing || !dataSource.isActive}
                  className={`w-full inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                    ${syncing || !dataSource.isActive ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"}`}
                >
                  {syncing ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <svg
                        className="h-4 w-4 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      Ejecutar Sincronización
                    </>
                  )}
                </button>
              </div>

              {/* Sync Result */}
              {syncResult && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-medium text-gray-900 mb-2">
                    Resultado de Sincronización
                  </h3>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-gray-500">Batch ID</dt>
                      <dd className="font-mono text-xs">{syncResult.batchId}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Estado</dt>
                      <dd>{getStatusBadge(syncResult.status)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Creados</dt>
                      <dd className="text-green-600 font-semibold">{syncResult.summary.created}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Actualizados</dt>
                      <dd className="text-blue-600 font-semibold">{syncResult.summary.updated}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Omitidos</dt>
                      <dd className="text-gray-600 font-semibold">{syncResult.summary.skipped}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Desactivados</dt>
                      <dd className="text-red-600 font-semibold">
                        {syncResult.summary.deactivated}
                      </dd>
                    </div>
                    {syncResult.summary.errors > 0 && (
                      <div className="col-span-2">
                        <dt className="text-gray-500">Errores</dt>
                        <dd className="text-red-600 font-semibold">{syncResult.summary.errors}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="mt-8 bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium text-gray-900">Vista Previa de Datos</h2>
            <button
              onClick={loadPreview}
              disabled={loadingPreview}
              className={`inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-md
                ${loadingPreview ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "text-gray-700 bg-white hover:bg-gray-50"}`}
            >
              {loadingPreview ? "Cargando..." : "Cargar Preview"}
            </button>
          </div>
          <div className="px-6 py-4">
            {preview.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Haz clic en &quot;Cargar Preview&quot; para ver una muestra de los datos de la
                fuente externa
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID Externo
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Datos Mapeados
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {preview.map((record, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-900">
                          {record.sourceId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto max-w-xl">
                            {JSON.stringify(record.mappedData, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Field Mapping */}
        {dataSource.fieldMapping && (
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Mapeo de Campos</h2>
            </div>
            <div className="px-6 py-4">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Campo Interno
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Campo Externo
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(dataSource.fieldMapping).map(([internal, external]) => (
                      <tr key={internal}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {internal}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                          {external}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
