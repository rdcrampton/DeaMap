'use client'

import { useState, useEffect } from 'react';
import { X, Save, MapPin, Clock, Building, User, FileText, Camera } from 'lucide-react';
import { DeaRecord } from '@/types';
import ImageUpload from './ImageUpload';

interface DeaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: Omit<DeaRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  record?: DeaRecord | null;
}

const tiposEstablecimiento = [
  'Centro educativo',
  'Farmacia',
  'Otro',
  'Otro establecimiento administración pública',
  'Centro de salud',
  'Hospital',
  'Centro comercial',
  'Restaurante',
  'Hotel',
  'Gimnasio',
  'Polideportivo',
  'Estación de metro',
  'Estación de tren',
  'Aeropuerto',
  'Biblioteca',
  'Museo',
  'Teatro',
  'Cine',
  'Supermercado',
  'Gasolinera'
];

const tiposVia = [
  'Calle',
  'Avenida',
  'Plaza',
  'Paseo',
  'Carretera',
  'Camino',
  'Ronda',
  'Glorieta',
  'Travesía',
  'Callejón',
  'Pasaje',
  'Costanilla',
  'Cuesta'
];

const distritos = [
  'Centro',
  'Arganzuela',
  'Retiro',
  'Salamanca',
  'Chamartín',
  'Tetuán',
  'Chamberí',
  'Fuencarral-El Pardo',
  'Moncloa-Aravaca',
  'Latina',
  'Carabanchel',
  'Usera',
  'Puente de Vallecas',
  'Moratalaz',
  'Ciudad Lineal',
  'Hortaleza',
  'Villaverde',
  'Villa de Vallecas',
  'Vicálvaro',
  'San Blas-Canillejas',
  'Barajas'
];

export default function DeaFormModal({ isOpen, onClose, onSave, record }: DeaFormModalProps) {
  const [formData, setFormData] = useState({
    horaInicio: '',
    horaFinalizacion: '',
    correoElectronico: '',
    nombre: '',
    numeroProvisionalDea: 0,
    tipoEstablecimiento: '',
    titularidadLocal: '',
    usoLocal: '',
    titularidad: '',
    propuestaDenominacion: '',
    tipoVia: '',
    nombreVia: '',
    numeroVia: '',
    complementoDireccion: '',
    codigoPostal: 28001,
    distrito: '',
    latitud: 40.4,
    longitud: -3.7,
    horarioApertura: '',
    aperturaLunesViernes: 9,
    cierreLunesViernes: 18,
    aperturaSabados: 9,
    cierreSabados: 14,
    aperturaDomingos: 0,
    cierreDomingos: 0,
    vigilante24h: '',
    foto1: '',
    foto2: '',
    descripcionAcceso: '',
    comentarioLibre: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (record) {
      setFormData({
        horaInicio: record.horaInicio || '',
        horaFinalizacion: record.horaFinalizacion || '',
        correoElectronico: record.correoElectronico || '',
        nombre: record.nombre || '',
        numeroProvisionalDea: record.numeroProvisionalDea || 0,
        tipoEstablecimiento: record.tipoEstablecimiento || '',
        titularidadLocal: record.titularidadLocal || '',
        usoLocal: record.usoLocal || '',
        titularidad: record.titularidad || '',
        propuestaDenominacion: record.propuestaDenominacion || '',
        tipoVia: record.tipoVia || '',
        nombreVia: record.nombreVia || '',
        numeroVia: record.numeroVia || '',
        complementoDireccion: record.complementoDireccion || '',
        codigoPostal: record.codigoPostal || 28001,
        distrito: record.distrito || '',
        latitud: record.latitud || 40.4,
        longitud: record.longitud || -3.7,
        horarioApertura: record.horarioApertura || '',
        aperturaLunesViernes: record.aperturaLunesViernes || 9,
        cierreLunesViernes: record.cierreLunesViernes || 18,
        aperturaSabados: record.aperturaSabados || 9,
        cierreSabados: record.cierreSabados || 14,
        aperturaDomingos: record.aperturaDomingos || 0,
        cierreDomingos: record.cierreDomingos || 0,
        vigilante24h: record.vigilante24h || '',
        foto1: record.foto1 || '',
        foto2: record.foto2 || '',
        descripcionAcceso: record.descripcionAcceso || '',
        comentarioLibre: record.comentarioLibre || ''
      });
    } else {
      // Reset form for new record
      setFormData({
        horaInicio: new Date().toISOString(),
        horaFinalizacion: new Date().toISOString(),
        correoElectronico: '',
        nombre: '',
        numeroProvisionalDea: 0,
        tipoEstablecimiento: '',
        titularidadLocal: '',
        usoLocal: '',
        titularidad: '',
        propuestaDenominacion: '',
        tipoVia: '',
        nombreVia: '',
        numeroVia: '',
        complementoDireccion: '',
        codigoPostal: 28001,
        distrito: '',
        latitud: 40.4,
        longitud: -3.7,
        horarioApertura: 'NO 24 horas al día',
        aperturaLunesViernes: 9,
        cierreLunesViernes: 18,
        aperturaSabados: 9,
        cierreSabados: 14,
        aperturaDomingos: 0,
        cierreDomingos: 0,
        vigilante24h: 'No',
        foto1: '',
        foto2: '',
        descripcionAcceso: '',
        comentarioLibre: ''
      });
    }
  }, [record, isOpen]);

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Error al guardar:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="relative w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {record ? 'Editar DEA' : 'Registro DEA Madrid'}
                </h2>
                <p className="text-blue-100 text-sm">
                  Complete todos los campos obligatorios
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              title="Cerrar formulario"
              className="w-8 h-8 rounded-full bg-white bg-opacity-20 flex items-center justify-center hover:bg-opacity-30 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Información básica */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <User className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Información Básica</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={formData.correoElectronico}
                  onChange={(e) => handleInputChange('correoElectronico', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombre}
                  onChange={(e) => handleInputChange('nombre', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número provisional DEA
                </label>
                <input
                  type="number"
                  max={10999}
                  value={formData.numeroProvisionalDea}
                  onChange={(e) => handleInputChange('numeroProvisionalDea', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Solo si está revisando un DEA del listado"
                />
              </div>
            </div>
          </section>

          {/* Establecimiento */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Building className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Información del Establecimiento</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de establecimiento <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.tipoEstablecimiento}
                  onChange={(e) => handleInputChange('tipoEstablecimiento', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona el tipo</option>
                  {tiposEstablecimiento.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titularidad del local <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.titularidadLocal}
                  onChange={(e) => handleInputChange('titularidadLocal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona</option>
                  <option value="Pública">Pública</option>
                  <option value="Privada">Privada</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Uso del local <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.usoLocal}
                  onChange={(e) => handleInputChange('usoLocal', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona</option>
                  <option value="Público">Público</option>
                  <option value="Privado">Privado</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Titularidad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.titularidad}
                  onChange={(e) => handleInputChange('titularidad', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Empresa, establecimiento..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Propuesta de denominación <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.propuestaDenominacion}
                  onChange={(e) => handleInputChange('propuestaDenominacion', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nombre sencillo que identifique el lugar"
                />
              </div>
            </div>
          </section>

          {/* Dirección */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <MapPin className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Dirección</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de vía <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.tipoVia}
                  onChange={(e) => handleInputChange('tipoVia', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona</option>
                  {tiposVia.map(tipo => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre de la vía <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nombreVia}
                  onChange={(e) => handleInputChange('nombreVia', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Número de la vía <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.numeroVia}
                  onChange={(e) => handleInputChange('numeroVia', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Número, s/n, pk..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Complemento de dirección
                </label>
                <input
                  type="text"
                  value={formData.complementoDireccion}
                  onChange={(e) => handleInputChange('complementoDireccion', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Edificio, bloque, portal..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código postal <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min={28001}
                  max={28055}
                  value={formData.codigoPostal}
                  onChange={(e) => handleInputChange('codigoPostal', parseInt(e.target.value) || 28001)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Distrito <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={formData.distrito}
                  onChange={(e) => handleInputChange('distrito', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Selecciona distrito</option>
                  {distritos.map(distrito => (
                    <option key={distrito} value={distrito}>{distrito}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Latitud <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.000001"
                  min={40.3}
                  max={40.6}
                  value={formData.latitud}
                  onChange={(e) => handleInputChange('latitud', parseFloat(e.target.value) || 40.4)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="40.xxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Longitud <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  step="0.000001"
                  min={-3.9}
                  max={-3.5}
                  value={formData.longitud}
                  onChange={(e) => handleInputChange('longitud', parseFloat(e.target.value) || -3.7)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="-3.xxxxxx"
                />
              </div>
            </div>
          </section>

          {/* Horarios */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Horarios de Apertura</h3>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Horario de apertura del establecimiento <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={formData.horarioApertura}
                onChange={(e) => handleInputChange('horarioApertura', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecciona</option>
                <option value="24 horas">24 horas</option>
                <option value="NO 24 horas al día">NO 24 horas al día</option>
              </select>
            </div>

            {formData.horarioApertura === 'NO 24 horas al día' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Lunes a Viernes</h4>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.aperturaLunesViernes}
                      onChange={(e) => handleInputChange('aperturaLunesViernes', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Apertura"
                    />
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.cierreLunesViernes}
                      onChange={(e) => handleInputChange('cierreLunesViernes', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Cierre"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Sábados</h4>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.aperturaSabados}
                      onChange={(e) => handleInputChange('aperturaSabados', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Apertura"
                    />
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.cierreSabados}
                      onChange={(e) => handleInputChange('cierreSabados', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Cierre"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Domingos</h4>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.aperturaDomingos}
                      onChange={(e) => handleInputChange('aperturaDomingos', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Apertura"
                    />
                    <input
                      type="number"
                      min={0}
                      max={23}
                      value={formData.cierreDomingos}
                      onChange={(e) => handleInputChange('cierreDomingos', parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Cierre"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Fotos */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <Camera className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Fotografías</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUpload
                label="Foto 1"
                value={formData.foto1}
                onChange={(url) => handleInputChange('foto1', url || '')}
                prefix="dea-foto1"
              />

              <ImageUpload
                label="Foto 2"
                value={formData.foto2}
                onChange={(url) => handleInputChange('foto2', url || '')}
                prefix="dea-foto2"
              />
            </div>
          </section>

          {/* Información adicional */}
          <section className="space-y-4">
            <div className="flex items-center space-x-2 mb-4">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Información Adicional</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción de acceso
                </label>
                <textarea
                  rows={3}
                  value={formData.descripcionAcceso}
                  onChange={(e) => handleInputChange('descripcionAcceso', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Instrucciones detalladas para acceder al DEA..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentario libre
                </label>
                <textarea
                  rows={3}
                  value={formData.comentarioLibre}
                  onChange={(e) => handleInputChange('comentarioLibre', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Observaciones adicionales..."
                />
              </div>
            </div>
          </section>

          {/* Botones */}
          <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Guardar DEA</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
