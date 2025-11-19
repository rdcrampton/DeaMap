# Script de Copia de Base de Datos PostgreSQL

Este documento explica cómo usar los scripts para copiar la base de datos entre servidores respetando todas las relaciones entre tablas.

## 📋 Contenido

- [Scripts Disponibles](#scripts-disponibles)
- [Requisitos](#requisitos)
- [Configuración](#configuración)
- [Uso Básico](#uso-básico)
- [Opciones Avanzadas](#opciones-avanzadas)
- [Verificación](#verificación)
- [Troubleshooting](#troubleshooting)

## 🔧 Scripts Disponibles

### 1. `copy-database.sh`
Script principal para copiar la base de datos de origen a destino respetando todas las relaciones entre tablas.

### 2. `verify-database-copy.sh`
Script de verificación para comprobar la integridad de la copia realizada.

## 📦 Requisitos

- PostgreSQL client (`psql` y `pg_dump`) instalados
- Acceso a las bases de datos origen y destino
- Permisos de lectura en origen y escritura en destino
- Espacio en disco suficiente para backups temporales

### Instalación de PostgreSQL Client (si no está instalado)

**Windows:**
```powershell
# Con Chocolatey
choco install postgresql

# O descargar desde: https://www.postgresql.org/download/windows/
```

**Linux/Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install postgresql-client
```

**macOS:**
```bash
brew install postgresql
```

## ⚙️ Configuración

### Paso 1: Configurar credenciales de conexión

Edita el archivo `scripts/copy-database.sh` y actualiza las siguientes variables:

```bash
# Base de datos de ORIGEN (Producción/Servidor remoto)
SOURCE_HOST="srv07.ingenierosweb.co"
SOURCE_PORT="5432"
SOURCE_DB="dea_madrid"
SOURCE_USER="postgres"
SOURCE_PASSWORD="tu_password_origen"

# Base de datos de DESTINO (Desarrollo local)
DEST_HOST="localhost"
DEST_PORT="5555"
DEST_DB="dea_madrid"
DEST_USER="root"
DEST_PASSWORD="toor"
```

### Paso 2: Actualizar también las credenciales en el script de verificación

Edita `scripts/verify-database-copy.sh` con las mismas credenciales.

### Paso 3: Dar permisos de ejecución

**Linux/macOS:**
```bash
chmod +x scripts/copy-database.sh
chmod +x scripts/verify-database-copy.sh
```

**Windows:**
Los scripts se pueden ejecutar directamente con `bash` o desde Git Bash.

## 🚀 Uso Básico

### Copia Completa

Copia estructura y todos los datos:

```bash
./scripts/copy-database.sh
```

Esto realizará:
1. ✅ Validación de conexiones
2. 💾 Backup automático de la BD destino
3. 📤 Exportación de datos desde origen
4. 🧹 Limpieza de tablas destino (respetando FK)
5. 📥 Importación de datos
6. 🔄 Reset de secuencias de IDs
7. ✔️ Verificación de integridad

### Simulación (Dry Run)

Para ver qué haría el script sin ejecutar cambios:

```bash
./scripts/copy-database.sh --dry-run
```

## 🎯 Opciones Avanzadas

### Copiar Solo Estructura (sin datos)

```bash
./scripts/copy-database.sh --schema-only
```

### Copiar Tablas Específicas

```bash
./scripts/copy-database.sh --tables "dea_records,dea_codes,verification_sessions"
```

### Mostrar Ayuda

```bash
./scripts/copy-database.sh --help
```

## ✅ Verificación

Después de realizar la copia, ejecuta el script de verificación:

```bash
./scripts/verify-database-copy.sh
```

Este script verificará:

1. **Conteos de tablas**: Compara el número de registros en cada tabla
2. **Foreign Keys**: Valida integridad referencial
3. **Secuencias**: Verifica que las secuencias de IDs estén correctas
4. **Índices**: Compara conteo de índices
5. **Constraints**: Valida constraints
6. **Datos de muestra**: Verifica registros específicos

### Ejemplo de salida exitosa:

```
╔════════════════════════════════════════════════════════════╗
║      Verificación de Integridad de Copia de Base de Datos ║
╚════════════════════════════════════════════════════════════╝

1. VERIFICACIÓN DE CONTEOS DE TABLAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────┬──────────┬──────────┬────────────┐
│ Tabla                       │ Origen   │ Destino  │ Estado     │
├─────────────────────────────┼──────────┼──────────┼────────────┤
│ distritos                   │       21 │       21 │ ✓ OK       │
│ barrios                     │      131 │      131 │ ✓ OK       │
│ dea_records                 │     1234 │     1234 │ ✓ OK       │
└─────────────────────────────┴──────────┴──────────┴────────────┘

╔════════════════════════════════════════════════════════════╗
║          ✓ VERIFICACIÓN EXITOSA                            ║
║                                                            ║
║  La copia de base de datos es íntegra y completa         ║
╚════════════════════════════════════════════════════════════╝
```

## 🔍 Estructura de Tablas y Orden

El script respeta el siguiente orden de dependencias:

### Nivel 1 - Sin dependencias
- `distritos`
- `vias`

### Nivel 2 - Dependen de Nivel 1
- `barrios` → `distritos`

### Nivel 3 - Relaciones geográficas
- `via_rangos_numeracion` → `vias`, `distritos`, `barrios`
- `direcciones` → `vias`, `distritos`, `barrios`

### Nivel 4 - Datos principales
- `dea_records`

### Nivel 5 - Datos de DEA
- `dea_codes` → `dea_records`
- `dea_address_validations` → `dea_records`
- `verification_sessions` → `dea_records`

### Nivel 6 - Datos de verificación
- `arrow_markers` → `verification_sessions`
- `processed_images` → `verification_sessions`

## 📂 Archivos Generados

### Backups
```
./backups/backup_dest_dea_madrid_YYYYMMDD_HHMMSS.sql
```
Backup automático de la BD destino antes de sobrescribir.

### Logs
```
./logs/db_copy_YYYYMMDD_HHMMSS.log
```
Log detallado de todas las operaciones realizadas.

### Temporales
```
./temp_db_copy/dump_source_dea_madrid_YYYYMMDD_HHMMSS.sql
```
Dump temporal de la BD origen (se elimina automáticamente al finalizar).

## 🐛 Troubleshooting

### Error: "No se pudo conectar a ORIGEN/DESTINO"

**Problema**: No hay conexión a la base de datos.

**Solución**:
1. Verifica que el host y puerto sean correctos
2. Comprueba que el usuario y contraseña sean válidos
3. Verifica conectividad de red:
   ```bash
   ping srv07.ingenierosweb.co
   telnet srv07.ingenierosweb.co 5432
   ```

### Error: "Permission denied"

**Problema**: El usuario no tiene permisos suficientes.

**Solución**:
1. Asegúrate de que el usuario tiene permisos de lectura en origen
2. Asegúrate de que el usuario tiene permisos de escritura en destino
3. Verifica permisos con:
   ```bash
   PGPASSWORD="password" psql -h host -p port -U user -d database -c "\du"
   ```

### Error: "Disk space full"

**Problema**: No hay espacio suficiente en disco.

**Solución**:
1. Libera espacio en disco
2. Limpia backups antiguos en `./backups/`
3. Verifica espacio disponible:
   ```bash
   df -h
   ```

### Error: "Foreign key violation"

**Problema**: Hay inconsistencias en los datos.

**Solución**:
1. El script desactiva temporalmente las FK durante la importación
2. Si persiste, verifica la integridad en origen:
   ```sql
   -- Conectarse a la BD origen y ejecutar:
   SELECT conname, conrelid::regclass 
   FROM pg_constraint 
   WHERE contype = 'f';
   ```

### Los conteos no coinciden en la verificación

**Problema**: Algunas tablas tienen diferentes cantidades de registros.

**Posibles causas**:
1. Datos insertados en origen durante la copia
2. Triggers que generaron datos adicionales
3. Error durante la importación

**Solución**:
1. Revisa el log: `./logs/db_copy_YYYYMMDD_HHMMSS.log`
2. Vuelve a ejecutar la copia
3. Si es necesario, restaura desde backup:
   ```bash
   PGPASSWORD='toor' psql -h localhost -p 5555 -U root -d dea_madrid < ./backups/backup_dest_dea_madrid_YYYYMMDD_HHMMSS.sql
   ```

## 🔐 Seguridad

### Buenas Prácticas

1. **No guardes contraseñas en el código**: Considera usar variables de entorno:
   ```bash
   export SOURCE_PASSWORD="tu_password"
   export DEST_PASSWORD="tu_password"
   ```

2. **Protege los scripts**:
   ```bash
   chmod 700 scripts/copy-database.sh
   chmod 700 scripts/verify-database-copy.sh
   ```

3. **Cifra los backups**:
   ```bash
   # Opcional: Cifrar backup
   gpg -c ./backups/backup_dest_dea_madrid_YYYYMMDD_HHMMSS.sql
   ```

4. **Limpia archivos temporales**:
   El script limpia automáticamente, pero verifica:
   ```bash
   rm -rf ./temp_db_copy/
   ```

## 📊 Logs y Monitoreo

### Ver logs en tiempo real

```bash
tail -f ./logs/db_copy_YYYYMMDD_HHMMSS.log
```

### Buscar errores en logs

```bash
grep ERROR ./logs/db_copy_YYYYMMDD_HHMMSS.log
```

### Ver resumen de operaciones

```bash
grep "SUCCESS\|ERROR\|WARNING" ./logs/db_copy_YYYYMMDD_HHMMSS.log
```

## 🔄 Automatización

### Cron Job (Linux/macOS)

Para ejecutar automáticamente cada noche a las 2 AM:

```bash
crontab -e
```

Añadir:
```
0 2 * * * /ruta/completa/scripts/copy-database.sh >> /ruta/logs/cron.log 2>&1
```

### Task Scheduler (Windows)

1. Abre "Programador de tareas"
2. Crear tarea básica
3. Trigger: Diario a las 2:00 AM
4. Acción: Ejecutar `bash /ruta/scripts/copy-database.sh`

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs en `./logs/`
2. Ejecuta en modo `--dry-run` para verificar configuración
3. Usa el script de verificación después de cada copia
4. Consulta este README para soluciones comunes

## 📝 Changelog

### v1.0.0 (2025-01-19)
- ✨ Script inicial de copia de base de datos
- ✨ Script de verificación de integridad
- ✨ Soporte para dry-run y opciones avanzadas
- ✨ Backup automático y recuperación
- ✨ Logs detallados
- ✨ Respeto de relaciones entre tablas

## 📄 Licencia

Uso interno del proyecto DEA_Analizer.
