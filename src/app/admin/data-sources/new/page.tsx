"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FieldMapping {
  [key: string]: string;
}

// Mapeo genérico para APIs CKAN
// Formato: campo_fuente → campo_sistema
const DEFAULT_CKAN_FIELD_MAPPING: FieldMapping = {
  id_dea: "externalId",
  nombre_dea: "name",
  direccion: "address",
  municipio: "locality",
  provincia: "province",
  codigo_postal: "postalCode",
  latitud: "latitude",
  longitud: "longitude",
  ubicacion: "locationDescription",
  accesibilidad_horaria: "accessibility",
  horario_atencion: "schedule",
  telefono_contacto: "contactPhone",
  entidad_responsable: "responsibleEntity",
  fecha_alta: "installationDate",
  estado: "status",
};

// Mapeo para el formato JSON de la Comunidad de Madrid
// Formato: campo_fuente → campo_sistema
const MADRID_JSON_FIELD_MAPPING: FieldMapping = {
  codigo_dea: "externalId",
  nombre_establecimiento: "name", // Nombre del establecimiento (si existe en datos)
  direccion_via_codigo: "streetType",
  direccion_via_nombre: "streetName",
  direccion_portal_numero: "streetNumber",
  direccion_piso: "floor",
  direccion_puerta: "additionalInfo",
  direccion_ubicacion: "specificLocation",
  direccion_codigo_postal: "postalCode",
  direccion_latitud: "latitude",
  direccion_longitud: "longitude",
  municipio_codigo: "cityCode",
  municipio_nombre: "city",
  tipo_establecimiento: "establishmentType",
  tipo_titularidad: "ownershipType",
  horario_acceso: "accessSchedule",
};

const SOURCE_ORIGINS = [
  { value: "EXTERNAL_API", label: "API Externa" },
  { value: "HEALTH_API", label: "API de Salud" },
  { value: "CIVIL_PROTECTION_API", label: "API Protección Civil" },
  { value: "FIRE_DEPARTMENT_API", label: "API Bomberos" },
];

const REGION_CODES = [
  { value: "MAD", label: "Madrid" },
  { value: "CAT", label: "Cataluña" },
  { value: "AND", label: "Andalucía" },
  { value: "VAL", label: "Valencia" },
  { value: "GAL", label: "Galicia" },
  { value: "PVA", label: "País Vasco" },
  { value: "ESP", label: "Nacional (España)" },
];

export default function NewDataSourcePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "JSON_FILE",
    description: "",
    // Para CKAN_API
    apiEndpoint: "",
    resourceId: "",
    // Para JSON_FILE
    fileUrl: "",
    jsonPath: "data",
    // Común
    syncFrequency: "MANUAL",
    isActive: true,
    sourceOrigin: "EXTERNAL_API",
    regionCode: "MAD",
    fieldMapping: MADRID_JSON_FIELD_MAPPING,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (form.type === "CKAN_API") {
      if (!form.apiEndpoint.trim()) {
        setError("El endpoint de la API es obligatorio para CKAN");
        return;
      }
      if (!form.resourceId.trim()) {
        setError("El Resource ID es obligatorio para CKAN");
        return;
      }
    }

    if (form.type === "JSON_FILE") {
      if (!form.fileUrl.trim()) {
        setError("La URL del archivo JSON es obligatoria");
        return;
      }
    }

    try {
      setLoading(true);

      // Construir el objeto config según el tipo
      let config: Record<string, unknown> = {
        fieldMapping: form.fieldMapping,
      };

      if (form.type === "CKAN_API") {
        config = {
          ...config,
          apiEndpoint: form.apiEndpoint || null,
          resourceId: form.resourceId || null,
        };
      } else if (form.type === "JSON_FILE") {
        config = {
          ...config,
          fileUrl: form.fileUrl || null,
          jsonPath: form.jsonPath || null,
        };
      }

      const response = await fetch("/api/admin/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          description: form.description || null,
          syncFrequency: form.syncFrequency,
          isActive: form.isActive,
          sourceOrigin: form.sourceOrigin,
          regionCode: form.regionCode,
          config,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al crear la fuente de datos");
      }

      router.push(`/admin/data-sources/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const updateFieldMapping = (field: string, value: string) => {
    setForm({
      ...form,
      fieldMapping: {
        ...form.fieldMapping,
        [field]: value,
      },
    });
  };

  const loadDefaultCkanMapping = () => {
    setForm({
      ...form,
      apiEndpoint:
        "https://datos.comunidad.madrid/catalogo/dataset/7265fe82-f01b-41e7-b252-b8bae92daa5e/resource/fba1b963-3aa3-42d2-8316-1228d2be69c9/download/desfibriladores_acceso_publico.json",
      resourceId: "fba1b963-3aa3-42d2-8316-1228d2be69c9",
      fieldMapping: DEFAULT_CKAN_FIELD_MAPPING,
    });
  };

  const loadMadridJsonConfig = () => {
    setForm({
      ...form,
      name: "DEAs Comunidad de Madrid",
      type: "JSON_FILE",
      fileUrl:
        "https://datos.comunidad.madrid/catalogo/dataset/d2478503-a4ae-4753-9540-9200071803c4/resource/42d08814-3361-4c2a-93fe-36664abc7953/download/desfibriladores_externos_fuera_ambito_sanitario.json",
      jsonPath: "data",
      sourceOrigin: "EXTERNAL_API",
      regionCode: "MAD",
      fieldMapping: MADRID_JSON_FIELD_MAPPING,
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/data-sources"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Volver a fuentes de datos
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Nueva Fuente de Datos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configura una nueva fuente de datos externa para importar DEAs automáticamente
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ej. DEAs Comunidad de Madrid"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Tipo
                </label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="CKAN_API">API CKAN</option>
                  <option value="REST_API">API REST</option>
                  <option value="CSV_FILE">Archivo CSV</option>
                  <option value="JSON_FILE">Archivo JSON</option>
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Descripción de la fuente de datos..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="sourceOrigin" className="block text-sm font-medium text-gray-700">
                    Origen *
                  </label>
                  <select
                    id="sourceOrigin"
                    value={form.sourceOrigin}
                    onChange={(e) => setForm({ ...form, sourceOrigin: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {SOURCE_ORIGINS.map((origin) => (
                      <option key={origin.value} value={origin.value}>
                        {origin.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="regionCode" className="block text-sm font-medium text-gray-700">
                    Región *
                  </label>
                  <select
                    id="regionCode"
                    value={form.regionCode}
                    onChange={(e) => setForm({ ...form, regionCode: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {REGION_CODES.map((region) => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="syncFrequency" className="block text-sm font-medium text-gray-700">
                  Frecuencia de Sincronización
                </label>
                <select
                  id="syncFrequency"
                  value={form.syncFrequency}
                  onChange={(e) => setForm({ ...form, syncFrequency: e.target.value })}
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
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                  Activar fuente de datos
                </label>
              </div>
            </div>
          </div>

          {/* JSON File Configuration */}
          {form.type === "JSON_FILE" && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Configuración de Archivo JSON</h2>
                <button
                  type="button"
                  onClick={loadMadridJsonConfig}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Cargar configuración de Madrid
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="fileUrl" className="block text-sm font-medium text-gray-700">
                    URL del archivo JSON *
                  </label>
                  <input
                    type="url"
                    id="fileUrl"
                    value={form.fileUrl}
                    onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://datos.comunidad.madrid/.../archivo.json"
                  />
                </div>

                <div>
                  <label htmlFor="jsonPath" className="block text-sm font-medium text-gray-700">
                    Ruta al array de datos
                  </label>
                  <input
                    type="text"
                    id="jsonPath"
                    value={form.jsonPath}
                    onChange={(e) => setForm({ ...form, jsonPath: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    placeholder="data"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Propiedad del JSON que contiene el array de registros. Ej: &quot;data&quot;,
                    &quot;records&quot;, &quot;result.items&quot;
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CKAN API Configuration */}
          {(form.type === "CKAN_API" || form.type === "REST_API") && (
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Configuración de API CKAN</h2>
                {form.type === "CKAN_API" && (
                  <button
                    type="button"
                    onClick={loadDefaultCkanMapping}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Cargar configuración de Madrid
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="apiEndpoint" className="block text-sm font-medium text-gray-700">
                    Endpoint de la API *
                  </label>
                  <input
                    type="url"
                    id="apiEndpoint"
                    value={form.apiEndpoint}
                    onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://datos.comunidad.madrid/..."
                  />
                </div>

                <div>
                  <label htmlFor="resourceId" className="block text-sm font-medium text-gray-700">
                    Resource ID *
                  </label>
                  <input
                    type="text"
                    id="resourceId"
                    value={form.resourceId}
                    onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    placeholder="fba1b963-3aa3-42d2-8316-1228d2be69c9"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Identificador único del recurso en el catálogo de datos
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Field Mapping */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Mapeo de Campos</h2>
            <p className="text-sm text-gray-500 mb-4">
              Configura cómo los campos de la fuente externa se mapean a los campos internos del
              sistema
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Object.entries(form.fieldMapping).map(([internal, external]) => (
                <div key={internal}>
                  <label
                    htmlFor={`field-${internal}`}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {internal}
                  </label>
                  <input
                    type="text"
                    id={`field-${internal}`}
                    value={external}
                    onChange={(e) => updateFieldMapping(internal, e.target.value)}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link
              href="/admin/data-sources"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? (
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
                  Creando...
                </>
              ) : (
                "Crear Fuente de Datos"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
