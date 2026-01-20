/**
 * Admin DEA Detail Page - EDITABLE VERSION
 * Complete management view for administrators with editing capabilities
 */

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Image as ImageIcon,
  FileText,
  Users,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Edit2,
  Save,
  X,
  Trash2,
} from "lucide-react";

interface AdminDeaData {
  id: string;
  code: string | null;
  name: string;
  status: string;
  establishment_type: string | null;
  latitude: number | null;
  longitude: number | null;
  publication_mode: string;
  last_verified_at: string | null;
  is_publicly_accessible: boolean;
  created_at: string;
  updated_at: string;
  location: any;
  schedule: any;
  responsible: any;
  images: any[];
  status_changes: any[];
  publication_history: any[];
  field_changes: any[];
  validations: any[];
  assignments: any[];
  org_verifications: any[];
  change_proposals: any[];
  ownership_claims: any[];
}

export default function AdminDeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<{
    aed: AdminDeaData;
    counts: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("general");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Partial<AdminDeaData>>({});
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const handleSave = async () => {
    if (!data) return;

    try {
      setIsSaving(true);
      setError(null);

      const updatePayload: any = {
        ...editedData,
      };

      // Add images to delete if any
      if (imagesToDelete.length > 0) {
        updatePayload.deleteImageIds = imagesToDelete;
      }

      const response = await fetch(`/api/admin/deas/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        throw new Error("Error al guardar los cambios");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al guardar");
      }

      // Reload data
      const refreshResponse = await fetch(`/api/admin/deas/${params.id}`);
      const refreshResult = await refreshResponse.json();

      if (refreshResult.success) {
        setData({
          aed: refreshResult.data,
          counts: refreshResult.counts,
        });
      }

      // Reset editing state
      setIsEditing(false);
      setEditedData({});
      setImagesToDelete([]);
      
      alert("Cambios guardados exitosamente");
    } catch (err: any) {
      setError(err.message || "Error al guardar");
      alert("Error al guardar: " + (err.message || "Error desconocido"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: any) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDeleteImage = (imageId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta imagen?")) {
      setImagesToDelete((prev) => [...prev, imageId]);
    }
  };

  const handleUndoDeleteImage = (imageId: string) => {
    setImagesToDelete((prev) => prev.filter((id) => id !== imageId));
  };

  const isImageMarkedForDeletion = (imageId: string) => {
    return imagesToDelete.includes(imageId);
  };

  const getCurrentValue = (field: string, defaultValue: any) => {
    return Object.hasOwn(editedData, field) ? editedData[field as keyof typeof editedData] : defaultValue;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/deas/${params.id}`);

        if (!response.ok) {
          throw new Error("Error al cargar los datos del DEA");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Error desconocido");
        }

        setData({
          aed: result.data,
          counts: result.counts,
        });
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string; icon: any }> = {
      PUBLISHED: { label: "Publicado", color: "bg-green-100 text-green-800", icon: CheckCircle },
      DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-800", icon: FileText },
      PENDING_REVIEW: {
        label: "Pendiente",
        color: "bg-yellow-100 text-yellow-800",
        icon: AlertCircle,
      },
      REJECTED: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: XCircle },
      INACTIVE: { label: "Inactivo", color: "bg-gray-100 text-gray-600", icon: XCircle },
    };

    const badge = badges[status] || badges.DRAFT;
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${badge.color}`}
      >
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const getPublicationModeBadge = (mode: string) => {
    const modes: Record<string, { label: string; color: string }> = {
      NONE: { label: "No visible", color: "bg-gray-100 text-gray-800" },
      LOCATION_ONLY: { label: "Solo ubicación", color: "bg-blue-100 text-blue-800" },
      BASIC_INFO: { label: "Info básica", color: "bg-purple-100 text-purple-800" },
      FULL: { label: "Info completa", color: "bg-green-100 text-green-800" },
    };

    const modeInfo = modes[mode] || modes.NONE;

    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${modeInfo.color}`}>
        {modeInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información del DEA...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || "No se pudo cargar el DEA"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const { aed, counts } = data;

  const tabs = [
    { id: "general", label: "General", icon: FileText },
    { id: "images", label: `Imágenes (${counts.images - imagesToDelete.length})`, icon: ImageIcon },
    { id: "verifications", label: `Verificaciones (${counts.verifications})`, icon: CheckCircle },
    { id: "assignments", label: `Asignaciones (${counts.active_assignments})`, icon: Users },
    { id: "history", label: "Histórico", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Volver al listado</span>
            </button>

            <div className="flex items-center gap-3">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedData({});
                      setImagesToDelete([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{aed.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {aed.code && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    Código: {aed.code}
                  </span>
                )}
                {getStatusBadge(aed.status)}
                {getPublicationModeBadge(aed.publication_mode)}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 -mb-px">
            <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap
                      ${
                        activeTab === tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de establecimiento
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={getCurrentValue("establishment_type", aed.establishment_type || "")}
                      onChange={(e) => handleFieldChange("establishment_type", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Centro Comercial, Hospital, etc."
                    />
                  ) : (
                    <p className="text-gray-900">{aed.establishment_type || "No especificado"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acceso público
                  </label>
                  {isEditing ? (
                    <select
                      value={getCurrentValue("is_publicly_accessible", aed.is_publicly_accessible) ? "true" : "false"}
                      onChange={(e) => handleFieldChange("is_publicly_accessible", e.target.value === "true")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {aed.is_publicly_accessible ? "Sí" : "No"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  {isEditing ? (
                    <select
                      value={getCurrentValue("status", aed.status)}
                      onChange={(e) => handleFieldChange("status", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="DRAFT">Borrador</option>
                      <option value="PENDING_REVIEW">Pendiente de revisión</option>
                      <option value="PUBLISHED">Publicado</option>
                      <option value="REJECTED">Rechazado</option>
                      <option value="INACTIVE">Inactivo</option>
                    </select>
                  ) : (
                    <div>{getStatusBadge(aed.status)}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modo de publicación</label>
                  {isEditing ? (
                    <select
                      value={getCurrentValue("publication_mode", aed.publication_mode)}
                      onChange={(e) => handleFieldChange("publication_mode", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NONE">No visible</option>
                      <option value="LOCATION_ONLY">Solo ubicación</option>
                      <option value="BASIC_INFO">Info básica</option>
                      <option value="FULL">Info completa</option>
                    </select>
                  ) : (
                    <div>{getPublicationModeBadge(aed.publication_mode)}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Location, Schedule, and Responsible cards remain read-only for now */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Ubicación</h2>
              </div>
              <div className="space-y-2 text-sm">
                <p className="text-gray-900">
                  {aed.location.street_type} {aed.location.street_name}{" "}
                  {aed.location.street_number}
                </p>
                <p className="text-gray-600">
                  {aed.location.postal_code} - {aed.location.city_name}
                </p>
                {aed.location.district_name && (
                  <p className="text-gray-600">{aed.location.district_name}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Images Tab with Delete Functionality */}
        {activeTab === "images" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Imágenes ({aed.images.length - imagesToDelete.length})
            </h2>
            {aed.images.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay imágenes disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {aed.images.map((image: any) => {
                  const markedForDeletion = isImageMarkedForDeletion(image.id);
                  return (
                    <div
                      key={image.id}
                      className={`relative group ${markedForDeletion ? "opacity-50" : ""}`}
                    >
                      <img
                        src={image.processed_url || image.original_url}
                        alt={image.type}
                        className="w-full h-40 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 text-white text-sm">
                          {image.type}
                        </div>
                      </div>
                      {image.is_verified && !markedForDeletion && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {isEditing && (
                        <div className="absolute top-2 left-2">
                          {markedForDeletion ? (
                            <button
                              onClick={() => handleUndoDeleteImage(image.id)}
                              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-colors"
                              title="Deshacer eliminación"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteImage(image.id)}
                              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                              title="Eliminar imagen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                      {markedForDeletion && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-75 rounded-lg">
                          <span className="text-white font-semibold text-sm">
                            Se eliminará
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Other tabs remain the same - Ver, Assign, History */}
        {activeTab === "verifications" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Verificaciones ({aed.org_verifications.length})
            </h2>
            {aed.org_verifications.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay verificaciones registradas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aed.org_verifications.map((verification: any) => (
                  <div key={verification.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {verification.organization.name}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(verification.verified_at).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {verification.verification_type}
                      </span>
                    </div>
                    {verification.notes && (
                      <p className="text-sm text-gray-600 mt-2">{verification.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Asignaciones ({aed.assignments.length})
            </h2>
            {aed.assignments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay asignaciones</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aed.assignments.map((assignment: any) => (
                  <div key={assignment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{assignment.organization.name}</p>
                        <p className="text-sm text-gray-600">{assignment.assignment_type}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          assignment.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Asignado:{" "}
                      {new Date(assignment.assigned_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Cambios de Estado ({aed.status_changes.length})
              </h2>
              {aed.status_changes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay cambios de estado</p>
              ) : (
                <div className="space-y-3">
                  {aed.status_changes.slice(0, 10).map((change: any) => (
                    <div key={change.id} className="flex items-start gap-3 border-l-2 border-gray-200 pl-3">
                      <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{change.previous_status || "INICIAL"}</span>
                          {" → "}
                          <span className="font-medium">{change.new_status}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(change.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Cambios de Campos ({counts.field_changes})
              </h2>
              {aed.field_changes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay cambios registrados</p>
              ) : (
                <div className="space-y-3">
                  {aed.field_changes.slice(0, 15).map((change: any) => (
                    <div key={change.id} className="flex items-start gap-3 border-l-2 border-blue-200 pl-3">
                      <Edit2 className="w-4 h-4 text-blue-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{change.field_name}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(change.changed_at).toLocaleString("es-ES")}
                        </p>
                        <div className="mt-1 text-xs">
                          <span className="text-red-600 line-through">
                            {change.old_value || "(vacío)"}
                          </span>
                          {" → "}
                          <span className="text-green-600">{change.new_value || "(vacío)"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
