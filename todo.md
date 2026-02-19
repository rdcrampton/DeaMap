# TODO - Auditoría general del proyecto DeaMap

Fecha: 2026-02-19

---

## P0 - CRITICO (Seguridad / Datos en riesgo) -- RESUELTO 2026-02-19

- [x] **Restaurar verificación de rol admin en endpoint de limpieza**
  - Cambiado `requireAuth` -> `requireAdmin`, restaurado filtro JSON de `status_metadata.reason`.

- [x] **Eliminar fallback hardcoded del JWT secret**
  - Ahora lanza error en producción si `JWT_SECRET` no existe. Fallback solo en dev.

- [x] **Proteger endpoint SharePoint validate-cookies con autenticación**
  - Añadido `requireAuth` al handler.

- [x] **Proteger POST /api/aeds con rate limiting**
  - Añadido rate limiter in-memory (5 req/h por IP para anónimos). Usuarios autenticados no tienen límite.
  - Añadida validación de `name` (tipo, longitud mínima/máxima).

- [x] **Corregir validación de dominio en image-proxy (SSRF)**
  - Cambiado `.includes()` -> `.endsWith()` para validación de hostname.

- [x] **Restringir wildcard en `images.remotePatterns`**
  - Restringido a `*.s3.*.amazonaws.com`, `*.cloudfront.net`, `*.sharepoint.com`.
  - Eliminado rewrite no-op (`/api/:path* -> /api/:path*`).

---

## P1 - ALTA (Rendimiento / Arquitectura / Calidad)

### Rendimiento -- RESUELTO 2026-02-19

- [x] **Usar PostGIS para búsqueda de proximidad en lugar de Haversine en JS**
  - Reescrito `nearby/route.ts` usando `ST_DWithin` + `ST_Distance` con el índice espacial de `geom`.
  - Eliminado cálculo Haversine en JS y bounding-box manual.

- [x] **Corregir N+1 en listado de usuarios admin**
  - Reemplazado `Promise.all(users.map(...))` por `include: { organization_members }` en un solo query.
  - Eliminado `any` en where clause.

- [x] **Añadir cache headers a endpoints públicos del mapa**
  - `GET /api/aeds`: `s-maxage=60, stale-while-revalidate=300`
  - `GET /api/aeds/by-bounds`: `s-maxage=30, stale-while-revalidate=120`
  - `GET /api/aeds/nearby`: `s-maxage=60, stale-while-revalidate=300`

- [x] **Consolidar queries de permisos en `organization-permissions.ts`**
  - `getUserPermissionsForAed` reducido de 8 queries (4 funciones x 2 queries) a máximo 2 queries.

### Arquitectura DDD

- [ ] **Crear bounded context `aed/` con CreateAedUseCase**
  - Archivo: `src/app/api/aeds/route.ts` (POST handler)
  - La lógica de creación de AED (responsible, location, schedule, aed, statusChange) está directamente en el route handler.
  - Mover a un use case propio siguiendo el patrón de `batch/` e `import/`.

- [ ] **Completar bounded context `export/`**
  - `src/export/domain/ports/IExportRepository.ts` es un stub.
  - El API route `src/app/api/export/route.ts` llama a Prisma directamente, sin DDD.

- [ ] **Mover lógica de auth a use cases**
  - Archivos: `src/app/api/auth/login/route.ts`, `register/route.ts`
  - Login/register hacen Prisma + bcrypt + JWT directamente en el handler. Crear `LoginUseCase`, `RegisterUseCase`.

- [ ] **Corregir import de infraestructura en dominio de storage**
  - Archivo: `src/storage/domain/ports/IImageStorage.ts:6`
  - Importa `ImageVariant` desde `@/lib/s3-utils` (infraestructura). Definir el type en el propio dominio.

### Testing

- [ ] **Crear pipeline CI/CD (GitHub Actions)**
  - No existe `.github/workflows/`. No hay checks automáticos en PRs.
  - Mínimo: lint + type-check + unit tests + build.

- [ ] **Tests para BatchJob entity (máquina de estados)**
  - Archivo: `src/batch/domain/entities/BatchJob.ts`
  - Transiciones PENDING->IN_PROGRESS->WAITING->RESUMING->COMPLETED, detección de stuck, recovery, heartbeat.
  - Zero tests actualmente.

- [ ] **Tests para DuplicateDetectionService**
  - Archivo: `src/import/domain/services/DuplicateDetectionService.ts`
  - Estrategia cascada (ID -> code -> externalReference) sin cobertura.

- [ ] **Tests para AedValidationService y CoordinateValidationService**
  - Validación de campos y umbrales de coordenadas sin cobertura.

- [ ] **Tests de integración para API routes críticos**
  - `POST /api/aeds`, `POST /api/auth/login`, `GET /api/aeds/nearby`, `POST /api/import`
  - 55+ routes sin ningún test de integración.

### Seguridad complementaria -- RESUELTO 2026-02-19

- [x] **Implementar rate limiting**
  - Creado `src/lib/rate-limit.ts` con factory reutilizable y limpieza periódica de memoria.
  - Auth (login/register/forgot-password): 10 req/15min por IP.
  - Geocode: 30 req/min por IP.
  - POST /api/aeds: 5 req/h por IP (ya en P0).

- [x] **Crear `src/middleware.ts` para protección centralizada de rutas**
  - Verifica existencia de cookie JWT + estructura válida antes de llegar al route handler.
  - Protege: `/api/admin/*`, `/api/batch/*`, `/api/import/*`, `/api/export/*`, `/api/verify`, `/api/upload`, `/api/deas`.
  - Excluye públicos: `/api/aeds`, `/api/auth/*`, `/api/health`, `/api/geocode`.

- [x] **Hashear tokens de reset de contraseña**
  - `forgot-password`: genera token, almacena SHA-256 en DB, envía token plano por email.
  - `reset-password`: hashea el token recibido con SHA-256 antes de comparar con DB.

### Error handling -- RESUELTO 2026-02-19

- [x] **Creado `src/lib/api-error.ts`** con factory estandarizada de errores.
- [x] **Protegidos detalles internos en admin/organizations** (solo se exponen en development).

---

## P2 - MEDIA (Calidad de código / DX / Frontend) -- PARCIALMENTE RESUELTO 2026-02-19

### TypeScript / Tipado -- RESUELTO 2026-02-19

- [x] **Eliminar uso extensivo de `any` en rutas críticas**
  - `deas/route.ts:86`: `whereClause: any` → `Record<string, any>` con eslint-disable (Prisma no expone tipos compatibles con dynamic where + include).
  - `verify/duplicates/route.ts`: `internal_notes: any` → `Array<{ text?: string; [key: string]: unknown }> | null`.
  - `SharePointImageDownloader.ts`: `error as any` → tipado estructural `{ response?: { status?: number }; message?: string }`.
  - `publication-filter.ts`: `responsible.notes: any` → `Record<string, unknown>[] | null`. Sub-objetos ahora con campos opcionales.

- [x] **Eliminar casts `as unknown as` que silencian errores de tipos**
  - `aeds/route.ts`, `aeds/nearby/route.ts`, `aeds/[id]/route.ts`: `as unknown as AedFullData` → `as AedFullData` (posible gracias a flexibilizar la interfaz).
  - `verify/duplicates/route.ts`: `as unknown as DuplicateAedData[]` → `as DuplicateAedData[]`.
  - `jwt.ts`: `payload as unknown as JWTPayload` → validación estructural del payload (`typeof userId/email/role`).

- [ ] **Añadir validación con Zod en API routes**
  - Solo 2 de ~60 routes usan Zod. El resto castea `request.json()` a interfaces TypeScript sin validación runtime.
  - Prioridad: `POST /api/aeds`, `POST /api/auth/login`, `POST /api/import`.
  - `zod` añadido como dependencia directa (era solo transitive).

### Frontend

- [ ] **Añadir error boundaries en componentes críticos**
  - Zero `ErrorBoundary` en toda la aplicación.
  - Mínimo: mapa (Leaflet), wizard de importación, panel admin.

- [ ] **Descomponer `MapView.tsx` (god component)**
  - Gestiona: iconos custom, data fetching, event handling, clusters, markers, estados.
  - Extraer: `MarkerFactory`, `MapEventHandler`, `ClusterLayer`.

- [x] **Instalar `eslint-plugin-react-hooks` y activar `exhaustive-deps`**
  - Instalado `eslint-plugin-react-hooks@7` como devDependency directa.
  - Activadas reglas: `rules-of-hooks: error`, `exhaustive-deps: warn`.
  - Ya detecta deps faltantes (e.g. `verify/[id]/page.tsx`).

- [ ] **Descomponer `ImportWizard.tsx`**
  - Gestiona estado multi-step, upload, mapping, validación, SharePoint.
  - Extraer hook `useImportWizard` con la máquina de estados.

### Error handling

- [ ] **Unificar formato de respuestas de error en API**
  - Se usan 3 formatos diferentes: `{ error }`, `{ success: false, error }`, `{ success: false, error, message }`.
  - Ya existe `src/lib/api-error.ts` (P1). Falta aplicar en todas las rutas.

- [ ] **Integrar servicio de monitoreo de errores (Sentry o similar)**
  - `instrumentation.ts` existe y ahora valida env vars al arranque. Falta tracking de errores en producción.

### Dependencias -- RESUELTO 2026-02-19

- [x] **Mover `@vladmandic/face-api` a carga dinámica**
  - `ImageBlur` ahora se carga con `next/dynamic` en `verify/[id]/page.tsx` (ssr: false, loading fallback).
  - Evita que face-api (~3 MB) se incluya en el bundle principal.

- [ ] **Evaluar eliminación de `axios`**
  - Solo se usa en `SharePointImageDownloader.ts` con features de redirect tracking. Reemplazo con `fetch` requiere refactor significativo. Se mantiene.
  - `dotenv` se mantiene: necesario para `prisma.config.ts` y scripts standalone.

- [x] **Limpiar variables de NextAuth en `.env.example`**
  - Reemplazado `NEXTAUTH_SECRET`/`NEXTAUTH_URL` por `JWT_SECRET`.
  - Eliminado `AWS_S3_BUCKET` duplicado.

### Configuración / DevOps -- RESUELTO 2026-02-19

- [x] **Añadir headers de seguridad faltantes**
  - Añadidos en `next.config.ts`: `Referrer-Policy`, `Permissions-Policy`, `X-DNS-Prefetch-Control`, `Strict-Transport-Security`.

- [x] **Validar env vars al arranque con Zod**
  - Creado `src/lib/env.ts` con schema Zod para todas las variables.
  - Conectado en `src/instrumentation.ts` → `getServerEnv()` al arrancar.
  - En producción: lanza error fatal. En dev: warn + continúa.

- [x] **Externalizar credenciales de docker-compose**
  - `POSTGRES_USER/PASSWORD/DB` ahora usan `${VAR:-default}` para override desde entorno.

- [ ] **Añadir healthcheck a servicio postgres en docker-compose**
  - No tiene `healthcheck`. Servicios dependientes no pueden esperar a que la DB esté lista.

- [ ] **Configurar `@next/bundle-analyzer`**
  - Con `canvas`, `face-api`, `leaflet`, `papaparse`, `proj4` es importante monitorizar el bundle.

### Code duplication -- RESUELTO 2026-02-19

- [x] **Extraer patrón `requireAuth` + early return a HOF**
  - Creado `src/lib/api-handlers.ts` con `withAuth()` y `withAdmin()` wrappers.
  - Incluyen try/catch centralizado y ocultación de detalles en producción.

- [x] **Unificar S3Client (singleton compartido)**
  - `src/lib/s3.ts` ahora exporta `getS3Client()` (lazy singleton), `getS3BucketName()`, `getS3Region()`.
  - `S3ImageStorageAdapter` consume el singleton en vez de crear su propio client.

- [x] **Corregir import de infraestructura en dominio de storage**
  - `IImageStorage.ts` ya no importa `ImageVariant` desde `@/lib/s3-utils`. Tipo definido en el propio dominio.

- [ ] **Unificar normalización de resultados de Google Geocoding**
  - Duplicado entre `src/app/api/geocode/route.ts` y `src/location/infrastructure/services/InternalGeocodingService.ts`.

---

## P3 - BAJA (Nice-to-have / Deuda técnica menor)

- [ ] **Reducir payload del endpoint admin AED detail**
  - `src/app/api/admin/deas/[id]/route.ts` carga todas las relaciones de un AED con includes anidados.
  - Considerar carga lazy por tabs o paginación.

- [ ] **Verificar que `.env` no está commiteado con secretos reales**
  - Se detectó `.env` en el repositorio. Si contiene credenciales están en el historial git.

- [ ] **Revisar lógica de filtro `isActive !== null` en admin users**
  - `src/app/api/admin/users/route.ts:34` - `searchParams.get()` devuelve string, no null, cuando se pasa como parámetro vacío.

- [ ] **Estandarizar generación de IDs entre bounded contexts**
  - `ImportSession.generateId()` usa `Date.now() + Math.random().toString(36)`.
  - `BatchJob` usa `uuid`. Estandarizar.

- [ ] **Eliminar endpoint `/api/health` que expone info del sistema**
  - Devuelve `environment`, `version`, `aedCount` sin autenticación. Ayuda a fingerprinting.

- [ ] **Configurar logging de fetches en desarrollo**
  - Next.js 15+ soporta `logging: { fetches: { fullUrl: true } }` en `next.config.ts`.

- [ ] **Considerar React Suspense/streaming SSR para mapa y listas**
  - Los loading states son manuales en hooks. Suspense mejoraría UX con streaming.

- [ ] **Revisar si `react-leaflet-cluster` y `leaflet.markercluster` duplican funcionalidad**
  - Ambos en `package.json`. El primero re-exporta al segundo. Posible conflicto de versiones/CSS.

---

## Importaciones masivas (backlog previo - 2026-02-18)

### Acciones nuestras

- [ ] Migrar `S3DataSource` a lectura en streaming real (evitar OOM con archivos grandes).
- [ ] Optimizar persistencia de checkpoints para escrituras en bloque en `PrismaStateStore`.
- [ ] Implementar `checkBatch` en `AedDuplicateChecker` con consultas bulk (N+1).
- [ ] Desacoplar procesamiento de imágenes (`afterProcess`) del flujo crítico de importación.
- [ ] Añadir suite de stress tests reproducibles (10k, 50k, 100k filas).
- [ ] Definir SLOs de importación y umbrales de alerta.

### Issues a abrir en paquetes externos

- [ ] Solicitar re-export de tipos core (`SourceMetadata`, `BatchState`) desde `@batchactions/import`.
- [ ] Solicitar guía oficial de hardening/performance para cargas masivas.
- [ ] Solicitar benchmark oficial y ejemplos de referencia para 10k/50k/100k registros.
- [ ] Solicitar documentación de límites y comportamiento en resume/re-parseo de fuentes grandes.
- [ ] (Opcional) Proponer helpers de estado batch para stores SQL de alto volumen en `@batchactions/core`.
