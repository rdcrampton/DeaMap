'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  SkipForward
} from 'lucide-react';
import StreetViewImage from './StreetViewImage';

// Declarar tipos para Leaflet
declare global {
  interface Window {
    L: Record<string, unknown>;
  }
}

interface CoordinatesMapProps {
  userCoordinates: { lat: number; lng: number };
  officialCoordinates: { lat?: number; lng?: number };
  distance: number;
  formatDistance: (distance: number) => string;
}

function CoordinatesMap({ userCoordinates, officialCoordinates, distance, formatDistance }: CoordinatesMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!mapRef.current || !officialCoordinates.lat || !officialCoordinates.lng) return;

    // Función para cargar Leaflet
    const loadLeaflet = () => {
      return new Promise<void>((resolve) => {
        if (window.L) {
          resolve();
          return;
        }

        // Cargar CSS de Leaflet
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);

        // Cargar JS de Leaflet
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    // Función para inicializar el mapa
    const initMap = async () => {
      try {
        await loadLeaflet();

        if (mapInstanceRef.current && typeof mapInstanceRef.current === 'object' && 'remove' in mapInstanceRef.current) {
          (mapInstanceRef.current as { remove: () => void }).remove();
        }

        const L = window.L as any; // eslint-disable-line @typescript-eslint/no-explicit-any

        // Calcular centro
        const centerLat = (userCoordinates.lat + (officialCoordinates.lat || 0)) / 2;
        const centerLng = (userCoordinates.lng + (officialCoordinates.lng || 0)) / 2;

        // Crear el mapa
        const map = L.map(mapRef.current).setView([centerLat, centerLng], 15);
        mapInstanceRef.current = map;

        // Añadir capa de OpenStreetMap
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Crear iconos personalizados
        const userIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="
            background-color: #eab308; 
            color: white; 
            width: 30px; 
            height: 30px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: bold; 
            font-size: 14px; 
            border: 3px solid white; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">U</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        const officialIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="
            background-color: #003DF6; 
            color: white; 
            width: 30px; 
            height: 30px; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-weight: bold; 
            font-size: 14px; 
            border: 3px solid white; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">O</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15]
        });

        // Añadir marcadores
        const userMarker = L.marker([userCoordinates.lat, userCoordinates.lng], { icon: userIcon })
          .addTo(map)
          .bindPopup(`<b>Coordenadas del Usuario</b><br/>Lat: ${userCoordinates.lat.toFixed(6)}<br/>Lng: ${userCoordinates.lng.toFixed(6)}`);

        const officialMarker = L.marker([officialCoordinates.lat!, officialCoordinates.lng!], { icon: officialIcon })
          .addTo(map)
          .bindPopup(`<b>Coordenadas Oficiales</b><br/>Lat: ${officialCoordinates.lat!.toFixed(6)}<br/>Lng: ${officialCoordinates.lng!.toFixed(6)}`);

        // Añadir línea conectora
        const latlngs = [
          [userCoordinates.lat, userCoordinates.lng],
          [officialCoordinates.lat, officialCoordinates.lng]
        ];

        const polyline = L.polyline(latlngs, {
          color: '#666',
          weight: 3,
          opacity: 0.8,
          dashArray: '10, 5'
        }).addTo(map);

        // Ajustar vista para incluir ambos marcadores
        const group = new L.featureGroup([userMarker, officialMarker, polyline]);
        map.fitBounds(group.getBounds().pad(0.1));

        // Añadir control de distancia
        const distanceControl = L.control({ position: 'bottomleft' });
        distanceControl.onAdd = function() {
          const div = L.DomUtil.create('div', 'distance-info');
          div.style.cssText = 'background: rgba(255,255,255,0.95); padding: 8px; border-radius: 4px; font-size: 12px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid #ccc;';
          div.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <div style="width: 12px; height: 12px; background: #eab308; border-radius: 50%; margin-right: 6px; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>
              <span style="font-weight: 500;">Usuario</span>
            </div>
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <div style="width: 12px; height: 12px; background: #003DF6; border-radius: 50%; margin-right: 6px; border: 2px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>
              <span style="font-weight: 500;">Oficial</span>
            </div>
            <div style="border-top: 1px solid #ddd; padding-top: 4px; font-weight: bold; color: #666;">
              📏 ${formatDistance(distance)}
            </div>
          `;
          return div;
        };
        distanceControl.addTo(map);

      } catch (error) {
        console.error('Error inicializando mapa:', error);
        if (mapRef.current) {
          mapRef.current.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">Error cargando el mapa</div>';
        }
      }
    };

    initMap();

    // Cleanup
    return () => {
      if (mapInstanceRef.current && typeof mapInstanceRef.current === 'object' && 'remove' in mapInstanceRef.current) {
        (mapInstanceRef.current as any).remove(); // eslint-disable-line @typescript-eslint/no-explicit-any
        mapInstanceRef.current = null;
      }
    };
  }, [userCoordinates, officialCoordinates, distance, formatDistance]);

  return (
    <div className="mt-4 p-4 bg-gray-50 rounded border">
      <div className="font-medium text-gray-800 mb-3 flex items-center">
        <span className="text-lg mr-2">🗺️</span>
        Visualización de Coordenadas
      </div>
      <div
        ref={mapRef}
        className="bg-white rounded border"
        style={{ height: '300px', width: '100%' }}
      />

      {/* Información adicional del mapa */}
      <div className="mt-3 text-center text-sm text-gray-600">
        <div className="flex items-center justify-center space-x-4">
          <span>🟡 Coordenadas del Usuario</span>
          <span>🔵 Coordenadas Oficiales</span>
          <span>📏 Distancia: {formatDistance(distance)}</span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          Mapa interactivo con marcadores nativos de OpenStreetMap. Haz clic en los marcadores para ver detalles.
        </div>
      </div>
    </div>
  );
}

interface ValidationStep {
  stepNumber: 1 | 2 | 3 | 4;
  title: string;
  status: 'pending' | 'current' | 'completed' | 'skipped';
  required: boolean;
  skipReason?: string;
}

interface AddressData {
  tipoVia: string;
  nombreVia: string;
  numeroVia?: string;
  codigoPostal: string;
  distrito: number;
  latitud?: number;
  longitud?: number;
  confidence?: number;
}

interface OriginalRecord {
  tipoVia: string;
  nombreVia: string;
  numeroVia?: string;
  complementoDireccion?: string;
  codigoPostal: string;
  distrito: string;
  latitud: number;
  longitud: number;
}

interface Step1Data {
  searchResult: {
    found: boolean;
    officialData?: AddressData;
    alternatives: AddressData[];
    exactMatch?: boolean;
  };
  originalRecord?: OriginalRecord;
  message?: string;
}

interface CurrentStepData {
  customPostalCode?: string;
  customDistrict?: number;
  customLat?: number;
  customLng?: number;
}

interface StepValidationProgress {
  deaRecordId: number;
  currentStep: number;
  totalSteps: number;
  steps: ValidationStep[];
  stepData: {
    step1?: {
      selectedAddress: AddressData;
      userConfirmed: boolean;
      timestamp: Date;
    };
    step2?: {
      originalPostalCode: string;
      confirmedPostalCode: string;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
    step3?: {
      originalDistrict: string;
      confirmedDistrict: number;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
    step4?: {
      originalCoordinates: { lat: number; lng: number };
      confirmedCoordinates: { lat: number; lng: number };
      distance: number;
      userConfirmed: boolean;
      autoSkipped: boolean;
      timestamp: Date;
    };
  };
  isComplete: boolean;
  completedAt?: Date;
}

interface StepByStepValidationProps {
  deaRecordId: number;
  onComplete?: (progress: StepValidationProgress) => void;
}

export default function StepByStepValidation({
  deaRecordId,
  onComplete
}: StepByStepValidationProps) {
  const [progress, setProgress] = useState<StepValidationProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [currentStepData, setCurrentStepData] = useState<CurrentStepData>({});
  const [confirmingAddress, setConfirmingAddress] = useState(false);

  const initializeValidation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dea/${deaRecordId}/validate-steps`);
      const data = await response.json();

      console.log('🔍 FRONTEND DEBUG: Respuesta del backend:', JSON.stringify(data, null, 2));

      if (data.success) {
        console.log('✅ FRONTEND DEBUG: Progress recibido:', JSON.stringify(data.data.progress, null, 2));
        console.log('📊 FRONTEND DEBUG: step1Data recibido:', JSON.stringify(data.data.step1Data, null, 2));
        
        setProgress(data.data.progress);
        if (data.data.step1Data) {
          setStep1Data(data.data.step1Data);
        }
      } else {
        setError(data.error || 'Error inicializando validación');
      }
    } catch (error) {
      console.error('❌ FRONTEND DEBUG: Error en fetch:', error);
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeValidation();
  }, [deaRecordId]);


  const executeStep = async (stepNumber: number, stepData: Record<string, unknown>) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/dea/${deaRecordId}/validate-steps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          step: stepNumber,
          data: stepData
        })
      });

      const data = await response.json();

      if (data.success) {
        setProgress(data.data.progress);
        setCurrentStepData({});

        if (data.data.isComplete) {
          onComplete?.(data.data.progress);
        }
      } else {
        setError(data.error || 'Error ejecutando paso');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (step: ValidationStep) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'current':
        return <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
          <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>;
      case 'skipped':
        return <SkipForward className="w-5 h-5 text-gray-400" />;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full"></div>;
    }
  };

  const getStepColor = (step: ValidationStep) => {
    switch (step.status) {
      case 'completed':
        return 'text-green-600';
      case 'current':
        return 'text-blue-600 font-semibold';
      case 'skipped':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  };

  const renderStep1 = () => {
    if (!step1Data?.searchResult) return null;

    const { searchResult } = step1Data;

    return (
      <div className="space-y-4">


          {searchResult.found ? (
            <div className="space-y-3">
              {searchResult.officialData && (
                <div className="bg-white p-3 rounded border border-blue-200">
                  <div className="flex items-center mb-2">
                    {searchResult.exactMatch ? (
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-yellow-500 mr-2" />
                    )}
                    <span className="font-medium">
                      {searchResult.exactMatch ? 'Coincidencia exacta' : 'Mejor coincidencia'}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div><strong>Dirección:</strong> {searchResult.officialData.tipoVia} {searchResult.officialData.nombreVia} {searchResult.officialData.numeroVia}</div>
                    <div><strong>Código Postal:</strong> {searchResult.officialData.codigoPostal}</div>
                    <div><strong>Distrito:</strong> {searchResult.officialData.distrito}</div>
                    <div><strong>Confianza:</strong> {((searchResult.officialData.confidence || 0) * 100).toFixed(1)}%</div>
                    {searchResult.officialData.latitud && searchResult.officialData.longitud && (
                      <div className="mt-2 p-2 bg-blue-50 rounded">
                        <div><strong>Coordenadas Oficiales:</strong></div>
                        <div className="font-mono text-xs">
                          Lat: {searchResult.officialData.latitud.toFixed(6)},
                          Lng: {searchResult.officialData.longitud.toFixed(6)}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={async () => {
                      setConfirmingAddress(true);
                      try {
                        await executeStep(1, { selectedAddress: searchResult.officialData });
                      } finally {
                        setConfirmingAddress(false);
                      }
                    }}
                    disabled={loading || confirmingAddress}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center"
                  >
                    {confirmingAddress ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Confirmando dirección...
                      </>
                    ) : (
                      'Confirmar esta dirección'
                    )}
                  </button>
                </div>
              )}

              {searchResult.alternatives.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-700 mb-2">Alternativas disponibles:</h5>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {searchResult.alternatives.map((alt: AddressData, altIndex: number) => (
                      <div key={altIndex} className="bg-yellow-50 p-2 rounded border">
                        <div className="text-sm">
                          <div><strong>Dirección:</strong> {alt.tipoVia} {alt.nombreVia} {alt.numeroVia}</div>
                          <div><strong>CP:</strong> {alt.codigoPostal} | <strong>Distrito:</strong> {alt.distrito}</div>
                          <div><strong>Confianza:</strong> {((alt.confidence || 0) * 100).toFixed(1)}%</div>
                        </div>
                        <button
                          onClick={() => executeStep(1, { selectedAddress: alt })}
                          disabled={loading}
                          className="mt-2 px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700 disabled:opacity-50"
                        >
                          Seleccionar esta
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-red-50 p-3 rounded border border-red-200">
              <div className="flex items-center text-red-700">
                <XCircle className="w-4 h-4 mr-2" />
                <span>No se encontró dirección oficial</span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                Verifique los datos de la dirección manualmente
              </p>
            </div>
          )}
      </div>
    );
  };

  const renderStep2 = () => {
    const step1Address = progress?.stepData.step1?.selectedAddress;
    if (!step1Address) return null;

    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h4 className="font-semibold text-yellow-800 mb-2">
            Verificar Código Postal
          </h4>

          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <div className="text-sm space-y-3">
                {/* Mostrar código postal del usuario original */}
                {step1Data?.originalRecord && (
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="font-medium text-gray-800 mb-2">Código Postal del Usuario:</div>
                    <div className="font-mono text-lg text-gray-700">
                      {step1Data.originalRecord.codigoPostal}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-blue-50 rounded border">
                  <div className="font-medium text-blue-800 mb-2">Código Postal Oficial:</div>
                  <div className="font-mono text-lg text-blue-600">
                    {step1Address.codigoPostal}
                  </div>
                </div>

                {/* Mostrar comparación si son diferentes */}
                {step1Data?.originalRecord && step1Data.originalRecord.codigoPostal !== step1Address.codigoPostal && (
                  <div className="p-3 bg-yellow-50 rounded border border-yellow-200">
                    <div className="flex items-center text-yellow-800">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      <span className="font-medium">Los códigos postales no coinciden</span>
                    </div>
                    <div className="text-sm text-yellow-700 mt-1">
                      Se recomienda usar el código postal oficial: <strong>{step1Address.codigoPostal}</strong>
                    </div>
                  </div>
                )}

                <div className="text-gray-600">
                  ¿Confirma que este es el código postal correcto?
                </div>
              </div>

              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => executeStep(2, { confirmedPostalCode: step1Address.codigoPostal })}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>

                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="Código postal alternativo"
                    value={currentStepData.customPostalCode || ''}
                    onChange={(e) => setCurrentStepData(prev => ({ ...prev, customPostalCode: e.target.value }))}
                    className="px-3 py-2 border rounded text-sm"
                    maxLength={5}
                  />
                  <button
                    onClick={() => executeStep(2, { confirmedPostalCode: currentStepData.customPostalCode })}
                    disabled={loading || !currentStepData.customPostalCode}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Usar este
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    const step1Address = progress?.stepData.step1?.selectedAddress;
    if (!step1Address) return null;

    return (
      <div className="space-y-4">
        {/* Mostrar información de dirección pre-validada cuando se saltan pasos */}
        {step1Data?.message && step1Data.message.includes('previamente validada') && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-green-800 mb-2">Dirección Pre-Validada</h4>
                <p className="text-sm text-green-700 mb-3">{step1Data.message}</p>
                
                <div className="bg-white p-3 rounded border border-green-200">
                  <div className="text-sm space-y-2">
                    <div>
                      <strong>Dirección Validada:</strong> {step1Address.tipoVia} {step1Address.nombreVia} {step1Address.numeroVia}
                    </div>
                    <div>
                      <strong>Código Postal:</strong> {step1Address.codigoPostal}
                    </div>
                    <div className="flex items-center text-green-700">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      <span className="text-xs">Pasos 1 y 2 completados automáticamente</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="bg-purple-50 p-4 rounded-lg">
          <h4 className="font-semibold text-purple-800 mb-2">
            Verificar Distrito
          </h4>

          <div className="space-y-3">
            <div className="bg-white p-3 rounded border">
              <div className="text-sm space-y-2">
                <div>
                  <strong>Distrito Oficial:</strong>
                  <span className="ml-2 font-mono text-blue-600">{step1Address.distrito}</span>
                </div>
                <div className="text-gray-600">
                  ¿Confirma que este es el distrito correcto?
                </div>
              </div>

              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => executeStep(3, { confirmedDistrict: step1Address.distrito })}
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
                </button>

                <div className="flex items-center space-x-2">
                  <select
                    value={currentStepData.customDistrict || ''}
                    onChange={(e) => setCurrentStepData(prev => ({ ...prev, customDistrict: parseInt(e.target.value) }))}
                    className="px-3 py-2 border rounded text-sm"
                    aria-label="Seleccionar distrito"
                  >
                    <option value="">Seleccionar distrito</option>
                    {Array.from({ length: 21 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => executeStep(3, { confirmedDistrict: currentStepData.customDistrict })}
                    disabled={loading || !currentStepData.customDistrict}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    Usar este
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStep4 = () => {
    const step1Address = progress?.stepData.step1?.selectedAddress;
    if (!step1Address) return null;

    // Mostrar información de dirección pre-validada cuando se saltan pasos
    const showPreValidatedInfo = step1Data?.message && step1Data.message.includes('previamente validada');

    // Calcular distancia entre coordenadas del usuario y oficiales
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371; // Radio de la Tierra en km
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const formatDistance = (distanceKm: number): string => {
      if (distanceKm < 0.001) {
        return `${Math.round(distanceKm * 1000000)} mm`;
      } else if (distanceKm < 1) {
        return `${Math.round(distanceKm * 1000)} m`;
      } else {
        return `${distanceKm.toFixed(2)} km`;
      }
    };

    const getDistanceAlert = (distanceKm: number) => {
      if (distanceKm < 0.05) { // Menos de 50m
        return {
          color: 'green',
          icon: '✅',
          message: 'Las coordenadas son muy precisas'
        };
      } else if (distanceKm < 0.2) { // Menos de 200m
        return {
          color: 'yellow',
          icon: '⚠️',
          message: 'Diferencia moderada en las coordenadas'
        };
      } else {
        return {
          color: 'red',
          icon: '🚨',
          message: 'Las coordenadas difieren significativamente'
        };
      }
    };

    const userCoordinates = step1Data?.originalRecord ? {
      lat: step1Data.originalRecord.latitud,
      lng: step1Data.originalRecord.longitud
    } : null;

    const officialCoordinates = {
      lat: step1Address.latitud,
      lng: step1Address.longitud
    };

    const distance = userCoordinates && officialCoordinates.lat && officialCoordinates.lng
      ? calculateDistance(userCoordinates.lat, userCoordinates.lng, officialCoordinates.lat, officialCoordinates.lng)
      : null;

    const distanceAlert = distance ? getDistanceAlert(distance) : null;

    return (
        <>
              {/* Mostrar información de dirección pre-validada cuando se saltan pasos */}
              {showPreValidatedInfo && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-green-800 mb-2">Validación Previa Completada</h4>
                      <div className="text-sm space-y-2">
                        <div className="flex items-center text-green-700">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <span>Dirección: {step1Address.tipoVia} {step1Address.nombreVia} {step1Address.numeroVia}</span>
                        </div>
                        <div className="flex items-center text-green-700">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <span>Código Postal: {step1Address.codigoPostal}</span>
                        </div>
                        <div className="flex items-center text-green-700">
                          <CheckCircle className="w-4 h-4 mr-2" />
                          <span>Distrito: {step1Address.distrito}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Coordenadas del Usuario */}
                {userCoordinates && (
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="font-medium text-gray-800 mb-2 flex items-center">
                      <span className="text-blue-500 mr-2">👤</span>
                      Coordenadas del Usuario:
                    </div>
                    <div className="font-mono text-sm text-gray-700">
                      <div>Lat: {userCoordinates.lat.toFixed(6)}</div>
                      <div>Lng: {userCoordinates.lng.toFixed(6)}</div>
                    </div>
                  </div>
                )}

                {/* Coordenadas Oficiales */}
                <div className="p-3 bg-blue-50 rounded border">
                  <div className="font-medium text-blue-800 mb-2 flex items-center">
                    <span className="text-blue-500 mr-2">🏛️</span>
                    Coordenadas Oficiales:
                  </div>
                  <div className="font-mono text-sm text-blue-700">
                    <div>Lat: {officialCoordinates.lat?.toFixed(6) || 'No disponible'}</div>
                    <div>Lng: {officialCoordinates.lng?.toFixed(6) || 'No disponible'}</div>
                  </div>
                </div>
              </div>

              {/* Información de Distancia */}
              {distance !== null && distanceAlert && (
                <div className={`mt-4 p-3 rounded border ${
                  distanceAlert.color === 'green' ? 'bg-green-50 border-green-200' :
                  distanceAlert.color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className={`flex items-center ${
                    distanceAlert.color === 'green' ? 'text-green-800' :
                    distanceAlert.color === 'yellow' ? 'text-yellow-800' :
                    'text-red-800'
                  }`}>
                    <span className="text-lg mr-2">{distanceAlert.icon}</span>
                    <div>
                      <div className="font-semibold">
                        📏 Distancia: {formatDistance(distance)}
                      </div>
                      <div className="text-sm mt-1">
                        {distanceAlert.message}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mapa Visual de Coordenadas */}
              {userCoordinates && officialCoordinates.lat && officialCoordinates.lng && (
                <CoordinatesMap
                  userCoordinates={userCoordinates}
                  officialCoordinates={officialCoordinates}
                  distance={distance || 0}
                  formatDistance={formatDistance}
                />
              )}

              {/* Vistas de Google Street View */}
              {userCoordinates && officialCoordinates.lat && officialCoordinates.lng && (
                <div className="mt-4 p-4 bg-gray-50 rounded border">
                  <div className="font-medium text-gray-800 mb-3 flex items-center">
                    <span className="text-lg mr-2">📷</span>
                    Vistas de Google Street View
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StreetViewImage
                      lat={userCoordinates.lat}
                      lng={userCoordinates.lng}
                      title="Coordenadas del Usuario"
                      color="#eab308"
                    />
                    <StreetViewImage
                      lat={officialCoordinates.lat}
                      lng={officialCoordinates.lng}
                      title="Coordenadas Oficiales"
                      color="#003DF6"
                    />
                  </div>
                  <div className="mt-3 text-center text-xs text-gray-500">
                    Las imágenes de Street View pueden ayudar a verificar visualmente la ubicación correcta.
                    Es normal que las imágenes estén ligeramente desplazadas de las coordenadas exactas.
                  </div>
                </div>
              )}

              {/* Pregunta de Confirmación */}
              <div className="mt-4 text-gray-600">
                ¿Confirma que estas coordenadas son correctas?
              </div>

              {/* Botones de Acción */}
              <div className="mt-4 space-y-3">
                <div className="flex space-x-2">

                  {userCoordinates && (
                    <button
                      onClick={() => executeStep(4, {
                        confirmedCoordinates: {
                          lat: userCoordinates.lat,
                          lng: userCoordinates.lng
                        }
                      })}
                      disabled={loading}
                      className="px-4 py-2 text-white rounded hover:opacity-90 disabled:opacity-50"
                      style={{ backgroundColor: '#eab308' }}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mantener Coordenadas del Usuario'}
                    </button>
                  )}

                  <button
                    onClick={() => executeStep(4, {
                      confirmedCoordinates: {
                        lat: officialCoordinates.lat || 0,
                        lng: officialCoordinates.lng || 0
                      }
                    })}
                    disabled={loading}
                    className="px-4 py-2 text-white rounded hover:opacity-90 disabled:opacity-50"
                    style={{ backgroundColor: '#003DF6' }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Coordenadas Oficiales'}
                  </button>

                </div>

                {/* Coordenadas Personalizadas */}
                <div className="border-t pt-3">
                  <div className="text-sm text-gray-600 mb-2">O ingrese coordenadas personalizadas:</div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="Latitud"
                      value={currentStepData.customLat || ''}
                      onChange={(e) => setCurrentStepData(prev => ({ ...prev, customLat: parseFloat(e.target.value) }))}
                      className="px-3 py-2 border rounded text-sm w-32"
                    />
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="Longitud"
                      value={currentStepData.customLng || ''}
                      onChange={(e) => setCurrentStepData(prev => ({ ...prev, customLng: parseFloat(e.target.value) }))}
                      className="px-3 py-2 border rounded text-sm w-32"
                    />
                    <button
                      onClick={() => executeStep(4, {
                        confirmedCoordinates: {
                          lat: currentStepData.customLat,
                          lng: currentStepData.customLng
                        }
                      })}
                      disabled={loading || !currentStepData.customLat || !currentStepData.customLng}
                      className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 text-sm"
                    >
                      Usar Personalizadas
                    </button>
                  </div>
                </div>
              </div>
            </>
    );
  };

  const renderCurrentStep = () => {
    if (!progress) return null;

    switch (progress.currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return (
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <h4 className="font-semibold text-green-800">¡Validación Completada!</h4>
            <p className="text-green-600 text-sm">
              Todos los datos han sido verificados y guardados correctamente.
            </p>
          </div>
        );
    }
  };

  if (loading && !progress) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600">Calculando direcciones...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex items-center">
          <XCircle className="w-5 h-5 text-red-500 mr-2" />
          <span className="text-red-800">{error}</span>
        </div>
        <button
          onClick={initializeValidation}
          className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (!progress) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Progreso Visual */}
      <div className="bg-white border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Validación Dirección</h3>
          <span className="text-sm text-gray-500">
            {progress.isComplete ? 'Completado' : `Paso ${progress.currentStep} de ${progress.totalSteps}`}
          </span>
        </div>

        {/* Barra de Progreso */}
        <div className="space-y-3">
          {progress.steps.map((step) => (
            <div key={step.stepNumber} className="flex items-center space-x-3">
              {getStepIcon(step)}
              <div className="flex-1">
                <div className={`text-sm ${getStepColor(step)}`}>
                  {step.title}
                  {step.status === 'skipped' && step.skipReason && (
                    <span className="ml-2 text-xs text-gray-500">
                      ({step.skipReason})
                    </span>
                  )}
                </div>
              </div>
              {step.status === 'completed' && (
                <span className="text-xs text-green-600">✓</span>
              )}
              {step.status === 'skipped' && (
                <span className="text-xs text-gray-500">Saltado</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dirección Original del Registro DEA - Siempre visible */}
      {step1Data?.originalRecord && (
        <div className="bg-white border rounded-lg p-4">
          <div className="font-medium text-gray-800 mb-3 flex items-center">
            <span className="text-lg mr-2">📋</span>
            Dirección Original del Registro DEA
          </div>
          <div className="bg-gray-50 p-3 rounded border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <div><strong>Tipo de Vía:</strong> {step1Data.originalRecord.tipoVia}</div>
                <div><strong>Nombre de Vía:</strong> {step1Data.originalRecord.nombreVia}</div>
                {step1Data.originalRecord.numeroVia && (
                  <div><strong>Número:</strong> {step1Data.originalRecord.numeroVia}</div>
                )}
                {step1Data.originalRecord.complementoDireccion && (
                  <div><strong>Complemento:</strong> {step1Data.originalRecord.complementoDireccion}</div>
                )}
              </div>
              <div>
                <div><strong>Código Postal:</strong> {step1Data.originalRecord.codigoPostal}</div>
                <div><strong>Distrito:</strong> {step1Data.originalRecord.distrito}</div>
                <div className="mt-2 p-2 bg-white rounded border">
                  <div><strong>Coordenadas del Usuario:</strong></div>
                  <div className="font-mono text-xs">
                    Lat: {step1Data.originalRecord.latitud.toFixed(6)}<br/>
                    Lng: {step1Data.originalRecord.longitud.toFixed(6)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paso Actual */}
      {!progress.isComplete && (
        <div className="bg-white border rounded-lg p-4">
          <div className="flex items-center mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold mr-3">
              {progress.currentStep}
            </div>
            <h4 className="font-semibold">
              {progress.steps.find(s => s.stepNumber === progress.currentStep)?.title}
            </h4>
          </div>

          {renderCurrentStep()}
        </div>
      )}

      {/* Resumen Final */}
      {progress.isComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-semibold text-green-800 mb-2">Resumen de Validación</h4>
          <div className="text-sm space-y-1">
            {progress.stepData.step1 && (
              <div>✓ Dirección confirmada: {progress.stepData.step1.selectedAddress.tipoVia} {progress.stepData.step1.selectedAddress.nombreVia}</div>
            )}
            {progress.stepData.step2 && (
              <div>✓ Código postal: {progress.stepData.step2.confirmedPostalCode}</div>
            )}
            {progress.stepData.step3 && (
              <div>✓ Distrito: {progress.stepData.step3.confirmedDistrict}</div>
            )}
            {progress.stepData.step4 && (
              <div>✓ Coordenadas verificadas</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
