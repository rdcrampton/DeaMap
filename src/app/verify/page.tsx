'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { DeaRecord, DeaRecordWithValidation, StatusFilter, SearchType } from '@/types';

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface ApiResponse {
  data: (DeaRecord | DeaRecordWithValidation)[];
  pagination: PaginationInfo;
}

export default function VerifyPage() {
  const [deaRecords, setDeaRecords] = useState<(DeaRecord | DeaRecordWithValidation)[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Estados para búsqueda
  const [searchType, setSearchType] = useState<SearchType>('id');
  const [searchValue, setSearchValue] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<DeaRecordWithValidation | null>(null);
  
  // Estados para filtros
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  
  const router = useRouter();

  useEffect(() => {
    fetchInitialRecords();
  }, [statusFilter]);

  const fetchInitialRecords = async () => {
    try {
      setLoading(true);
      setSearchResult(null); // Limpiar resultado de búsqueda
      const url = statusFilter === 'all' 
        ? '/api/verify?page=1&limit=12'
        : `/api/verify?page=1&limit=12&statusFilter=${statusFilter}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar registros');
      }
      const data: ApiResponse = await response.json();
      setDeaRecords(data.data);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreRecords = async () => {
    if (!pagination || !pagination.hasNextPage || loadingMore) return;

    try {
      setLoadingMore(true);
      const nextPage = pagination.currentPage + 1;
      const url = statusFilter === 'all' 
        ? `/api/verify?page=${nextPage}&limit=12`
        : `/api/verify?page=${nextPage}&limit=12&statusFilter=${statusFilter}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Error al cargar más registros');
      }
      const data: ApiResponse = await response.json();
      
      // Agregar nuevos registros a los existentes
      setDeaRecords(prev => [...prev, ...data.data]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar más registros');
    } finally {
      setLoadingMore(false);
    }
  };

  const searchDea = async () => {
    if (!searchValue.trim()) return;

    try {
      setSearchLoading(true);
      setError(null);
      
      const response = await fetch(`/api/verify/search?type=${searchType}&value=${searchValue.trim()}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al buscar DEA');
      }
      
      const result: DeaRecordWithValidation = await response.json();
      setSearchResult(result);
      setDeaRecords([]); // Limpiar lista actual
      setPagination(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar DEA');
      setSearchResult(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchValue('');
    setSearchResult(null);
    setError(null);
    fetchInitialRecords();
  };

  const startVerification = async (deaId: number) => {
    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deaId }),
      });

      if (!response.ok) {
        throw new Error('Error al iniciar verificación');
      }

      const session = await response.json();
      router.push(`/verify/${session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar verificación');
    }
  };

  const getStatusBadge = (record: DeaRecord | DeaRecordWithValidation) => {
    if ('addressValidation' in record && record.addressValidation) {
      const status = record.addressValidation.overallStatus;
      switch (status) {
        case 'valid':
          return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">✅ Válido</span>;
        case 'needs_review':
          return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">⚠️ Necesita Revisión</span>;
        case 'invalid':
          return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">❌ Inválido</span>;
        default:
          return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">⚪ Pendiente</span>;
      }
    }
    return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded">⚪ Sin validar</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando registros...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Verificación de DEAs
          </h1>
          <p className="text-gray-600 mb-6">
            Busca un DEA específico o selecciona uno de la lista para iniciar el proceso de verificación
          </p>
          
          {/* Sección de Búsqueda Directa */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">🔍 Búsqueda Directa</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-shrink-0">
                <select
                  value={searchType}
                  onChange={(e) => setSearchType(e.target.value as SearchType)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  aria-label="Tipo de búsqueda"
                >
                  <option value="id">ID Base de Datos</option>
                  <option value="provisional">Número Provisional</option>
                </select>
              </div>
              <div className="flex-grow">
                <input
                  type="number"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  placeholder={searchType === 'id' ? 'Ingresa el ID del DEA' : 'Ingresa el número provisional'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && searchDea()}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={searchDea}
                  disabled={searchLoading || !searchValue.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {searchLoading ? 'Buscando...' : 'Buscar'}
                </button>
                {(searchResult || searchValue) && (
                  <button
                    onClick={clearSearch}
                    className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Sección de Filtros */}
          {!searchResult && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">🎯 Filtros de Estado de Dirección</h2>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'all', label: 'Todos', icon: '📋' },
                  { value: 'needs_review', label: 'Necesitan Revisión', icon: '⚠️' },
                  { value: 'invalid', label: 'Inválidos', icon: '❌' },
                  { value: 'problematic', label: 'Problemáticos', icon: '🚨' }
                ].map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setStatusFilter(filter.value as StatusFilter)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      statusFilter === filter.value
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {filter.icon} {filter.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Información de progreso */}
          {pagination && !searchResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between text-sm text-blue-800">
                <span>
                  Mostrando <strong>{deaRecords.length}</strong> de{' '}
                  <strong>{pagination.totalRecords}</strong> DEAs 
                  {statusFilter !== 'all' && ` (filtrados por: ${statusFilter})`}
                </span>
                <span className="text-blue-600">
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
              </div>
              
              {/* Barra de progreso */}
              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(deaRecords.length / pagination.totalRecords) * 100}%` 
                  }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        {/* Resultado de búsqueda */}
        {searchResult && (
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Resultado de Búsqueda</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow border-2 border-blue-200">
                {searchResult.foto1 && (
                  <div className="h-48 bg-gray-200 overflow-hidden">
                    <img
                      src={searchResult.foto1}
                      alt={`DEA ${searchResult.numeroProvisionalDea}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      DEA #{searchResult.numeroProvisionalDea} (ID: {searchResult.id})
                    </h3>
                    <div className="flex gap-2">
                      <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                        {searchResult.tipoEstablecimiento}
                      </span>
                      {getStatusBadge(searchResult)}
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Nombre:</span> {searchResult.nombre}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Dirección:</span>{' '}
                      {searchResult.tipoVia} {searchResult.nombreVia} {searchResult.numeroVia}
                    </p>
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Distrito:</span> {searchResult.distrito}
                    </p>
                    {searchResult.addressValidation && (
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Estado de Validación:</span> {searchResult.addressValidation.overallStatus}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => startVerification(searchResult.id)}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Iniciar Verificación
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lista de DEAs */}
        {!searchResult && (
          <>
            {deaRecords.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No hay DEAs para verificar
                </h3>
                <p className="text-gray-600">
                  {statusFilter === 'all' 
                    ? 'Todos los DEAs con imágenes ya han sido verificados'
                    : `No hay DEAs con estado "${statusFilter}" disponibles para verificación`
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Grid de DEAs */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {deaRecords.map((record) => (
                    <div
                      key={record.id}
                      className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                    >
                      {record.foto1 && (
                        <div className="h-48 bg-gray-200 overflow-hidden">
                          <img
                            src={record.foto1}
                            alt={`DEA ${record.numeroProvisionalDea}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">
                            DEA #{record.numeroProvisionalDea}
                          </h3>
                          <div className="flex flex-col gap-1">
                            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                              {record.tipoEstablecimiento}
                            </span>
                            {getStatusBadge(record)}
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Nombre:</span> {record.nombre}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Dirección:</span>{' '}
                            {record.tipoVia} {record.nombreVia} {record.numeroVia}
                          </p>
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Distrito:</span> {record.distrito}
                          </p>
                        </div>
                        
                        <button
                          onClick={() => startVerification(record.id)}
                          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                        >
                          Iniciar Verificación
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Botón Cargar Más */}
                {pagination && pagination.hasNextPage && (
                  <div className="text-center">
                    <button
                      onClick={loadMoreRecords}
                      disabled={loadingMore}
                      className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium text-lg min-w-[200px]"
                    >
                      {loadingMore ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Cargando...
                        </div>
                      ) : (
                        `Cargar más DEAs (${pagination.totalRecords - deaRecords.length} restantes)`
                      )}
                    </button>
                  </div>
                )}

                {/* Mensaje cuando se han cargado todos */}
                {pagination && !pagination.hasNextPage && deaRecords.length > 12 && (
                  <div className="text-center py-8">
                    <div className="text-green-600 text-lg font-medium mb-2">
                      ✅ Todos los DEAs han sido cargados
                    </div>
                    <p className="text-gray-600">
                      Se han mostrado todos los {pagination.totalRecords} DEAs disponibles para verificación
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
