/**
 * API Route REFACTORIZADA: GET /api/dea/[id]
 * 
 * EJEMPLO de cómo debería verse un endpoint usando la nueva arquitectura
 * 
 * COMPARACIÓN:
 * 
 * ANTES:
 * - Lógica de negocio en el route
 * - Acoplamiento directo con Prisma
 * - Sin manejo de errores tipado
 * - Sin validación de transiciones
 * 
 * DESPUÉS:
 * - Route es solo un adaptador HTTP
 * - Usa casos de uso del dominio
 * - Manejo de errores centralizado
 * - Lógica de negocio en el dominio
 */

import { NextRequest } from 'next/server';
import { PrismaDeaRepository } from '@/dea-management/infrastructure/prisma/PrismaDeaRepository';
import { GetDeaByIdUseCase } from '@/dea-management/application/use-cases/GetDeaByIdUseCase';
import { handleDomainError } from '@/shared/infrastructure/http/ErrorHandler';

/**
 * GET /api/dea/[id]
 * Obtiene un DEA por su ID
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Extraer parámetros
    const { id } = await context.params;
    const deaId = parseInt(id, 10);

    // 2. Crear dependencias
    // TODO: Esto debería venir de un contenedor de IoC/DI
    const repository = new PrismaDeaRepository();
    const useCase = new GetDeaByIdUseCase(repository);

    // 3. Ejecutar caso de uso
    const result = await useCase.execute({ deaId });

    // 4. Retornar respuesta exitosa
    return Response.json(result, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    });

  } catch (error) {
    // 5. Manejo centralizado de errores
    // El ErrorHandler convierte errores de dominio en respuestas HTTP apropiadas
    return handleDomainError(error);
  }
}

/**
 * NOTAS PARA MIGRACIÓN:
 * 
 * 1. Renombrar este archivo a route.ts cuando esté listo
 * 2. Eliminar el route.ts anterior (hacer backup primero)
 * 3. Verificar que el frontend sigue funcionando
 * 4. Los DTOs devueltos son compatibles con el contrato anterior
 * 
 * BENEFICIOS INMEDIATOS:
 * - Lógica de negocio testeable sin HTTP
 * - Errores tipados y consistentes
 * - Fácil cambiar de Prisma a otra BD
 * - Código más limpio y mantenible
 */
