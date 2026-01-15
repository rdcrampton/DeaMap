"use client";

import {
  AlertCircle,
  Heart,
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Search,
  Clock,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import Link from "next/link";

import AedDetailModal from "@/components/AedDetailModal";
import type { Aed } from "@/types/aed";

// Dynamic import to avoid SSR issues with Leaflet
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-white/95 flex items-center justify-center">
      <div className="text-center">
        <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-600 mb-4" />
        <p className="text-gray-700 font-medium">Cargando mapa...</p>
      </div>
    </div>
  ),
});

interface NearbyAed extends Aed {
  distance: number;
}

interface GeocodingResult {
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    house_number?: string;
    postcode?: string;
    city?: string;
  };
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearbyAeds, setNearbyAeds] = useState<NearbyAed[]>([]);
  const [selectedAed, setSelectedAed] = useState<Aed | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const handleFindNearestByGeolocation = async () => {
    setLoading(true);
    setError(null);
    setNearbyAeds([]);
    setShowSearchResults(true);

    try {
      // Get user's location
      if (!navigator.geolocation) {
        throw new Error("La geolocalización no está disponible en tu navegador");
      }

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const { latitude, longitude } = position.coords;
      setUserLocation({ lat: latitude, lng: longitude });
      setSearchLocation({ lat: latitude, lng: longitude });

      // Fetch nearby AEDs
      const response = await fetch(
        `/api/aeds/nearby?lat=${latitude}&lng=${longitude}&limit=10&radius=10`
      );

      if (!response.ok) {
        throw new Error("Error al buscar DEAs cercanos");
      }

      const data = await response.json();

      if (data.success && data.data) {
        setNearbyAeds(data.data);
        if (data.data.length === 0) {
          setError(
            "No se encontraron DEAs en un radio de 10 km. Intenta ampliar la búsqueda o buscar por dirección."
          );
        }
      } else {
        throw new Error(data.message || "Error al buscar DEAs");
      }
    } catch (err) {
      console.error("Error finding nearest AEDs:", err);
      if (err instanceof GeolocationPositionError) {
        if (err.code === err.PERMISSION_DENIED) {
          setError(
            "Necesitas permitir el acceso a tu ubicación para encontrar DEAs cercanos. Por favor, activa la ubicación en tu navegador."
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("No se pudo determinar tu ubicación. Intenta buscar por dirección.");
        } else {
          setError("Tiempo de espera agotado. Intenta buscar por dirección.");
        }
      } else {
        setError(
          err instanceof Error ? err.message : "Error al buscar DEAs. Intenta buscar por dirección."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearchByAddress = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!address.trim()) {
      setError("Por favor, introduce una dirección");
      return;
    }

    setLoading(true);
    setError(null);
    setNearbyAeds([]);
    setShowSearchResults(true);

    try {
      // Geocode the address
      const geocodeResponse = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);

      if (!geocodeResponse.ok) {
        throw new Error("Error al buscar la dirección");
      }

      const geocodeData: GeocodingResult[] = await geocodeResponse.json();

      if (!geocodeData || geocodeData.length === 0) {
        throw new Error("No se encontró la dirección. Intenta con otra dirección más específica.");
      }

      // Use the first result
      const location = geocodeData[0];
      const lat = parseFloat(location.lat);
      const lng = parseFloat(location.lon);

      setSearchLocation({ lat, lng });

      // Fetch nearby AEDs
      const nearbyResponse = await fetch(
        `/api/aeds/nearby?lat=${lat}&lng=${lng}&limit=10&radius=10`
      );

      if (!nearbyResponse.ok) {
        throw new Error("Error al buscar DEAs cercanos");
      }

      const nearbyData = await nearbyResponse.json();

      if (nearbyData.success && nearbyData.data) {
        setNearbyAeds(nearbyData.data);
        if (nearbyData.data.length === 0) {
          setError(
            "No se encontraron DEAs cerca de esta dirección en un radio de 10 km. Intenta con otra dirección."
          );
        }
      } else {
        throw new Error(nearbyData.message || "Error al buscar DEAs");
      }
    } catch (err) {
      console.error("Error searching by address:", err);
      setError(err instanceof Error ? err.message : "Error al buscar por dirección");
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (aed: NearbyAed) => {
    setSelectedAed(aed);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedAed(null), 200);
  };

  const handleBackToMap = () => {
    setShowSearchResults(false);
    setNearbyAeds([]);
    setSearchLocation(null);
    setUserLocation(null);
    setError(null);
    setAddress("");
  };

  const handleMapMarkerClick = async (aed: { id: string; code: string; name: string }) => {
    try {
      const response = await fetch(`/api/aeds/${aed.id}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setSelectedAed(data.data);
          setModalOpen(true);
        }
      }
    } catch (error) {
      console.error("Error fetching AED details:", error);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)",
        backgroundAttachment: "fixed",
      }}
    >
      {/* Emergency Header */}
      <header className="text-center text-white px-4 sm:px-6 pt-8 pb-6">
        <div className="flex flex-col items-center justify-center gap-4 mb-4">
          <div
            className="p-4 rounded-full"
            style={{
              background: "rgba(255, 255, 255, 0.2)",
              backdropFilter: "blur(20px)",
              border: "2px solid rgba(255, 255, 255, 0.3)",
            }}
          >
            <Heart className="w-12 h-12 text-white animate-pulse" />
          </div>
          <div className="text-center">
            <h1 className="font-black text-4xl sm:text-5xl md:text-6xl mb-2 text-white">
              Encuentra un DEA
            </h1>
            <p className="text-xl sm:text-2xl opacity-90 mb-2">
              Desfibriladores cerca de ti
            </p>
            <div className="flex items-center justify-center gap-2 text-sm sm:text-base opacity-75">
              <MapPin className="w-4 h-4" />
              <span>Cobertura: España y Europa</span>
            </div>
          </div>
        </div>
        <div
          className="max-w-2xl mx-auto mt-6 p-4 rounded-lg"
          style={{
            background: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
          }}
        >
          <p className="text-sm sm:text-base leading-relaxed">
            <strong>En una emergencia cardíaca,</strong> cada segundo cuenta. Encuentra el
            desfibrilador más cercano a tu ubicación o busca por dirección.
          </p>
        </div>
      </header>

      {/* Search Section */}
      <main className="container mx-auto px-4 sm:px-6 py-6">
        <div
          className="rounded-2xl shadow-2xl p-6 sm:p-8 max-w-4xl mx-auto mb-8"
          style={{
            background: "rgba(255, 255, 255, 0.98)",
            backdropFilter: "blur(20px)",
          }}
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 text-center">
            ¿Cómo quieres buscar?
          </h2>

          {/* Geolocation Button */}
          <div className="mb-6">
            <button
              onClick={handleFindNearestByGeolocation}
              disabled={loading}
              className="w-full py-5 px-6 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-bold text-lg shadow-xl hover:shadow-2xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Buscando...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-6 h-6" />
                  <span>Usar mi ubicación actual</span>
                </>
              )}
            </button>
            <p className="text-sm text-gray-600 mt-2 text-center">
              Encuentra los DEAs más cercanos a ti ahora mismo
            </p>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500 font-medium">O busca por dirección</span>
            </div>
          </div>

          {/* Address Search */}
          <form onSubmit={handleSearchByAddress} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-400" />
              <input
                type="text"
                placeholder="Escribe una dirección (ej: Calle Gran Vía 1, Madrid)"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={loading}
                className="w-full pl-14 pr-4 py-4 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !address.trim()}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Buscar DEAs cerca de esta dirección
            </button>
          </form>
        </div>

        {/* Error Message */}
        {error && showSearchResults && (
          <div
            className="max-w-4xl mx-auto mb-8 p-4 rounded-xl border-2"
            style={{
              background: "rgba(254, 226, 226, 0.98)",
              borderColor: "#f87171",
            }}
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">Información importante</p>
                <p className="text-red-800 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Search Results */}
        {showSearchResults && nearbyAeds.length > 0 && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div
              className="p-6 rounded-xl"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {nearbyAeds.length} DEA{nearbyAeds.length !== 1 ? "s" : ""} encontrado
                    {nearbyAeds.length !== 1 ? "s" : ""}
                  </h3>
                  <p className="text-gray-600">
                    Ordenados por distancia - El más cercano primero
                  </p>
                </div>
                <button
                  onClick={handleBackToMap}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Ver mapa completo
                </button>
              </div>
            </div>

            {/* Map View with search results */}
            {searchLocation && (
              <div
                className="rounded-xl overflow-hidden shadow-2xl"
                style={{
                  background: "rgba(255, 255, 255, 0.95)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700">
                  <h4 className="text-white font-bold text-lg flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Mapa de DEAs cercanos
                  </h4>
                </div>
                <MapView onAedClick={handleMapMarkerClick} />
              </div>
            )}

            {/* Results Grid */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {nearbyAeds.map((aed, index) => (
                <NearbyAedCard
                  key={aed.id}
                  aed={aed}
                  rank={index + 1}
                  onClick={() => handleCardClick(aed)}
                />
              ))}
            </div>
          </div>
        )}

        {/* General Map View - Show when not searching */}
        {!showSearchResults && (
          <div className="max-w-7xl mx-auto space-y-6">
            <div
              className="p-6 rounded-xl text-center"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Mapa de DEAs
              </h3>
              <p className="text-gray-600">
                Explora todos los desfibriladores registrados en España
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Haz clic en cualquier marcador para ver los detalles del DEA
              </p>
            </div>

            {/* Full Map */}
            <div
              className="rounded-xl overflow-hidden shadow-2xl"
              style={{
                background: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="p-4 bg-gradient-to-r from-red-600 to-red-700">
                <h4 className="text-white font-bold text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Vista general de DEAs disponibles
                </h4>
              </div>
              <MapView onAedClick={handleMapMarkerClick} />
            </div>
          </div>
        )}

        {/* Info Section */}
        <div
          className="max-w-4xl mx-auto mt-12 p-6 sm:p-8 rounded-xl"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(20px)",
          }}
        >
          <h3 className="text-xl font-bold text-gray-900 mb-4">Sobre DeaMap</h3>
          <div className="space-y-3 text-gray-700">
            <p>
              DeaMap es un mapa colaborativo de desfibriladores (DEAs) que te ayuda a encontrar el
              equipo más cercano en caso de emergencia cardíaca.
            </p>
            <p className="text-sm text-gray-600">
              Actualmente contamos con cobertura en España, con planes de expansión a nivel europeo.
              Si conoces la ubicación de un DEA que no está en el mapa, puedes{" "}
              <Link href="/dea/new" className="text-blue-600 hover:underline font-medium">
                agregarlo aquí
              </Link>
              .
            </p>
          </div>
        </div>
      </main>

      {/* Detail Modal */}
      <AedDetailModal aed={selectedAed} isOpen={modalOpen} onClose={handleCloseModal} />
    </div>
  );
}

/**
 * Nearby AED Card Component
 */
function NearbyAedCard({
  aed,
  rank,
  onClick,
}: {
  aed: NearbyAed;
  rank: number;
  onClick: () => void;
}) {
  const displayImage =
    aed.images && aed.images.length > 0
      ? aed.images[0].thumbnail_url || aed.images[0].processed_url || aed.images[0].original_url
      : null;

  const distanceText =
    aed.distance < 1
      ? `${Math.round(aed.distance * 1000)} m`
      : `${aed.distance.toFixed(1)} km`;

  return (
    <button
      onClick={onClick}
      className="w-full rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group cursor-pointer text-left relative"
      style={{
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px)",
        border: rank === 1 ? "3px solid #DC2626" : "1px solid rgba(255, 255, 255, 0.3)",
      }}
    >
      {/* Rank Badge */}
      <div
        className="absolute top-3 left-3 z-10 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg"
        style={{
          background:
            rank === 1
              ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
              : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
        }}
      >
        {rank}
      </div>

      {/* Image or Gradient Header */}
      {displayImage ? (
        <div className="relative h-48 overflow-hidden">
          <img
            src={displayImage}
            alt={aed.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%)",
            }}
          />
        </div>
      ) : (
        <div
          className="h-48"
          style={{
            background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
          }}
        />
      )}

      {/* Content */}
      <div className="p-5 space-y-3">
        {/* Distance Badge */}
        <div
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full font-bold text-lg"
          style={{
            background:
              rank === 1
                ? "linear-gradient(135deg, #DC2626 0%, #991B1B 100%)"
                : "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)",
            color: "white",
          }}
        >
          <Navigation className="w-5 h-5" />
          <span>{distanceText}</span>
        </div>

        {/* Name and Code */}
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">{aed.name}</h3>
          <p className="text-sm text-gray-500">{aed.code}</p>
        </div>

        {/* Type */}
        <div>
          <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
            {aed.establishment_type}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 text-sm text-gray-600">
          <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-gray-900">
              {aed.location.street_type} {aed.location.street_name} {aed.location.street_number}
            </p>
            <p className="text-gray-500 text-xs mt-1">
              {aed.location.postal_code}
              {aed.location.district_name && ` - ${aed.location.district_name}`}
            </p>
          </div>
        </div>

        {/* Schedule */}
        {aed.schedule && (
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-gray-700">
              {aed.schedule.has_24h_surveillance
                ? "Disponible 24h"
                : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                  ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                  : "Horario no especificado"}
            </p>
          </div>
        )}

        {/* Contact */}
        {aed.responsible && aed.responsible.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <p className="text-gray-700">{aed.responsible.phone}</p>
          </div>
        )}

        {/* View Details Button */}
        <div className="pt-3 border-t border-gray-200">
          <div className="flex items-center justify-center gap-2 text-blue-600 font-medium">
            <span>Ver detalles y cómo llegar</span>
            <MapPin className="w-5 h-5" />
          </div>
        </div>
      </div>
    </button>
  );
}
