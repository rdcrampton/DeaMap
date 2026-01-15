"use client";

import { AlertTriangle, Loader2, Shield } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import NoOrganizationMessage from "@/components/verification/NoOrganizationMessage";
import OrganizationSelector from "@/components/verification/OrganizationSelector";
import { useAuth } from "@/contexts/AuthContext";

interface AedForVerification {
  id: string;
  name: string;
  code?: string;
  provisional_number?: number;
  establishment_type?: string;
  location?: {
    street_type?: string;
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    district_name?: string | null;
    neighborhood_name?: string | null;
    city_name?: string | null;
  };
  images?: Array<{
    id: string;
    original_url: string;
    type: string;
  }>;
  status: string;
}

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UserOrganization {
  id: string;
  name: string;
  type: string;
  role: string;
  can_verify: boolean;
}

interface ApiResponse {
  data: AedForVerification[];
  pagination: PaginationInfo;
  userOrganizations: UserOrganization[];
  isAdmin: boolean;
}

export default function VerifyPage() {
  const { user, loading: authLoading } = useAuth();
  const [aeds, setAeds] = useState<AedForVerification[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<UserOrganization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/verify");
      return;
    }

    if (user) {
      fetchAeds();
    }
  }, [authLoading, user, router]);

  // Refetch when organization changes
  useEffect(() => {
    if (user && !loading) {
      fetchAeds(1, selectedOrgId);
    }
  }, [selectedOrgId]);

  const fetchAeds = async (page: number = 1, orgId: string | null = selectedOrgId) => {
    try {
      setLoading(page === 1);
      const url = new URL("/api/verify", window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", "12");
      if (orgId) {
        url.searchParams.set("organization_id", orgId);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Error al cargar DEAs");
      }

      const data: ApiResponse = await response.json();
      setAeds(data.data);
      setPagination(data.pagination);
      setUserOrganizations(data.userOrganizations || []);
      setIsAdmin(data.isAdmin || false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const loadMoreAeds = async () => {
    if (!pagination || !pagination.hasNextPage || loadingMore) return;

    try {
      setLoadingMore(true);
      const nextPage = pagination.currentPage + 1;
      const url = new URL("/api/verify", window.location.origin);
      url.searchParams.set("page", nextPage.toString());
      url.searchParams.set("limit", "12");
      if (selectedOrgId) {
        url.searchParams.set("organization_id", selectedOrgId);
      }

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Error al cargar más DEAs");
      }

      const data: ApiResponse = await response.json();
      setAeds((prev) => [...prev, ...data.data]);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar más DEAs");
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOrganizationChange = (orgId: string | null) => {
    setSelectedOrgId(orgId);
    setAeds([]); // Clear current list
  };

  const startVerification = (aedId: string) => {
    router.push(`/verify/${aedId}`);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show message if user has no organizations and is not admin
  if (!isAdmin && userOrganizations.length === 0 && !loading) {
    return <NoOrganizationMessage />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Verificación de DEAs</h1>
              <p className="text-gray-600">
                Selecciona un DEA para iniciar el proceso de verificación
              </p>
            </div>
            <button
              onClick={() => router.push("/verify/duplicates")}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-100 text-yellow-800 border border-yellow-300 rounded-lg hover:bg-yellow-200 transition-colors font-medium"
            >
              <AlertTriangle className="w-5 h-5" />
              Ver Posibles Duplicados
            </button>
          </div>

          {/* Admin badge */}
          {isAdmin && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-purple-600" />
                <div>
                  <div className="text-sm text-purple-600 font-medium">Modo Administrador</div>
                  <div className="text-sm text-purple-700">
                    Visualizando todos los DEAs del sistema
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Organization selector (only for non-admin users) */}
          {!isAdmin && userOrganizations.length > 0 && (
            <div className="mb-6">
              <OrganizationSelector
                organizations={userOrganizations}
                selectedOrgId={selectedOrgId}
                onChange={handleOrganizationChange}
              />
            </div>
          )}

          {pagination && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between text-sm text-blue-800">
                <span>
                  Mostrando <strong>{aeds.length}</strong> de{" "}
                  <strong>{pagination.totalRecords}</strong> DEAs pendientes
                </span>
                <span className="text-blue-600">
                  Página {pagination.currentPage} de {pagination.totalPages}
                </span>
              </div>

              <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(aeds.length / pagination.totalRecords) * 100}%`,
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

        {aeds.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No hay DEAs pendientes de verificar
            </h3>
            <p className="text-gray-600">Todos los DEAs han sido verificados</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {aeds.map((aed) => {
                const firstImage = aed.images?.[0];
                return (
                  <div
                    key={aed.id}
                    className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {firstImage && (
                      <div className="h-48 bg-gray-200 overflow-hidden">
                        <img
                          src={firstImage.original_url}
                          alt={`DEA ${aed.name}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {aed.code ||
                            (aed.provisional_number ? `#${aed.provisional_number}` : "Sin código")}
                        </h3>
                        <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded">
                          Pendiente
                        </span>
                      </div>

                      <div className="space-y-2 mb-4">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Nombre:</span> {aed.name}
                        </p>
                        {aed.establishment_type && (
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Tipo:</span> {aed.establishment_type}
                          </p>
                        )}
                        {aed.location && (
                          <>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Dirección:</span>{" "}
                              {aed.location.street_type} {aed.location.street_name}{" "}
                              {aed.location.street_number}
                            </p>
                            {aed.location.district_name && (
                              <p className="text-sm text-gray-600">
                                <span className="font-medium">Distrito:</span>{" "}
                                {aed.location.district_name}
                              </p>
                            )}
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => startVerification(aed.id)}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                      >
                        Iniciar Verificación
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {pagination && pagination.hasNextPage && (
              <div className="text-center">
                <button
                  onClick={loadMoreAeds}
                  disabled={loadingMore}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors font-medium text-lg min-w-[200px]"
                >
                  {loadingMore ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      Cargando...
                    </div>
                  ) : (
                    `Cargar más DEAs (${pagination.totalRecords - aeds.length} restantes)`
                  )}
                </button>
              </div>
            )}

            {pagination && !pagination.hasNextPage && aeds.length > 12 && (
              <div className="text-center py-8">
                <div className="text-green-600 text-lg font-medium mb-2">
                  ✅ Todos los DEAs han sido cargados
                </div>
                <p className="text-gray-600">
                  Se han mostrado todos los {pagination.totalRecords} DEAs disponibles
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
