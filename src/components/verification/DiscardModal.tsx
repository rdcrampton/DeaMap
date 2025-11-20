'use client';

import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { DiscardReason, DISCARD_REASON_LABELS } from '@/types/verification';

interface DiscardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: DiscardReason, notes?: string) => void;
  deaName?: string;
  loading?: boolean;
}

export default function DiscardModal({
  isOpen,
  onClose,
  onConfirm,
  deaName,
  loading = false
}: DiscardModalProps) {
  const [selectedReason, setSelectedReason] = useState<DiscardReason>(DiscardReason.CLOSED_PERMANENTLY);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedReason, notes.trim() || undefined);
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedReason(DiscardReason.CLOSED_PERMANENTLY);
      setNotes('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Close button */}
          <button
            onClick={handleClose}
            disabled={loading}
            aria-label="Cerrar modal"
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-3">
              <h3 className="text-lg font-semibold text-gray-900">
                Descartar DEA
              </h3>
              {deaName && (
                <p className="text-sm text-gray-600 mt-1">
                  {deaName}
                </p>
              )}
            </div>
          </div>

          {/* Warning message */}
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              ⚠️ Esta acción marcará el DEA como descartado y no aparecerá en la lista de verificación.
              Esta acción se puede revertir desde la base de datos si es necesario.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* Reason selector */}
            <div>
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">
                Motivo del descarte *
              </label>
              <select
                id="reason"
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value as DiscardReason)}
                disabled={loading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                {Object.entries(DISCARD_REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes textarea */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                Notas adicionales (opcional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={3}
                placeholder="Agrega detalles adicionales sobre el motivo del descarte..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">
                {notes.length}/500 caracteres
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Descartando...
                </>
              ) : (
                'Descartar DEA'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
