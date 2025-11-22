# Fix: Actualización del campo data_verification_status

## Problema Identificado

El campo `data_verification_status` en la tabla `dea_records` nunca se actualizaba durante el flujo de verificación. Siempre permanecía en el valor por defecto `"pending"`, independientemente de si la verificación se completaba, descartaba o marcaba como inválida.

## Causa Raíz

El campo solo se **leía** en el código (en `simpleVerificationService.ts` para determinar si un DEA estaba "pre_verified"), pero nunca se **actualizaba** cuando cambiaba el estado de la verificación.

## Solución Implementada

### 1. Actualización del Tipo TypeScript

**Archivo:** `src/types/index.ts`

Se agregó el campo `dataVerificationStatus` a la interfaz `DeaRecord`:

```typescript
export interface DeaRecord {
  // ... otros campos
  defCodDea?: string
  dataVerificationStatus?: string  // ← NUEVO CAMPO
  createdAt: string
  updatedAt: string
}
```

### 2. Actualización en completeVerification()

**Archivo:** `src/services/simpleVerificationService.ts`

Se agregó lógica para actualizar el estado del DEA cuando se completa una verificación:

```typescript
// Actualizar el estado de verificación de datos del DEA
const newVerificationStatus = session.markedAsInvalid ? 'invalid' : 'verified';
await this.deaRepository.update(session.deaRecordId, {
  dataVerificationStatus: newVerificationStatus
});

console.log(`✅ DEA ${session.deaRecordId} actualizado con data_verification_status: ${newVerificationStatus}`);
```

**Estados resultantes:**
- `'verified'` - Cuando la verificación se completa exitosamente
- `'invalid'` - Cuando está marcado como inválido (`markedAsInvalid === true`)

### 3. Actualización en discardVerification()

**Archivo:** `src/services/simpleVerificationService.ts`

Se agregó lógica para actualizar el estado del DEA cuando se descarta:

```typescript
// Actualizar el estado de verificación de datos del DEA
await this.deaRepository.update(session.deaRecordId, {
  dataVerificationStatus: 'discarded'
});

console.log(`✅ DEA ${session.deaRecordId} marcado como descartado: ${reason}`);
```

**Estado resultante:**
- `'discarded'` - Cuando la verificación se descarta

### 4. Actualización en select-images route

**Archivo:** `src/app/api/verify/[id]/select-images/route.ts`

Se agregó lógica para actualizar el estado del DEA cuando se seleccionan imágenes y se marca como inválido:

```typescript
// Actualizar el estado de verificación de datos del DEA
await deaRepository.update(session.deaRecordId, {
  dataVerificationStatus: 'invalid'
});
console.log(`✅ DEA ${session.deaRecordId} marcado como inválido (markedAsInvalid)`);
```

**Estado resultante:**
- `'invalid'` - Cuando se marca como inválido en la selección de imágenes o ninguna imagen es válida

## Estados Posibles de data_verification_status

| Estado | Descripción | Cuándo se establece |
|--------|-------------|---------------------|
| `pending` | Valor por defecto, aún no verificado | Al crear un nuevo DEA |
| `pre_verified` | DEA pre-verificado (puede saltar validación de datos) | Manualmente o por script |
| `in_progress` | Verificación en curso | Al iniciar una sesión de verificación |
| `verified` | Verificación completada exitosamente | Al completar verificación con imágenes válidas |
| `invalid` | Marcado como inválido | Al completar con `markedAsInvalid` o sin imágenes válidas |
| `discarded` | Verificación descartada | Al descartar la verificación |

## Flujo de Actualización

```
1. Inicio de verificación (startVerification)
   └─> Guarda estado previo del DEA en session.stepData.previousDataVerificationStatus
   └─> data_verification_status = 'in_progress'

2. Durante la verificación (selección de imágenes)
   └─> Si markedAsInvalid === true
       └─> data_verification_status = 'invalid'
   └─> Si ninguna imagen válida
       └─> data_verification_status = 'invalid'

3. Al completar verificación (completeVerification)
   └─> Si markedAsInvalid === true
       └─> data_verification_status = 'invalid'
   └─> Si tiene processedImageUrl
       └─> data_verification_status = 'verified'

4. Al descartar verificación (discardVerification)
   └─> data_verification_status = 'discarded'

5. Al cancelar verificación (cancelVerification)
   └─> Restaura estado previo desde session.stepData.previousDataVerificationStatus
   └─> data_verification_status = [estado_previo] (ej: 'pending', 'pre_verified', etc.)
```

## Mecanismo de Restauración de Estado

Cuando se inicia una verificación, el sistema:
1. **Guarda el estado actual** del DEA en `session.stepData.previousDataVerificationStatus`
2. **Actualiza el DEA** a `'in_progress'`

Cuando se cancela una verificación, el sistema:
1. **Lee el estado previo** desde `session.stepData.previousDataVerificationStatus`
2. **Restaura el DEA** a ese estado (ej: `'pending'`, `'pre_verified'`, `'verified'`, etc.)

Esto asegura que cancelar una verificación no deje al DEA en un estado incorrecto.

**Ejemplos de flujo:**
```
pending → in_progress → (cancel) → pending
pre_verified → in_progress → (cancel) → pre_verified
verified → in_progress → (re-verificación cancelled) → verified
```

## Logs Agregados

Se agregaron logs informativos para rastrear las actualizaciones:

- `✅ DEA {id} actualizado a 'in_progress' (estado previo: '{previous}' guardado)` - Al iniciar verificación
- `✅ DEA {id} actualizado con data_verification_status: {status}` - Al completar verificación
- `✅ DEA {id} marcado como descartado: {reason}` - Al descartar verificación
- `✅ DEA {id} restaurado a estado previo: '{previous}'` - Al cancelar verificación
- `✅ DEA {id} marcado como inválido (markedAsInvalid)` - Al marcar como inválido en selección
- `✅ DEA {id} marcado como inválido (ninguna imagen válida)` - Al no tener imágenes válidas

## Pruebas Recomendadas

1. **Verificación exitosa:** Completar una verificación con imágenes válidas y verificar que el estado sea `'verified'`
2. **Verificación inválida:** Marcar una verificación como inválida y verificar que el estado sea `'invalid'`
3. **Descarte:** Descartar una verificación y verificar que el estado sea `'discarded'`
4. **Sin imágenes válidas:** Intentar completar sin imágenes válidas y verificar que el estado sea `'invalid'`

## Archivos Modificados

- `src/types/index.ts` - Agregado campo `dataVerificationStatus` al tipo DeaRecord
- `src/services/simpleVerificationService.ts`:
  - `startVerification()` - Guarda estado previo y actualiza a 'in_progress'
  - `completeVerification()` - Actualiza a 'verified' o 'invalid'
  - `discardVerification()` - Actualiza a 'discarded'
  - `cancelVerification()` - Restaura estado previo del DEA
- `src/app/api/verify/[id]/select-images/route.ts` - Actualiza a 'invalid' cuando se marcan imágenes como inválidas

## Impacto

- ✅ El campo `data_verification_status` ahora se actualiza correctamente en todos los flujos de verificación
- ✅ Se puede rastrear el estado de verificación de cada DEA
- ✅ Logs agregados para debugging y auditoría
- ✅ No hay cambios en la base de datos (el campo ya existía)
- ✅ Compatible con verificaciones existentes (campo es opcional)

## Fecha

21 de noviembre de 2025
