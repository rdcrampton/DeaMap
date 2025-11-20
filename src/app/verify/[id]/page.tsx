'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { VerificationStep, VerificationStatus, VERIFICATION_STEPS_CONFIG } from '@/types/verification';
import type { VerificationSession } from '@/types/verification';
import type { CropData, ArrowData } from '@/types/shared';
import ImageCropper from '@/components/verification/ImageCropper';
import ArrowPlacer from '@/components/verification/ArrowPlacer';
import ArrowPlacerWithOrigin from '@/components/verification/ArrowPlacerWithOrigin';
import ImagePairSelector, { ImageSelection } from '@/components/verification/ImagePairSelector';
import DeaValidationPanel from '@/components/validation/DeaValidationPanel';
import DiscardModal from '@/components/verification/DiscardModal';
import { DiscardReason } from '@/types/verification';

interface VerificationPageProps {
  params: Promise<{ id: string }>;
}

export default function VerificationPage({ params }: VerificationPageProps) {
  const [session, setSession] = useState<VerificationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    fetchSession();
  }, [resolvedParams.id]);

  const fetchSession = async () => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Sesión de verificación no encontrada');
        }
        throw new Error('Error al cargar sesión');
      }
      const data = await response.json();
      
      // Si la sesión ya está completada, redirigir inmediatamente sin renderizar
      if (data.status === VerificationStatus.COMPLETED) {
        // NO establecer session, NO cambiar loading, solo redirigir
        // Esto mantiene el spinner visible y evita renderizar el contenido
        router.replace('/verify');
        return;
      }
      
      setSession(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setLoading(false);
    }
  };

  const updateStep = async (step: VerificationStep) => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar paso');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar paso');
    }
  };

  const completeVerification = async () => {
    setCompleting(true);
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/complete`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Error al completar verificación');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);
      
      // Redirigir después de 3 segundos para mostrar el mensaje de éxito
      setTimeout(() => {
        router.push('/verify');
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al completar verificación');
    } finally {
      setCompleting(false);
    }
  };

  const cancelVerification = async () => {
    if (!confirm('¿Estás seguro de que quieres cancelar la verificación?')) {
      return;
    }

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Error al cancelar verificación');
      }

      router.push('/verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cancelar verificación');
    }
  };

  const handleDiscardDea = async (reason: DiscardReason, notes?: string) => {
    setDiscarding(true);
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/discard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason, notes }),
      });

      if (!response.ok) {
        throw new Error('Error al descartar DEA');
      }

      // Redirigir después de descartar exitosamente
      setTimeout(() => {
        router.push('/verify');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descartar DEA');
      setDiscarding(false);
      setIsDiscardModalOpen(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleCropChange = (_cropData: CropData) => {
    // This function is kept for compatibility with ImageCropper component
    // The cropData is handled directly in handleCropComplete
  };

  const handleCropComplete = async (cropData: CropData) => {
    if (!session?.originalImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/crop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: session.originalImageUrl,
          cropData
        }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar imagen recortada');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      // Avanzar al siguiente paso
      await updateStep(VerificationStep.ARROW_PLACEMENT_1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar imagen');
    }
  };

  const handleCropCancel = () => {
    updateStep(VerificationStep.DEA_INFO);
  };

  const handleArrowComplete = async (arrowData: ArrowData) => {
    if (!session?.croppedImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/arrow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arrowData }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar flecha');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      // Determinar siguiente paso según si hay imagen 2 válida
      if (session.image2Valid) {
        await updateStep(VerificationStep.IMAGE_CROP_2);
      } else {
        await updateStep(VerificationStep.REVIEW);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar flecha');
    }
  };

  const handleArrowCancel = () => {
    updateStep(VerificationStep.IMAGE_CROP_1);
  };

  // Handler para selección de imágenes
  const handleImageSelection = async (selection: ImageSelection) => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/select-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selection),
      });

      if (!response.ok) {
        throw new Error('Error al procesar selección de imágenes');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      // El API ya determina el siguiente paso, no necesitamos hacer nada más
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar selección');
    }
  };

  // Handler para subir nuevas imágenes
  const handleUploadNewImages = async (image1Url: string | null, image2Url: string | null) => {
    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/upload-images`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image1Url,
          image2Url
        }),
      });

      if (!response.ok) {
        throw new Error('Error al subir nuevas imágenes');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      // El API determina el siguiente paso automáticamente
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir nuevas imágenes');
    }
  };

  // Handlers para la segunda imagen
  const handleSecondCropComplete = async (cropData: CropData) => {
    if (!session?.secondImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/crop2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: session.secondImageUrl,
          cropData
        }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar segunda imagen recortada');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      // Avanzar al siguiente paso
      await updateStep(VerificationStep.ARROW_PLACEMENT_2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar segunda imagen');
    }
  };

  const handleSecondArrowComplete = async (arrowData: ArrowData) => {
    if (!session?.secondCroppedImageUrl) return;

    try {
      const response = await fetch(`/api/verify/${resolvedParams.id}/arrow2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ arrowData }),
      });

      if (!response.ok) {
        throw new Error('Error al procesar flecha en segunda imagen');
      }

      const updatedSession = await response.json();
      setSession(updatedSession);

      // Avanzar al paso de revisión
      await updateStep(VerificationStep.REVIEW);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar flecha en segunda imagen');
    }
  };

  const getStepProgress = () => {
    if (!session) return { current: 0, total: 0, percentage: 0 };

    // Excluir el paso COMPLETED del cálculo ya que es solo un estado interno
    const steps = Object.keys(VERIFICATION_STEPS_CONFIG).filter(
      step => step !== VerificationStep.COMPLETED
    );
    const currentIndex = steps.indexOf(session.currentStep);

    return {
      current: currentIndex + 1,
      total: steps.length,
      percentage: Math.round(((currentIndex + 1) / steps.length) * 100)
    };
  };

  const renderStepContent = () => {
    if (!session) return null;

    const stepConfig = VERIFICATION_STEPS_CONFIG[session.currentStep];

    switch (session.currentStep) {
      case VerificationStep.DATA_VALIDATION:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Validación de Datos DEA</h2>
            {session.deaRecord && (
              <DeaValidationPanel
                deaRecordId={session.deaRecord.id}
                onValidationComplete={() => {
                  // Continuar al siguiente paso después de la validación
                  updateStep(VerificationStep.DEA_INFO);
                }}
              />
            )}
          </div>
        );

      case VerificationStep.DEA_INFO:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Información del DEA</h2>
            {session.deaRecord && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Datos Básicos</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">DEA #:</span> {session.deaRecord.numeroProvisionalDea}</p>
                    <p><span className="font-medium">Nombre:</span> {session.deaRecord.nombre}</p>
                    <p><span className="font-medium">Tipo:</span> {session.deaRecord.tipoEstablecimiento}</p>
                    <p><span className="font-medium">Distrito:</span> {session.deaRecord.distrito}</p>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-3">Ubicación</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Dirección:</span> {session.deaRecord.tipoVia} {session.deaRecord.nombreVia} {session.deaRecord.numeroVia}</p>
                    <p><span className="font-medium">CP:</span> {session.deaRecord.codigoPostal}</p>
                    <p><span className="font-medium">Coordenadas:</span> {session.deaRecord.latitud}, {session.deaRecord.longitud}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => updateStep(VerificationStep.IMAGE_SELECTION)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Continuar
              </button>
            </div>
          </div>
        );

      case VerificationStep.IMAGE_SELECTION:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Selección de Imágenes</h2>
            
            {/* Botón de Descartar DEA */}
            <div className="mb-6 bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-md font-semibold text-orange-800 mb-2">
                    ¿No puedes continuar con este DEA?
                  </h3>
                  <p className="text-sm text-orange-700 mb-3">
                    Si las imágenes no son válidas y no puedes obtener nuevas, puedes descartar este DEA y documentar el motivo.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDiscardModalOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium transition-colors"
              >
                🗑️ Descartar DEA
              </button>
            </div>

            <ImagePairSelector
              image1Url={session.originalImageUrl}
              image2Url={session.secondImageUrl}
              descripcionAcceso={session.deaRecord?.descripcionAcceso}
              onSelectionComplete={handleImageSelection}
              onUploadNewImages={handleUploadNewImages}
              onCancel={() => updateStep(VerificationStep.DEA_INFO)}
            />
          </div>
        );

      case VerificationStep.IMAGE_CROP_1:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Recortar Imagen</h2>
            <p className="text-gray-600 mb-6">
              Selecciona el área cuadrada de la imagen que quieres conservar.
              Arrastra para mover la selección y usa las esquinas para redimensionar.
            </p>
            {session.originalImageUrl ? (
              <ImageCropper
                imageUrl={session.originalImageUrl}
                onCropChange={handleCropChange}
                onCropComplete={handleCropComplete}
                onCancel={handleCropCancel}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay imagen disponible para recortar</p>
              </div>
            )}
          </div>
        );

      case VerificationStep.ARROW_PLACEMENT_1:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Colocar Flecha</h2>
            <p className="text-gray-600 mb-6">
              Coloca una flecha en la imagen recortada para señalar el DEA.
            </p>
            {session.croppedImageUrl ? (
              <ArrowPlacer
                imageUrl={session.croppedImageUrl}
                onArrowComplete={handleArrowComplete}
                onCancel={handleArrowCancel}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay imagen recortada disponible</p>
                <button
                  onClick={() => updateStep(VerificationStep.IMAGE_CROP_1)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Volver a Recortar
                </button>
              </div>
            )}
          </div>
        );

      case VerificationStep.IMAGE_CROP_2:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Recortar Segunda Imagen</h2>
            <p className="text-gray-600 mb-6">
              Selecciona el área cuadrada de la segunda imagen que quieres conservar.
            </p>
            {session.secondImageUrl ? (
              <ImageCropper
                imageUrl={session.secondImageUrl}
                onCropChange={handleCropChange}
                onCropComplete={handleSecondCropComplete}
                onCancel={() => updateStep(VerificationStep.IMAGE_SELECTION)}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay segunda imagen disponible para recortar</p>
              </div>
            )}
          </div>
        );

      case VerificationStep.ARROW_PLACEMENT_2:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Colocar Flecha en Segunda Imagen</h2>
            <p className="text-gray-600 mb-6">
              Coloca una flecha en la segunda imagen recortada. Puedes seleccionar tanto el punto de inicio como el final de la flecha.
            </p>
            {session.secondCroppedImageUrl ? (
              <ArrowPlacerWithOrigin
                imageUrl={session.secondCroppedImageUrl}
                onArrowComplete={handleSecondArrowComplete}
                onCancel={() => updateStep(VerificationStep.IMAGE_CROP_2)}
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay segunda imagen recortada disponible</p>
                <button
                  onClick={() => updateStep(VerificationStep.IMAGE_CROP_2)}
                  className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Volver a Recortar Segunda Imagen
                </button>
              </div>
            )}
          </div>
        );

      case VerificationStep.REVIEW:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">Revisar y Confirmar</h2>
            <p className="text-gray-600 mb-6">
              Revisa ambas imágenes procesadas antes de guardar
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Primera imagen */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Primera Imagen</h3>
                {session.processedImageUrl ? (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <img
                      src={session.processedImageUrl}
                      alt="Primera imagen procesada"
                      className="w-full max-w-xs md:max-w-sm mx-auto aspect-square object-cover rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      ✅ Imagen recortada y con flecha
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
                    <p className="text-gray-500">Primera imagen no procesada</p>
                  </div>
                )}
              </div>

              {/* Segunda imagen */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-gray-800">Segunda Imagen</h3>
                {session.secondProcessedImageUrl ? (
                  <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                    <img
                      src={session.secondProcessedImageUrl}
                      alt="Segunda imagen procesada"
                      className="w-full max-w-xs md:max-w-sm mx-auto aspect-square object-cover rounded-lg shadow-sm"
                    />
                    <p className="text-sm text-gray-600 mt-2 text-center">
                      ✅ Imagen recortada y con flecha personalizada
                    </p>
                  </div>
                ) : session.secondImageUrl ? (
                  <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
                    {session.image2Valid === false ? (
                      <>
                        <p className="text-gray-500">❌ Imagen marcada como no válida</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Esta imagen fue descartada en el paso de validación
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-500">Segunda imagen no procesada</p>
                        <p className="text-xs text-gray-400 mt-1">
                          La imagen está validada pero pendiente de procesar
                        </p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-lg p-8 bg-gray-50 text-center">
                    <p className="text-gray-500">No hay segunda imagen</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Este DEA solo tiene una imagen
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">Resumen de Verificación</h4>
              <div className="text-blue-700 text-sm space-y-1">
                <p>• Primera imagen: {session.processedImageUrl ? 'Procesada correctamente' : 'Pendiente'}</p>
                <p>• Segunda imagen: {
                  session.secondProcessedImageUrl ? 'Procesada correctamente' :
                  session.image2Valid === false ? 'Marcada como no válida' :
                  session.secondImageUrl ? 'Validada pero pendiente de procesar' :
                  'No disponible'
                }</p>
                {session.deaRecord && (
                  <p>• DEA #{session.deaRecord.numeroProvisionalDea} - {session.deaRecord.nombre}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <button
                onClick={() => updateStep(session.secondProcessedImageUrl ? VerificationStep.ARROW_PLACEMENT_2 : VerificationStep.ARROW_PLACEMENT_1)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 order-last sm:order-first"
              >
                Anterior
              </button>
              <button
                onClick={completeVerification}
                disabled={completing}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {completing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Completando verificación...
                  </>
                ) : (
                  'Completar Verificación'
                )}
              </button>
            </div>
          </div>
        );

      case VerificationStep.COMPLETED:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="text-center py-12">
              <div className="mb-6">
                <svg className="w-20 h-20 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                ✅ Verificación Completada
              </h2>
              {session.markedAsInvalid ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto mb-6">
                  <p className="text-yellow-800 font-medium mb-2">
                    ⚠️ DEA completado sin imágenes válidas
                  </p>
                  <p className="text-yellow-700 text-sm">
                    Este DEA fue marcado como completado porque ninguna de las imágenes era válida para procesar.
                  </p>
                </div>
              ) : (
                <p className="text-gray-600 mb-6">
                  El DEA ha sido verificado exitosamente y las imágenes han sido procesadas.
                </p>
              )}
              <div className="text-sm text-gray-500">
                <p>Redirigiendo a la lista en unos segundos...</p>
                <Loader2 className="w-4 h-4 animate-spin mx-auto mt-2" />
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-4">
              {stepConfig?.title || 'Cargando...'}
            </h2>
            <p className="text-gray-600">
              {stepConfig?.description || 'Procesando paso...'}
            </p>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando verificación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️ Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/verify')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Volver a Verificaciones
          </button>
        </div>
      </div>
    );
  }

  // Si no hay sesión, no renderizar el contenido (probablemente redirigiendo)
  if (!session) {
    return null;
  }

  const progress = getStepProgress();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Discard Modal */}
      <DiscardModal
        isOpen={isDiscardModalOpen}
        onClose={() => setIsDiscardModalOpen(false)}
        onConfirm={handleDiscardDea}
        deaName={session?.deaRecord?.nombre}
        loading={discarding}
      />

      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Verificación de DEA
            </h1>
            <button
              onClick={cancelVerification}
              className="text-red-600 hover:text-red-700 font-medium"
            >
              Cancelar
            </button>
          </div>

          {/* Progress Bar */}
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Paso {progress.current} de {progress.total}
              </span>
              <span className="text-sm text-gray-500">
                {progress.percentage}% completado
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {renderStepContent()}
      </div>
    </div>
  );
}
