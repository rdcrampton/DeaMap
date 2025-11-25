# Roadmap de Refactorizaciones - Siguientes Pasos

## 📅 Fecha: 22 de Noviembre de 2025

## 📊 Estado Actual

**FASE 1 COMPLETADA ✅**
- Dominio puro implementado (Value Objects, Entidades, Puertos)
- Separación clara entre dominio e infraestructura
- Tests unitarios básicos
- Documentación completa

---

## 🎯 ROADMAP DE REFACTORIZACIONES

### **FASE 2: Adapters e Infraestructura** (Semanas 1-2)

#### Prioridad: ⭐⭐⭐ CRÍTICA

#### Objetivos
1. Implementar adapter Prisma que cumpla contrato del puerto
2. Crear mappers bidireccionales (Domain ↔ Prisma)
3. Mantener repositorio legacy temporalmente
4. Tests de contrato para verificar implementación

---

### **Refactorización 1: Adapter PrismaDeaRepository**

#### Estructura a crear:
```
src/dea-management/infrastructure/
├── prisma/
│   ├── PrismaDeaRepository.ts
│   └── mappers/
│       ├── DeaPrismaMapper.ts
│       ├── DeaIdMapper.ts
│       ├── DeaCodeMapper.ts
│       ├── LocationMapper.ts
│       └── VerificationStatusMapper.ts
└── README.md
```

#### Componentes:

**1. PrismaDeaRepository.ts**
```typescript
import { DeaRepository, FindOptions, FindResult } from '../../domain/ports/DeaRepository';
import { Dea } from '../../domain/entities/Dea';
import { DeaId } from '../../domain/value-objects/DeaId';
import { DeaCode } from '../../domain/value-objects/DeaCode';
import { VerificationStatus } from '../../domain/value-objects/VerificationStatus';
import { DeaPrismaMapper } from './mappers/DeaPrismaMapper';
import { prisma } from '@/lib/db';

export class PrismaDeaRepository implements DeaRepository {
  private mapper: DeaPrismaMapper;

  constructor() {
    this.mapper = new DeaPrismaMapper();
  }

  async findById(id: DeaId): Promise<Dea | null> {
    const record = await prisma.deaRecord.findUnique({
      where: { id: id.toNumber() }
    });
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByCode(code: DeaCode): Promise<Dea | null> {
    const record = await prisma.deaRecord.findFirst({
      where: { defCodDea: code.toString() }
    });
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findAll(options?: FindOptions): Promise<FindResult<Dea>> {
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = this.buildWhereClause(options);

    // Execute queries in parallel
    const [records, totalCount] = await Promise.all([
      prisma.deaRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildOrderBy(options)
      }),
      prisma.deaRecord.count({ where })
    ]);

    return {
      data: records.map(r => this.mapper.toDomain(r)),
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async save(dea: Dea): Promise<void> {
    const prismaData = this.mapper.toPrisma(dea);
    
    if (dea.getId().toNumber() === 0) {
      // Create new
      await prisma.deaRecord.create({ data: prismaData });
    } else {
      // Update existing
      await prisma.deaRecord.update({
        where: { id: dea.getId().toNumber() },
        data: prismaData
      });
    }
  }

  async delete(id: DeaId): Promise<void> {
    await prisma.deaRecord.delete({
      where: { id: id.toNumber() }
    });
  }

  async count(): Promise<number> {
    return await prisma.deaRecord.count();
  }

  async countByStatus(status: VerificationStatus): Promise<number> {
    return await prisma.deaRecord.count({
      where: { dataVerificationStatus: status.toString() }
    });
  }

  async existsByCode(code: DeaCode): Promise<boolean> {
    const count = await prisma.deaRecord.count({
      where: { defCodDea: code.toString() }
    });
    return count > 0;
  }

  async getNextSecuencialForDistrito(distrito: number): Promise<number> {
    const lastCode = await prisma.deaCode.findFirst({
      where: { distrito },
      orderBy: { secuencial: 'desc' }
    });
    
    return lastCode ? lastCode.secuencial + 1 : 1;
  }

  private buildWhereClause(options?: FindOptions) {
    const where: any = {};
    
    if (options?.status) {
      where.dataVerificationStatus = options.status.toString();
    }
    
    return where;
  }

  private buildOrderBy(options?: FindOptions) {
    const orderBy = options?.orderBy ?? 'createdAt';
    const direction = options?.orderDirection ?? 'desc';
    
    return { [orderBy]: direction };
  }

  // Métodos adicionales del puerto...
  async findByProvisionalNumber(provisionalNumber: number): Promise<Dea | null> {
    const record = await prisma.deaRecord.findFirst({
      where: { numeroProvisionalDea: provisionalNumber }
    });
    
    return record ? this.mapper.toDomain(record) : null;
  }

  async findByDistrito(distrito: number, options?: FindOptions): Promise<FindResult<Dea>> {
    // Similar a findAll pero filtrando por distrito
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = {
      ...this.buildWhereClause(options),
      distrito: distrito.toString()
    };

    const [records, totalCount] = await Promise.all([
      prisma.deaRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: this.buildOrderBy(options)
      }),
      prisma.deaRecord.count({ where })
    ]);

    return {
      data: records.map(r => this.mapper.toDomain(r)),
      totalCount,
      page,
      pageSize: limit,
      totalPages: Math.ceil(totalCount / limit)
    };
  }

  async findByStatus(status: VerificationStatus, options?: FindOptions): Promise<FindResult<Dea>> {
    return this.findAll({
      ...options,
      status
    });
  }
}
```

**2. DeaPrismaMapper.ts**
```typescript
import { Dea, DeaProps } from '../../../domain/entities/Dea';
import { DeaId } from '../../../domain/value-objects/DeaId';
import { DeaCode } from '../../../domain/value-objects/DeaCode';
import { Location } from '../../../domain/value-objects/Location';
import { VerificationStatus } from '../../../domain/value-objects/VerificationStatus';
import { DeaRecord as PrismaDeaRecord } from '@prisma/client';

export class DeaPrismaMapper {
  /**
   * Convierte un modelo de Prisma a una entidad de dominio
   */
  toDomain(prismaRecord: PrismaDeaRecord): Dea {
    const props: DeaProps = {
      id: DeaId.fromNumber(prismaRecord.id),
      code: prismaRecord.defCodDea 
        ? DeaCode.fromString(prismaRecord.defCodDea) 
        : null,
      nombre: prismaRecord.nombre,
      numeroProvisionalDea: prismaRecord.numeroProvisionalDea,
      tipoEstablecimiento: prismaRecord.tipoEstablecimiento,
      location: Location.fromCoordinates(
        prismaRecord.latitud,
        prismaRecord.longitud
      ),
      distrito: prismaRecord.distrito,
      codigoPostal: prismaRecord.codigoPostal,
      status: VerificationStatus.fromString(
        prismaRecord.dataVerificationStatus || 'pending'
      ),
      foto1: prismaRecord.foto1 ?? undefined,
      foto2: prismaRecord.foto2 ?? undefined,
      descripcionAcceso: prismaRecord.descripcionAcceso ?? undefined,
      createdAt: prismaRecord.createdAt,
      updatedAt: prismaRecord.updatedAt
    };

    return Dea.reconstituteFromPersistence(props);
  }

  /**
   * Convierte una entidad de dominio a un modelo de Prisma
   */
  toPrisma(dea: Dea): Omit<PrismaDeaRecord, 'id'> {
    const snapshot = dea.toSnapshot();
    
    return {
      nombre: snapshot.nombre,
      numeroProvisionalDea: snapshot.numeroProvisionalDea,
      tipoEstablecimiento: snapshot.tipoEstablecimiento,
      latitud: snapshot.location.latitude,
      longitud: snapshot.location.longitude,
      distrito: snapshot.distrito,
      codigoPostal: snapshot.codigoPostal,
      dataVerificationStatus: snapshot.status,
      defCodDea: snapshot.code,
      foto1: snapshot.foto1 ?? null,
      foto2: snapshot.foto2 ?? null,
      descripcionAcceso: snapshot.descripcionAcceso ?? null,
      
      // Campos requeridos por Prisma (valores por defecto o existentes)
      horaInicio: new Date(), // TODO: Agregar al dominio
      horaFinalizacion: new Date(), // TODO: Agregar al dominio
      correoElectronico: '', // TODO: Agregar al dominio
      titularidadLocal: '', // TODO: Agregar al dominio
      usoLocal: '', // TODO: Agregar al dominio
      titularidad: '', // TODO: Agregar al dominio
      propuestaDenominacion: '', // TODO: Agregar al dominio
      tipoVia: '', // TODO: Agregar al dominio
      nombreVia: '', // TODO: Agregar al dominio
      numeroVia: null,
      complementoDireccion: null,
      horarioApertura: '',
      aperturaLunesViernes: 0,
      cierreLunesViernes: 0,
      aperturaSabados: 0,
      cierreSabados: 0,
      aperturaDomingos: 0,
      cierreDomingos: 0,
      vigilante24h: '',
      comentarioLibre: null,
      gmTipoVia: null,
      gmNombreVia: null,
      gmNumero: null,
      gmCp: null,
      gmDistrito: null,
      gmLat: null,
      gmLon: null,
      defTipoVia: null,
      defNombreVia: null,
      defNumero: null,
      defCp: null,
      defDistrito: null,
      defLat: null,
      defLon: null,
      gmBarrio: null,
      defBarrio: null,
      createdAt: new Date(snapshot.createdAt),
      updatedAt: new Date(snapshot.updatedAt)
    };
  }
}
```

#### Tests de Contrato:
```typescript
// tests/contract/DeaRepository.contract.ts
import { DeaRepository } from '../../src/dea-management/domain/ports/DeaRepository';
import { Dea, CreateDeaData } from '../../src/dea-management/domain/entities/Dea';
import { DeaId } from '../../src/dea-management/domain/value-objects/DeaId';
import { Location } from '../../src/dea-management/domain/value-objects/Location';

/**
 * Test de contrato reutilizable para cualquier implementación de DeaRepository
 * Garantiza que todas las implementaciones cumplen el contrato
 */
export function deaRepositoryContractTests(
  createRepository: () => DeaRepository,
  cleanup: () => Promise<void>
) {
  describe('DeaRepository Contract', () => {
    let repository: DeaRepository;

    beforeEach(() => {
      repository = createRepository();
    });

    afterEach(async () => {
      await cleanup();
    });

    describe('save and findById', () => {
      it('debe guardar y recuperar un DEA', async () => {
        const deaData: CreateDeaData = {
          nombre: 'Farmacia Test',
          numeroProvisionalDea: 1001,
          tipoEstablecimiento: 'Farmacia',
          location: Location.fromCoordinates(40.4168, -3.7038),
          distrito: '1',
          codigoPostal: 28001
        };

        const dea = Dea.create(deaData);
        await repository.save(dea);

        const found = await repository.findById(dea.getId());
        expect(found).not.toBeNull();
        expect(found?.getName()).toBe('Farmacia Test');
      });
    });

    describe('findByCode', () => {
      it('debe encontrar DEA por código', async () => {
        // Test implementation
      });
    });

    describe('findAll', () => {
      it('debe retornar resultados paginados', async () => {
        // Test implementation
      });
    });

    // Más tests...
  });
}
```

---

### **Refactorización 2: Casos de Uso (Application Layer)**

#### Estructura:
```
src/dea-management/application/
├── use-cases/
│   ├── GetDeaByIdUseCase.ts
│   ├── ListVerifiedDeasUseCase.ts
│   ├── VerifyDeaUseCase.ts
│   ├── DiscardDeaUseCase.ts
│   └── AssignDeaCodeUseCase.ts
├── commands/
│   ├── VerifyDeaCommand.ts
│   ├── DiscardDeaCommand.ts
│   └── AssignCodeCommand.ts
├── queries/
│   ├── GetDeaByIdQuery.ts
│   └── ListDeasQuery.ts
└── dto/
    ├── DeaDto.ts
    └── DeaListDto.ts
```

#### Ejemplo: VerifyDeaUseCase
```typescript
import { DeaRepository } from '../../domain/ports/DeaRepository';
import { DeaId } from '../../domain/value-objects/DeaId';
import { DeaNotFoundError } from '../../domain/errors/DeaErrors';
import { DeaDto } from '../dto/DeaDto';

export interface VerifyDeaCommand {
  deaId: number;
  photo1Url: string;
  photo2Url?: string;
}

export class VerifyDeaUseCase {
  constructor(private readonly repository: DeaRepository) {}

  async execute(command: VerifyDeaCommand): Promise<DeaDto> {
    // 1. Obtener DEA
    const dea = await this.repository.findById(
      DeaId.fromNumber(command.deaId)
    );

    if (!dea) {
      throw new DeaNotFoundError(command.deaId);
    }

    // 2. Aplicar lógica de dominio
    dea.startVerification();
    dea.updatePhotos(command.photo1Url, command.photo2Url);
    dea.markAsVerified();

    // 3. Persistir
    await this.repository.save(dea);

    // 4. Retornar DTO
    return DeaDto.fromDomain(dea);
  }
}
```

#### DTO para respuestas:
```typescript
// dto/DeaDto.ts
import { Dea } from '../../domain/entities/Dea';

export interface DeaDto {
  id: number;
  code: string | null;
  nombre: string;
  numeroProvisional: number;
  tipoEstablecimiento: string;
  ubicacion: {
    latitud: number;
    longitud: number;
  };
  distrito: string;
  codigoPostal: number;
  estado: string;
  fotos: {
    foto1?: string;
    foto2?: string;
  };
  descripcionAcceso?: string;
  createdAt: string;
  updatedAt: string;
}

export class DeaDtoMapper {
  static fromDomain(dea: Dea): DeaDto {
    const snapshot = dea.toSnapshot();
    
    return {
      id: snapshot.id,
      code: snapshot.code,
      nombre: snapshot.nombre,
      numeroProvisional: snapshot.numeroProvisionalDea,
      tipoEstablecimiento: snapshot.tipoEstablecimiento,
      ubicacion: {
        latitud: snapshot.location.latitude,
        longitud: snapshot.location.longitude
      },
      distrito: snapshot.distrito,
      codigoPostal: snapshot.codigoPostal,
      estado: snapshot.status,
      fotos: {
        foto1: snapshot.foto1,
        foto2: snapshot.foto2
      },
      descripcionAcceso: snapshot.descripcionAcceso,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt
    };
  }
}
```

---

### **Refactorización 3: API Routes Refactorizadas**

#### Antes vs Después:

**ANTES:**
```typescript
// src/app/api/dea/[id]/route.ts (actual)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const dea = await prisma.deaRecord.findUnique({
    where: { id: parseInt(params.id) }
  });
  
  return Response.json(dea);
}
```

**DESPUÉS:**
```typescript
// src/app/api/dea/[id]/route.ts (refactorizado)
import { PrismaDeaRepository } from '@/dea-management/infrastructure/prisma/PrismaDeaRepository';
import { GetDeaByIdUseCase } from '@/dea-management/application/use-cases/GetDeaByIdUseCase';
import { handleDomainError } from '@/shared/infrastructure/http/ErrorHandler';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const repository = new PrismaDeaRepository();
    const useCase = new GetDeaByIdUseCase(repository);
    
    const result = await useCase.execute({
      deaId: parseInt(params.id)
    });
    
    return Response.json(result, { status: 200 });
  } catch (error) {
    return handleDomainError(error);
  }
}
```

---

### **Refactorización 4: Manejo Centralizado de Errores**

```typescript
// src/shared/infrastructure/http/ErrorHandler.ts
import {
  DomainError,
  DeaNotFoundError,
  InvalidVerificationTransitionError,
  InvalidDeaDataError,
  MissingRequiredDataError
} from '@/dea-management/domain/errors/DeaErrors';

export function handleDomainError(error: unknown): Response {
  // Errores de dominio
  if (error instanceof DeaNotFoundError) {
    return Response.json(
      { 
        error: 'No encontrado',
        message: error.message 
      },
      { status: 404 }
    );
  }

  if (error instanceof InvalidVerificationTransitionError) {
    return Response.json(
      { 
        error: 'Conflicto de estado',
        message: error.message 
      },
      { status: 409 }
    );
  }

  if (error instanceof InvalidDeaDataError || 
      error instanceof MissingRequiredDataError) {
    return Response.json(
      { 
        error: 'Datos inválidos',
        message: error.message 
      },
      { status: 400 }
    );
  }

  // Error genérico de dominio
  if (error instanceof DomainError) {
    return Response.json(
      { 
        error: 'Error de negocio',
        message: error.message 
      },
      { status: 422 }
    );
  }

  // Error no esperado
  console.error('Unexpected error:', error);
  return Response.json(
    { 
      error: 'Error interno del servidor',
      message: 'Ha ocurrido un error inesperado'
    },
    { status: 500 }
  );
}
```

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN

### Fase 2.1: Adapters (Semana 1)
- [ ] Crear `PrismaDeaRepository`
- [ ] Implementar todos los métodos del puerto
- [ ] Crear `DeaPrismaMapper`
- [ ] Crear mappers para Value Objects
- [ ] Tests de contrato
- [ ] Tests de integración con Prisma

### Fase 2.2: Casos de Uso (Semana 2)
- [ ] Crear estructura de `application/`
- [ ] Implementar `GetDeaByIdUseCase`
- [ ] Implementar `ListVerifiedDeasUseCase`
- [ ] Implementar `VerifyDeaUseCase`
- [ ] Implementar `DiscardDeaUseCase`
- [ ] Crear DTOs de respuesta
- [ ] Tests unitarios de casos de uso

### Fase 2.3: Refactorizar API Routes
- [ ] Crear `ErrorHandler` centralizado
- [ ] Refactorizar `GET /api/dea/:id`
- [ ] Refactorizar `GET /api/dea`
- [ ] Refactorizar `POST /api/verify/:id`
- [ ] Mantener compatibilidad con frontend
- [ ] Tests E2E críticos

---

## 🎯 CRITERIOS DE ÉXITO

### Fase 2 Completa Cuando:
1. ✅ Todos los endpoints usan casos de uso
2. ✅ No hay llamadas directas a Prisma desde routes
3. ✅ Errores manejados consistentemente
4. ✅ Tests pasan (unit + integration + E2E)
5. ✅ Frontend funciona sin cambios
6. ✅ Documentación actualizada

---

## 🚧 RIESGOS Y MITIGACIONES

### Riesgo 1: Breaking changes en API
**Mitigación:** Mantener compatibilidad en DTOs, agregar tests E2E

### Riesgo 2: Performance degradada
**Mitigación:** Medir antes/después, optimizar mappers si es necesario

### Riesgo 3: Complejidad excesiva
**Mitigación:** Empezar con endpoints simples, refinar gradualmente

---

## 📚 REFERENCIAS

- [Documento de mejoras críticas](./ARCHITECTURE_IMPROVEMENTS_CRITICAL.md)
- [Implementing DDD - Vaughn Vernon](https://www.amazon.com/Implementing-Domain-Driven-Design-Vaughn-Vernon/dp/0321834577)
- [Clean Architecture - Robert C. Martin](https://www.amazon.com/Clean-Architecture-Craftsmans-Software-Structure/dp/0134494164)

---

**Última actualización:** 22 de Noviembre de 2025  
**Estado:** Planificado - Listo para implementación
