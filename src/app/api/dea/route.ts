import { NextRequest } from 'next/server'
import ServiceProvider from '@/services/serviceProvider'
import { handleApiError, createSuccessResponse } from '@/utils/apiUtils'

// Get the DEA service from the service provider
const deaService = ServiceProvider.getDeaService();

/**
 * GET handler for retrieving verified and completed DEA records
 * Supports pagination via query parameters: ?page=1&limit=50
 */
export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const page = parseInt(searchParams.get('page') || '1');
		const limit = parseInt(searchParams.get('limit') || '50');

		// Validar parámetros de paginación
		if (page < 1) {
			return createSuccessResponse({ error: 'El parámetro page debe ser mayor a 0' }, 400);
		}

		if (limit < 1 || limit > 100) {
			return createSuccessResponse({ error: 'El parámetro limit debe estar entre 1 y 100' }, 400);
		}

		// Si se especifican parámetros de paginación, usar método paginado
		if (searchParams.has('page') || searchParams.has('limit')) {
			const result = await deaService.getVerifiedAndCompletedRecordsPaginated(page, limit);
			return createSuccessResponse(result);
		}

		// Mantener compatibilidad: si no hay parámetros, retornar todos (deprecado para datasets grandes)
		const records = await deaService.getVerifiedAndCompletedRecords();
		return createSuccessResponse(records);
	} catch (error) {
		return handleApiError(error, 'Error al obtener registros')
	}
}

/**
 * POST handler for creating a new DEA record
 */
export async function POST(request: NextRequest) {
	try {
		const data = await request.json()
		const record = await deaService.createRecord(data)
		return createSuccessResponse(record, 201)
	} catch (error) {
		return handleApiError(error, 'Error al crear registro')
	}
}
