import { IDeaRepository } from '@/repositories/deaRepository';
import type { DeaRecord } from '@/types';

export interface IDeaService {
  getAllRecords(): Promise<DeaRecord[]>;
  getVerifiedAndCompletedRecords(): Promise<DeaRecord[]>;
  getVerifiedAndCompletedRecordsPaginated(page: number, limit: number): Promise<{
    data: DeaRecord[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
  getRecordById(id: number): Promise<DeaRecord | null>;
  createRecord(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord>;
  updateRecord(id: number, data: Partial<DeaRecord>): Promise<DeaRecord>;
  deleteRecord(id: number): Promise<DeaRecord>;
}

export class DeaService implements IDeaService {
  private repository: IDeaRepository;

  constructor(repository: IDeaRepository) {
    this.repository = repository;
  }

  async getAllRecords(): Promise<DeaRecord[]> {
    return await this.repository.findAll();
  }

  async getVerifiedAndCompletedRecords(): Promise<DeaRecord[]> {
    return await this.repository.findAllVerifiedAndCompleted();
  }

  async getVerifiedAndCompletedRecordsPaginated(page: number, limit: number): Promise<{
    data: DeaRecord[];
    pagination: {
      currentPage: number;
      pageSize: number;
      totalRecords: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const result = await this.repository.findAllVerifiedAndCompletedPaginated(page, limit);
    const totalPages = Math.ceil(result.totalCount / limit);
    
    return {
      data: result.data,
      pagination: {
        currentPage: page,
        pageSize: limit,
        totalRecords: result.totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  async getRecordById(id: number): Promise<DeaRecord | null> {
    return await this.repository.findById(id);
  }

  async createRecord(data: Omit<DeaRecord, 'id'>): Promise<DeaRecord> {
    // Aquí podríamos agregar validaciones o lógica de negocio antes de crear
    return await this.repository.create(data);
  }

  async updateRecord(id: number, data: Partial<DeaRecord>): Promise<DeaRecord> {
    // Validaciones o transformaciones de datos antes de actualizar
    return await this.repository.update(id, data);
  }

  async deleteRecord(id: number): Promise<DeaRecord> {
    return await this.repository.delete(id);
  }
}
