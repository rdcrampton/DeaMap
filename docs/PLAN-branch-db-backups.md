# Plan: Base de Datos por Rama con Datos Dummy

## Resumen

Modificar `scripts/migrate.js` para que cada rama de desarrollo tenga su propia base de datos con datos dummy realistas, creándola solo en el primer deploy de cada rama.

## Variables de Entorno Nuevas

```env
# Credenciales de admin para crear bases de datos
POSTGRES_ADMIN_URL=postgresql://postgres:password@host:5432/postgres

# Componentes para construir URLs dinámicas
POSTGRES_HOST=your-host.com
POSTGRES_PORT=5432
POSTGRES_DB_USER=app_user
POSTGRES_DB_PASSWORD=app_password

# Nombre de la base de datos de producción (referencia)
PRODUCTION_DATABASE_NAME=samur_dea
```

## Arquitectura Propuesta

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        scripts/migrate.js (mejorado)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ¿Es Vercel y rama claude/* o feature/*?                                 │
│     └─ NO → Comportamiento actual (DATABASE_URL directo)                    │
│     └─ SÍ → Continuar ↓                                                     │
│                                                                              │
│  2. ¿Existe POSTGRES_ADMIN_URL?                                             │
│     └─ NO → Skip creación automática, usar DATABASE_URL                     │
│     └─ SÍ → Continuar ↓                                                     │
│                                                                              │
│  3. Calcular nombre de BD para la rama                                      │
│     └─ claude/feature-xyz → samur_dea_claude_feature_xyz                    │
│     └─ Sanitizar caracteres especiales (/, -, etc.)                         │
│                                                                              │
│  4. ¿Existe la BD?                                                          │
│     └─ SÍ → Usar BD existente (no recrear)                                  │
│     └─ NO → Crear BD vacía + aplicar migraciones + ejecutar seed completo   │
│                                                                              │
│  5. Construir DATABASE_URL dinámico para Prisma                             │
│                                                                              │
│  6. Ejecutar migraciones (prisma migrate deploy)                            │
│                                                                              │
│  7. Si es BD nueva → Ejecutar seed con datos dummy                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Cambios a Implementar

### 1. Nuevo archivo: `scripts/branch-database.js`

Módulo que maneja la lógica de creación de BD por rama:

```javascript
// Funciones principales:
- sanitizeBranchName(branch) → nombre válido para PostgreSQL
- checkDatabaseExists(adminUrl, dbName) → boolean
- createBranchDatabase(adminUrl, dbName) → void
- buildDatabaseUrl(host, port, user, password, dbName) → string
```

### 2. Nuevo archivo: `prisma/seed-dummy.ts`

Seeder mejorado que genera datos realistas:

```typescript
// Configuración
const CONFIG = {
  totalAeds: 500,                    // Cantidad de DEAs a generar
  districtsCount: 21,                // Distritos de Madrid
  statusDistribution: {
    PUBLISHED: 60%,                  // Mayoría publicados
    DRAFT: 15%,
    PENDING_REVIEW: 10%,
    INACTIVE: 10%,
    REJECTED: 5%
  },
  sourceOriginDistribution: {
    WEB_FORM: 30%,
    ADMIN_FORM: 20%,
    EXCEL_IMPORT: 15%,
    LEGACY_MIGRATION: 15%,
    EXTERNAL_API: 10%,
    CITIZEN_REPORT: 10%
  }
}
```

**Datos que generará:**

| Entidad | Cantidad | Variedad |
|---------|----------|----------|
| Districts | 21 | Todos los distritos de Madrid con datos reales |
| AEDs | 500 | Distribuidos geográficamente por Madrid |
| Responsibles | ~150 | Organizaciones variadas |
| Schedules | ~100 | Horarios diversos (24h, comercial, escolar) |
| Locations | 500 | Direcciones realistas de Madrid |
| StatusChanges | ~1500 | Historial de cambios por AED |
| CodeHistory | 500 | Un registro por AED |
| Organizations | 10 | SAMUR, hospitales, empresas |
| Users | 20 | Admin, validators, viewers |

**Tipos de establecimientos:**
- Centros educativos (colegios, institutos, universidades)
- Centros deportivos (polideportivos, gimnasios, piscinas)
- Centros comerciales y tiendas
- Estaciones de transporte (metro, cercanías, autobuses)
- Edificios públicos (ayuntamientos, bibliotecas)
- Centros de salud y farmacias
- Hoteles y restaurantes
- Empresas y oficinas
- Comunidades de vecinos

### 3. Modificar: `scripts/migrate.js`

```javascript
// Nuevo flujo
const {
  shouldCreateBranchDatabase,
  createBranchDatabaseIfNeeded,
  getDatabaseUrlForBranch
} = require('./branch-database');

// Al inicio del script
if (shouldCreateBranchDatabase()) {
  const { isNewDatabase, databaseUrl } = await createBranchDatabaseIfNeeded();
  process.env.DATABASE_URL = databaseUrl;

  // Después de migraciones, si es nueva
  if (isNewDatabase) {
    execSync('npx prisma db seed -- --dummy', { ... });
  }
}
```

### 4. Modificar: `package.json`

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "scripts": {
    "db:seed": "npx prisma db seed",
    "db:seed:dummy": "tsx prisma/seed-dummy.ts"
  }
}
```

## Estructura del Seeder Dummy

```typescript
// prisma/seed-dummy.ts

import { faker } from '@faker-js/faker/locale/es';

// Datos realistas de Madrid
const MADRID_DISTRICTS = [
  { code: 1, name: 'Centro', postalCodes: ['28012', '28013', '28014'] },
  { code: 2, name: 'Arganzuela', postalCodes: ['28005', '28045'] },
  // ... 21 distritos
];

const ESTABLISHMENT_TYPES = [
  'Centro educativo', 'Centro deportivo', 'Centro comercial',
  'Estación de metro', 'Estación de cercanías', 'Edificio público',
  'Centro de salud', 'Farmacia', 'Hotel', 'Restaurante',
  'Empresa', 'Comunidad de vecinos', 'Parque público'
];

const SCHEDULE_TEMPLATES = [
  { name: '24 horas', has24h: true, ... },
  { name: 'Horario comercial', weekday: '09:00-21:00', saturday: '10:00-14:00' },
  { name: 'Horario escolar', weekday: '08:00-17:00', closedAugust: true },
  // ...
];

async function seedDummy() {
  // 1. Crear distritos reales de Madrid
  await createMadridDistricts();

  // 2. Crear organizaciones
  await createOrganizations();

  // 3. Crear usuarios de prueba
  await createTestUsers();

  // 4. Generar DEAs con distribución realista
  for (let i = 0; i < CONFIG.totalAeds; i++) {
    await createRealisticAed(i);
  }

  console.log(`✅ Seeded ${CONFIG.totalAeds} DEAs with dummy data`);
}
```

## Ejemplo de DEA Generado

```javascript
{
  code: "07-042",
  name: "Polideportivo Municipal La Elipa",
  establishment_type: "Centro deportivo",
  status: "PUBLISHED",
  source_origin: "ADMIN_FORM",
  latitude: 40.4312,
  longitude: -3.6521,
  location: {
    street_type: "Calle",
    street_name: "O'Donnell",
    street_number: "57",
    postal_code: "28007",
    district: "Retiro",
    access_instructions: "Entrada principal, junto a recepción"
  },
  schedule: {
    weekday_opening: "07:00",
    weekday_closing: "23:00",
    saturday_opening: "08:00",
    saturday_closing: "22:00",
    has_24h_surveillance: false
  },
  responsible: {
    name: "Coordinador Deportivo",
    email: "polideportivo.laelipa@madrid.es",
    organization: "Ayuntamiento de Madrid - Deportes"
  }
}
```

## Flujo de Ejecución

```
                    ┌─────────────────────┐
                    │   Push a rama       │
                    │  claude/feature-x   │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  Vercel Build       │
                    │  node migrate.js    │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
    ┌─────────▼─────────┐     │     ┌─────────▼─────────┐
    │ ¿Primera vez?     │     │     │ BD ya existe      │
    │ (BD no existe)    │     │     │                   │
    └─────────┬─────────┘     │     └─────────┬─────────┘
              │               │               │
    ┌─────────▼─────────┐     │     ┌─────────▼─────────┐
    │ CREATE DATABASE   │     │     │ Usar BD existente │
    │ samur_dea_feat_x  │     │     │ (conserva datos)  │
    └─────────┬─────────┘     │     └─────────┬─────────┘
              │               │               │
    ┌─────────▼─────────┐     │               │
    │ prisma migrate    │     │               │
    │ deploy            │◄────┴───────────────┤
    └─────────┬─────────┘                     │
              │                               │
    ┌─────────▼─────────┐               ┌─────▼─────┐
    │ prisma db seed    │               │  Build    │
    │ --dummy (500 DEAs)│               │  Next.js  │
    └─────────┬─────────┘               └───────────┘
              │
    ┌─────────▼─────────┐
    │  Build Next.js    │
    └───────────────────┘
```

## Beneficios

1. **Aislamiento**: Cada rama tiene su propia BD, no afecta a otras ramas ni producción
2. **Datos realistas**: 500 DEAs para probar búsquedas, filtros, paginación, mapa
3. **Persistencia**: Los datos se mantienen entre deploys de la misma rama
4. **Testing completo**: Todos los estados, orígenes, horarios representados
5. **Desarrollo ágil**: No hay que importar datos manualmente

## Consideraciones

### Limpieza de BDs huérfanas
Cuando una rama se elimina, la BD queda huérfana. Opciones:
- Script de limpieza manual
- Job periódico que elimina BDs de ramas que ya no existen
- Prefijo con timestamp para identificar BDs antiguas

### Límites del proveedor
Verificar con tu proveedor de PostgreSQL:
- Límite de bases de datos por cuenta
- Espacio de almacenamiento
- Conexiones concurrentes

### Tiempo de build
El seed con 500 DEAs añade ~30-60 segundos al primer build de cada rama.

## Archivos a Crear/Modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `scripts/branch-database.js` | Crear | Lógica de gestión de BD por rama |
| `prisma/seed-dummy.ts` | Crear | Seeder con datos dummy realistas |
| `prisma/data/madrid-districts.json` | Crear | Datos de distritos de Madrid |
| `scripts/migrate.js` | Modificar | Integrar creación de BD por rama |
| `package.json` | Modificar | Añadir script de seed dummy |

## Dependencias Nuevas

```bash
npm install @faker-js/faker pg --save-dev
```

- `@faker-js/faker`: Generación de datos falsos realistas (nombres, emails, teléfonos)
- `pg`: Cliente PostgreSQL nativo para operaciones de admin (CREATE DATABASE)

## Siguiente Paso

¿Apruebas este plan? Si es así, procedo a implementarlo.
