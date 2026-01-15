"use client";

import { Search, MapPin, Filter, CheckCircle, XCircle, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, use } from "react";

interface AedItem {
  id: string;
  name: string | null;
  address: string;
  city: string | null;
  is_active: boolean;
  last_verified_at: Date | null;
  establishment_type: string | null;
  assignment_type: string;
}

export default function OrgDeasPage({ params }: { params: Promise<{ orgId: string }> }) {
  const [deas, setDeas] = useState<AedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;

  useEffect(() => {
    const fetchDeas = async () => {
      try {
        const response = await fetch(`/api/organizations/${orgId}/deas`);
        if (response.ok) {
          const data = await response.json();
          setDeas(data.deas || []);
        }
      } catch (error) {
        console.error("Error fetching DEAs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeas();
  }, [orgId]);

  // Filtrar DEAs
  const filteredDeas = deas.filter((dea) => {
    // Filtro de búsqueda
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        dea.name?.toLowerCase().includes(query) ||
        dea.address.toLowerCase().includes(query) ||
        dea.city?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Filtro de estado
    if (filterStatus === "active" && !dea.is_active) return false;
    if (filterStatus === "inactive" && dea.is_active) return false;

    return true;
  });

  const needsVerification = (lastVerified: Date | null) => {
    if (!lastVerified) return true;
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    return new Date(lastVerified) < oneYearAgo;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">DEAs</h1>
        <p className="text-sm text-gray-600">{deas.length} desfibriladores asignados</p>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, dirección o ciudad..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              filterStatus === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterStatus("active")}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              filterStatus === "active"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Activos
          </button>
          <button
            onClick={() => setFilterStatus("inactive")}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${
              filterStatus === "inactive"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Inactivos
          </button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-600">
        {filteredDeas.length} resultados
      </p>

      {/* DEA List */}
      <div className="space-y-3">
        {filteredDeas.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">No se encontraron DEAs</p>
          </div>
        ) : (
          filteredDeas.map((dea) => (
            <Link
              key={dea.id}
              href={`/dea/${dea.id}`}
              className="block bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-98"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {dea.name || "DEA sin nombre"}
                    </h3>
                    {dea.is_active ? (
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </div>

                  <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                    {dea.address}
                    {dea.city && ` • ${dea.city}`}
                  </p>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    {dea.establishment_type && (
                      <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        {dea.establishment_type}
                      </span>
                    )}

                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                      {dea.assignment_type}
                    </span>

                    {needsVerification(dea.last_verified_at) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-orange-100 text-orange-700">
                        <Clock className="w-3 h-3" />
                        Requiere verificación
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
