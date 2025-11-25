/**
 * API Route REFACTORIZADA: /api/dea
 * 
 * MIGRACIÓN COMPLETADA:
 * - GET: Lista DEAs verificados con paginación (usa ListVerifiedDeasUseCase)
 * - POST: Pendiente de migrar (requiere CreateDeaUseCase)
 * 
 * CAMBIOS PRINCIPALES:
 * 1. Usa casos de uso en lugar de servicios directos
 * 2. Manejo de errores centralizado con ErrorHandler
 * 3. DTOs estandarizados para respuestas
 * 4. Validaciones en casos de uso, no en routes
 */

import { NextRequest } from 'next/server';
import { PrismaDeaRepository } from '@/dea-management/infrastructure/prisma/PrismaDeaRepository';
import { ListVerifiedDeasUseCase } from '@/dea-management/application/use-cases/ListVerifiedDeasUseCase';
import { handleDomainError } from '@/shared/infrastructure/http/ErrorHandler';

/**
 * GET /api/dea
 * Lista DEAs verificados y completados con paginación
 * 
 * Query params:
 * - page: número de página (default: 1)
 * - limit: registros por página (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Extraer parámetros de query
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // 2. Crear dependencias
    // TODO: Esto debería venir de un contenedor de IoC/DI
    const repository = new PrismaDeaRepository();
    const useCase = new ListVerifiedDeasUseCase(repository);

    // 3. Ejecutar caso de uso
    // El caso de uso ya valida los parámetros y aplica límites
    const result = await useCase.execute({
      page,
      pageSize: limit
    });

    // 4. Retornar respuesta exitosa
    return Response.json(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    // 5. Manejo centralizado de errores
    return handleDomainError(error);
  }
}

/**
 * POST /api/dea
 * Crea un nuevo DEA
 * 
 * TODO: Migrar a CreateDeaUseCase
 * Por ahora mantiene la implementación anterior
 */
export async function POST(request: NextRequest) {
  try {
    // Importar solo cuando se necesita para evitar circular dependencies
    const ServiceProvider = (await import('@/services/serviceProvider')).default;
    const { createSuccessResponse } = await import('@/utils/apiUtils');
    
    const deaService = ServiceProvider.getDeaService();
    const data = await request.json();
    const record = await deaService.createRecord(data);
    
    return createSuccessResponse(record, 201);
  } catch (error) {
    const { handleApiError } = await import('@/utils/apiUtils');
    return handleApiError(error, 'Error al crear registro');
  }
}

/**
 * NOTAS DE MIGRACIÓN:
 * 
 * 1. Para activar este endpoint refactorizado:
 *    - Hacer backup: mv route.ts route.ts.backup
 *    - Activar: mv route.refactored.ts route.ts
 * 
 * 2. Diferencias con versión anterior:
 *    - ✅ GET migrado completamente a nueva arquitectura
 *    - ⏳ POST pendiente (usa código legacy temporalmente)
 *    - ✅ Respuestas con formato estandarizado (DeaListDto)
 *    - ✅ Manejo de errores tipado
 * 
 * 3. Compatibilidad:
 *    - ✅ Frontend debería funcionar sin cambios
 *    - ✅ Respuestas incluyen misma información
 *    - ✅ Paginación funciona igual
 * 
 * 4. Próximos pasos después de activar:
 *    - Crear CreateDeaUseCase
 *    - Migrar POST a usar CreateDeaUseCase
 *    - Eliminar dependencia de ServiceProvider
 *    - Tests E2E para verificar compatibilidad
 */
