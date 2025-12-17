"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

type OrganizationType =
  | "CIVIL_PROTECTION"
  | "CERTIFIED_COMPANY"
  | "VOLUNTEER_GROUP"
  | "MUNICIPALITY"
  | "HEALTH_SERVICE"
  | "OWNER";

type OrgScopeType = "NATIONAL" | "REGIONAL" | "CITY" | "DISTRICT" | "CUSTOM";

interface Organization {
  id: string;
  type: OrganizationType;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  scope_type: OrgScopeType;
  city_code: string | null;
  city_name: string | null;
  custom_scope_description: string | null;
  require_approval: boolean;
  approval_authority: string | null;
  badge_name: string | null;
  badge_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _count?: {
    members: number;
    aed_assignments: number;
    verifications: number;
  };
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Organization>>({});

  useEffect(() => {
    fetchOrganization();
  }, [id]);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/organizations/${id}`);

      if (response.status === 403) {
        router.push("/");
        return;
      }

      if (response.status === 404) {
        setError("Organización no encontrada");
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Error al cargar la organización";
        throw new Error(errorMsg);
      }

      setOrganization(data.data);
      setFormData(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          description: formData.description || undefined,
          scope_type: formData.scope_type,
          city_code: formData.city_code || undefined,
          city_name: formData.city_name || undefined,
          custom_scope_description: formData.custom_scope_description || undefined,
          require_approval: formData.require_approval,
          approval_authority: formData.approval_authority || undefined,
          badge_name: formData.badge_name || undefined,
          badge_color: formData.badge_color || undefined,
          is_active: formData.is_active,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar la organización");
      }

      setOrganization(data.data);
      setFormData(data.data);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Estás seguro de que quieres eliminar esta organización? Esta acción no se puede deshacer.")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al eliminar la organización");
      }

      router.push("/admin/organizations");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CIVIL_PROTECTION: "Protección Civil",
      CERTIFIED_COMPANY: "Empresa Certificada",
      VOLUNTEER_GROUP: "Grupo de Voluntarios",
      MUNICIPALITY: "Ayuntamiento",
      HEALTH_SERVICE: "Servicio de Salud",
      OWNER: "Propietario",
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando organización...</div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
          <Link
            href="/admin/organizations"
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 inline-block"
          >
            ← Volver a Organizaciones
          </Link>
        </div>
      </div>
    );
  }

  if (!organization) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/organizations"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Volver a Organizaciones
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{organization.name}</h1>
              <p className="mt-2 text-sm text-gray-600">
                {getTypeLabel(organization.type)} • ID: {organization.id}
              </p>
            </div>
            <div className="flex gap-3">
              {!isEditing ? (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(organization);
                      setError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Stats */}
        {organization._count && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Miembros</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {organization._count.members}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">DEAs Asignados</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {organization._count.aed_assignments}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Verificaciones</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {organization._count.verifications}
                </dd>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button className="border-b-2 border-blue-500 py-4 px-6 text-sm font-medium text-blue-600">
                Información General
              </button>
              <button className="border-transparent py-4 px-6 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                Miembros
              </button>
              <button className="border-transparent py-4 px-6 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300">
                DEAs
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="p-6">
            {!isEditing ? (
              /* View Mode */
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Tipo</h3>
                    <p className="mt-1 text-sm text-gray-900">{getTypeLabel(organization.type)}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Código</h3>
                    <p className="mt-1 text-sm text-gray-900">{organization.code || "—"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Email</h3>
                    <p className="mt-1 text-sm text-gray-900">{organization.email || "—"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Teléfono</h3>
                    <p className="mt-1 text-sm text-gray-900">{organization.phone || "—"}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Sitio Web</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      {organization.website ? (
                        <a href={organization.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                          {organization.website}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Estado</h3>
                    <p className="mt-1 text-sm text-gray-900">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${organization.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {organization.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </p>
                  </div>
                </div>

                {organization.description && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Descripción</h3>
                    <p className="mt-1 text-sm text-gray-900">{organization.description}</p>
                  </div>
                )}

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Ámbito Geográfico</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Tipo de Ámbito</h3>
                      <p className="mt-1 text-sm text-gray-900">{organization.scope_type}</p>
                    </div>
                    {organization.city_name && (
                      <>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Ciudad</h3>
                          <p className="mt-1 text-sm text-gray-900">{organization.city_name}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Código de Ciudad</h3>
                          <p className="mt-1 text-sm text-gray-900">{organization.city_code || "—"}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración</h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">Requiere Aprobación</h3>
                      <p className="mt-1 text-sm text-gray-900">{organization.require_approval ? "Sí" : "No"}</p>
                    </div>
                    {organization.approval_authority && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Autoridad de Aprobación</h3>
                        <p className="mt-1 text-sm text-gray-900">{organization.approval_authority}</p>
                      </div>
                    )}
                    {organization.badge_name && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Badge</h3>
                        <p className="mt-1 text-sm text-gray-900">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                            style={{
                              backgroundColor: organization.badge_color || '#3B82F6',
                              color: 'white'
                            }}
                          >
                            {organization.badge_name}
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Edit Mode */
              <form className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name || ""}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Código</label>
                    <input
                      type="text"
                      name="code"
                      value={formData.code || ""}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ""}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone || ""}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Sitio Web</label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website || ""}
                      onChange={handleChange}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="is_active"
                        checked={formData.is_active ?? true}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Organización Activa</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Descripción</label>
                  <textarea
                    name="description"
                    value={formData.description || ""}
                    onChange={handleChange}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
