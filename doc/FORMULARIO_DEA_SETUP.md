# Configuración del Formulario de Registro DEA

Este documento explica cómo configurar y usar el nuevo formulario de registro de DEAs con subida de imágenes a Amazon S3.

## Características Implementadas

### ✅ Formulario Completo
- **Todos los campos del formulario original** de Microsoft Forms
- **Campos adicionales implementados:**
  - `foto1`: Subida de imagen a S3
  - `foto2`: Subida de imagen a S3  
  - `descripcionAcceso`: Textarea para instrucciones de acceso
  - `comentarioLibre`: Textarea para observaciones adicionales

### ✅ Funcionalidades
- **Subida de imágenes** a Amazon S3 con previsualización
- **Validación de archivos** (tipos permitidos: JPG, PNG, WebP, máximo 5MB)
- **Formulario responsive** adaptado a móviles
- **Validación de campos obligatorios**
- **Separación de modales**: uno para visualización, otro para creación/edición

## Configuración de Amazon S3

### 1. Crear Bucket S3
```bash
# Crear bucket (reemplaza 'your-bucket-name' con tu nombre de bucket)
aws s3 mb s3://your-bucket-name --region eu-west-1
```

### 2. Configurar Políticas del Bucket

**Política de Bucket (para acceso público de lectura):**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

**Configuración CORS:**
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": []
    }
]
```

### 3. Variables de Entorno

Añadir al archivo `.env.local`:
```env
AWS_ACCESS_KEY_ID=tu_access_key_id
AWS_SECRET_ACCESS_KEY=tu_secret_access_key
AWS_REGION=eu-west-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

### 4. Permisos IAM

Crear usuario IAM con la siguiente política:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

## Estructura de Archivos Creados

```
src/
├── components/
│   ├── DeaFormModal.tsx          # Formulario completo de registro/edición
│   └── ImageUpload.tsx           # Componente de subida de imágenes
├── hooks/
│   └── useImageUpload.ts         # Hook para manejar subida de imágenes
├── services/
│   └── s3Service.ts              # Servicio para interactuar con S3
└── app/api/
    └── upload/
        └── route.ts              # API endpoint para subir imágenes
```

## Uso del Formulario

### 1. Crear Nuevo DEA
- Hacer clic en "Añadir nuevo DEA"
- Completar todos los campos obligatorios (marcados con *)
- Subir imágenes (opcional)
- Guardar

### 2. Editar DEA Existente
- Hacer clic en "Editar" en cualquier tarjeta de DEA
- Modificar los campos necesarios
- Las imágenes existentes se mantienen si no se cambian
- Guardar cambios

### 3. Visualizar DEA
- Hacer clic en "Ver" en cualquier tarjeta de DEA
- Se muestra toda la información incluyendo imágenes
- Modal de solo lectura

## Campos del Formulario

### Información Básica
- **Correo Electrónico** (obligatorio)
- **Nombre** (obligatorio)
- **Número provisional DEA** (opcional)

### Establecimiento
- **Tipo de establecimiento** (obligatorio)
- **Titularidad del local** (Pública/Privada)
- **Uso del local** (Público/Privado)
- **Titularidad** (obligatorio)
- **Propuesta de denominación** (obligatorio)

### Dirección
- **Tipo de vía** (obligatorio)
- **Nombre de la vía** (obligatorio)
- **Número de la vía** (obligatorio)
- **Complemento de dirección** (opcional)
- **Código postal** (28001-28055)
- **Distrito** (obligatorio)
- **Coordenadas** (latitud/longitud)

### Horarios
- **Horario de apertura** (24h o NO 24h)
- **Horarios específicos** (si no es 24h)

### Fotografías (NUEVOS)
- **Foto 1** (opcional) - Subida a S3
- **Foto 2** (opcional) - Subida a S3

### Información Adicional (NUEVOS)
- **Descripción de acceso** (opcional)
- **Comentario libre** (opcional)

## Validaciones Implementadas

### Imágenes
- Tipos permitidos: JPG, PNG, WebP
- Tamaño máximo: 5MB por imagen
- Previsualización antes de subir

### Campos de Texto
- Validación de email
- Rangos numéricos para coordenadas y códigos postales
- Campos obligatorios marcados con *

## Almacenamiento en S3

### Estructura de Archivos
```
bucket-name/
└── original/
    ├── dea-foto1-uuid.jpg
    ├── dea-foto2-uuid.jpg
    └── ...
```

### Nomenclatura
- Prefijo: `dea-foto1` o `dea-foto2`
- UUID único para evitar colisiones
- Extensión original del archivo

## Troubleshooting

### Error de Subida S3
1. Verificar variables de entorno
2. Comprobar permisos IAM
3. Verificar configuración CORS del bucket

### Imágenes No Se Muestran
1. Verificar que el bucket tenga acceso público de lectura
2. Comprobar que las URLs se guarden correctamente en la BD

### Formulario No Se Envía
1. Verificar que todos los campos obligatorios estén completos
2. Comprobar la consola del navegador para errores

## Próximos Pasos

- [ ] Implementar redimensionado automático de imágenes
- [ ] Añadir soporte para más tipos de archivo
- [ ] Implementar eliminación de imágenes de S3 al borrar registros
- [ ] Añadir compresión de imágenes antes de subir
