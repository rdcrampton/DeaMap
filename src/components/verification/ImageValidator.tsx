'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface ImageValidatorProps {
  imageUrl: string;
  descripcionAcceso?: string;
  onValidationComplete: (isValid: boolean) => void;
  onCancel: () => void;
}

export default function ImageValidator({ 
  imageUrl, 
  descripcionAcceso, 
  onValidationComplete, 
  onCancel 
}: ImageValidatorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [loadingState, setLoadingState] = useState<string>('Cargando imagen...');
  const [retryAttempt, setRetryAttempt] = useState<number>(0);
  const [imageDataUrl, setImageDataUrl] = useState<string>('');

  // Cargar imagen con reintentos
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setLoadingState('Cargando imagen...');
    setRetryAttempt(0);
    
    const loadImageAsync = async () => {
      try {
        const { loadImageWithRetry } = await import('@/utils/imageLoader');
        const result = await loadImageWithRetry(imageUrl, {
          maxRetries: 3,
          initialDelay: 1000,
          useCacheBusting: true,
          useProxyFallback: true,
          onRetry: (attempt, maxRetries) => {
            setRetryAttempt(attempt);
            if (attempt === maxRetries) {
              setLoadingState(`Último intento... (${attempt}/${maxRetries})`);
            } else {
              setLoadingState(`Reintentando... (${attempt}/${maxRetries})`);
            }
          }
        });
        
        // Convertir la imagen a data URL para mostrarla
        const canvas = document.createElement('canvas');
        canvas.width = result.image.width;
        canvas.height = result.image.height;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(result.image, 0, 0);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setImageDataUrl(dataUrl);
          setImageLoaded(true);
          console.log('✅ Imagen del validador cargada exitosamente');
        }
      } catch (error) {
        console.error('❌ Error loading image in validator:', error);
        setImageError(true);
        setLoadingState('Error al cargar la imagen');
        // Intentar mostrar la imagen original como fallback
        setImageDataUrl(imageUrl);
      }
    };
    
    loadImageAsync();
  }, [imageUrl]);

  const handleValidation = async (isValid: boolean) => {
    setIsLoading(true);
    try {
      // Simular un pequeño delay para mejor UX
      await new Promise(resolve => setTimeout(resolve, 500));
      onValidationComplete(isValid);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Imagen a validar */}
      <div className="bg-gray-50 rounded-lg p-2 md:p-4">
        <h3 className="text-lg font-semibold mb-4">Segunda Imagen del DEA</h3>
        <div className="flex justify-center">
          {!imageLoaded && !imageError ? (
            <div className="w-full max-w-sm md:max-w-md lg:max-w-lg aspect-square flex items-center justify-center bg-white rounded-lg shadow-md border border-gray-200">
              <div className="text-center p-8">
                <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-gray-600 font-medium">{loadingState}</p>
                {retryAttempt > 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Esto puede tomar unos segundos...
                  </p>
                )}
              </div>
            </div>
          ) : imageError ? (
            <div className="w-full max-w-sm md:max-w-md lg:max-w-lg aspect-square flex items-center justify-center bg-red-50 rounded-lg shadow-md border border-red-200">
              <div className="text-center p-8">
                <p className="text-red-600 font-medium mb-2">⚠️ Error al cargar la imagen</p>
                <p className="text-sm text-red-500">
                  No se pudo cargar la imagen después de varios intentos.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Recargar página
                </button>
              </div>
            </div>
          ) : (
            <img
              src={imageDataUrl || imageUrl}
              alt="Segunda imagen del DEA"
              className="w-full max-w-sm md:max-w-md lg:max-w-lg rounded-lg shadow-md aspect-square object-cover"
            />
          )}
        </div>
      </div>

      {/* Descripción de acceso */}
      {descripcionAcceso && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-md font-semibold text-blue-800 mb-2">
            Descripción de Acceso
          </h4>
          <p className="text-blue-700">{descripcionAcceso}</p>
        </div>
      )}

      {/* Instrucciones */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-md font-semibold text-yellow-800 mb-2">
          ¿Es esta una foto válida?
        </h4>
        <p className="text-yellow-700 text-sm mb-3">
          Verifica que la imagen muestre claramente el DEA y su ubicación. 
          Si la imagen está borrosa, mal enfocada, o no muestra el DEA correctamente, 
          márcala como inválida.
        </p>
        <div className="bg-yellow-100 border border-yellow-300 rounded p-3">
          <p className="text-yellow-800 text-xs font-medium">
            💡 <strong>Nota:</strong> Si marcas la imagen como inválida, la verificación se completará automáticamente 
            usando solo la primera imagen procesada.
          </p>
        </div>
      </div>

      {/* Botones de validación */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors order-last sm:order-first"
          disabled={isLoading}
        >
          Cancelar
        </button>
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <button
            onClick={() => handleValidation(false)}
            disabled={isLoading || !imageLoaded}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Procesando...' : 'Imagen Inválida'}
          </button>
          
          <button
            onClick={() => handleValidation(true)}
            disabled={isLoading || !imageLoaded}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Procesando...' : 'Imagen Válida'}
          </button>
        </div>
      </div>
    </div>
  );
}
