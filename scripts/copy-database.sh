#!/bin/bash

################################################################################
# Script: copy-database.sh
# Descripción: Copia base de datos PostgreSQL respetando relaciones entre tablas
# Uso: ./scripts/copy-database.sh [opciones]
################################################################################

set -e  # Salir si hay error

# ============================================================================
# CONFIGURACIÓN - MODIFICA ESTOS VALORES SEGÚN TU ENTORNO
# ============================================================================

# Base de datos de ORIGEN (Producción/Servidor remoto)
SOURCE_HOST="xxx"
SOURCE_PORT="xxx"
SOURCE_DB="xxx"
SOURCE_USER="xxx"
SOURCE_PASSWORD="xxx"

# Base de datos de DESTINO (Desarrollo local)
DEST_HOST="localhost"
DEST_PORT="5555"
DEST_DB="dea_madrid"
DEST_USER="root"
DEST_PASSWORD="toor"

# ============================================================================
# CONFIGURACIÓN AVANZADA
# ============================================================================

# Directorio para backups y logs
BACKUP_DIR="./backups"
LOG_DIR="./logs"
TEMP_DIR="./temp_db_copy"

# Timestamp para archivos
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Archivos temporales y logs
BACKUP_FILE="${BACKUP_DIR}/backup_dest_${DEST_DB}_${TIMESTAMP}.sql"
DUMP_FILE="${TEMP_DIR}/dump_source_${SOURCE_DB}_${TIMESTAMP}.sql"
LOG_FILE="${LOG_DIR}/db_copy_${TIMESTAMP}.log"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Opciones del script
SCHEMA_ONLY=false
DRY_RUN=false
SPECIFIC_TABLES=""

# ============================================================================
# FUNCIONES AUXILIARES
# ============================================================================

# Función para logging
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Función para mostrar mensajes de información
info() {
    echo -e "${BLUE}ℹ ${NC}$@"
    log "INFO" "$@"
}

# Función para mostrar mensajes de éxito
success() {
    echo -e "${GREEN}✓ ${NC}$@"
    log "SUCCESS" "$@"
}

# Función para mostrar mensajes de advertencia
warning() {
    echo -e "${YELLOW}⚠ ${NC}$@"
    log "WARNING" "$@"
}

# Función para mostrar mensajes de error
error() {
    echo -e "${RED}✗ ${NC}$@"
    log "ERROR" "$@"
}

# Función para mostrar el banner
show_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║         Script de Copia de Base de Datos PostgreSQL        ║"
    echo "║              Respetando Relaciones entre Tablas            ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

# Función para mostrar uso
show_usage() {
    cat << EOF
Uso: $0 [opciones]

Opciones:
  --schema-only       Copiar solo estructura (sin datos)
  --tables "t1,t2"    Copiar solo tablas específicas
  --dry-run           Simular sin ejecutar cambios
  -h, --help          Mostrar esta ayuda

Ejemplos:
  $0                                    # Copia completa
  $0 --schema-only                      # Solo estructura
  $0 --tables "dea_records,dea_codes"   # Solo tablas específicas
  $0 --dry-run                          # Simular operación

EOF
}

# Función para crear directorios necesarios
setup_directories() {
    info "Creando directorios necesarios..."
    mkdir -p "$BACKUP_DIR" "$LOG_DIR" "$TEMP_DIR"
    success "Directorios creados"
}

# Función para validar conexión a base de datos
validate_connection() {
    local host=$1
    local port=$2
    local db=$3
    local user=$4
    local password=$5
    local label=$6

    info "Validando conexión a ${label} (${host}:${port}/${db})..."
    
    if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -c "SELECT 1;" &> /dev/null; then
        success "Conexión exitosa a ${label}"
        return 0
    else
        error "No se pudo conectar a ${label}"
        return 1
    fi
}

# Función para obtener cuenta de registros
get_table_count() {
    local host=$1
    local port=$2
    local db=$3
    local user=$4
    local password=$5
    local table=$6

    local count=$(PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -t -c "SELECT COUNT(*) FROM ${table};" 2>/dev/null | xargs)
    echo "${count:-0}"
}

# Función para crear backup de destino
create_backup() {
    if [ "$DRY_RUN" = true ]; then
        info "[DRY-RUN] Se crearía backup en: ${BACKUP_FILE}"
        return 0
    fi

    info "Creando backup de base de datos destino..."
    
    if PGPASSWORD="$DEST_PASSWORD" pg_dump -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -F p -f "$BACKUP_FILE" 2>> "$LOG_FILE"; then
        success "Backup creado: ${BACKUP_FILE}"
        local size=$(du -h "$BACKUP_FILE" | cut -f1)
        info "Tamaño del backup: ${size}"
        return 0
    else
        error "Error al crear backup"
        return 1
    fi
}

# Función para exportar datos de origen
export_source_data() {
    if [ "$DRY_RUN" = true ]; then
        info "[DRY-RUN] Se exportarían datos desde ${SOURCE_HOST}:${SOURCE_PORT}/${SOURCE_DB}"
        return 0
    fi

    info "Exportando estructura y datos desde base de datos origen..."
    
    # Usar formato custom (-F c) para mejor rendimiento y manejo de memoria
    local dump_options="-h $SOURCE_HOST -p $SOURCE_PORT -U $SOURCE_USER -d $SOURCE_DB"
    dump_options="$dump_options -F c"
    dump_options="$dump_options --clean --if-exists"
    dump_options="$dump_options --no-owner --no-acl"
    
    if [ "$SCHEMA_ONLY" = true ]; then
        dump_options="$dump_options --schema-only"
        info "Modo: Solo estructura (sin datos)"
    else
        info "Modo: Estructura completa + datos"
    fi
    
    if [ -n "$SPECIFIC_TABLES" ]; then
        for table in ${SPECIFIC_TABLES//,/ }; do
            dump_options="$dump_options -t $table"
        done
        info "Tablas específicas: ${SPECIFIC_TABLES}"
    fi
    
    if PGPASSWORD="$SOURCE_PASSWORD" pg_dump $dump_options -f "$DUMP_FILE" 2>> "$LOG_FILE"; then
        success "Datos exportados: ${DUMP_FILE}"
        local size=$(du -h "$DUMP_FILE" | cut -f1)
        info "Tamaño del dump: ${size}"
        return 0
    else
        error "Error al exportar datos"
        return 1
    fi
}

# Función para limpiar tablas en orden correcto (respetando FK)
clean_destination_tables() {
    if [ "$DRY_RUN" = true ]; then
        info "[DRY-RUN] Se limpiarían tablas en base de datos destino"
        return 0
    fi

    info "Limpiando tablas en base de datos destino (orden inverso de dependencias)..."
    
    # Orden inverso para respetar foreign keys
    local tables=(
        "processed_images"
        "arrow_markers"
        "verification_sessions"
        "dea_address_validations"
        "dea_codes"
        "dea_records"
        "direcciones"
        "via_rangos_numeracion"
        "barrios"
        "vias"
        "distritos"
    )
    
    # Desactivar triggers temporalmente
    PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -c "SET session_replication_role = 'replica';" >> "$LOG_FILE" 2>&1
    
    for table in "${tables[@]}"; do
        info "  Limpiando tabla: ${table}"
        if PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -c "TRUNCATE TABLE ${table} CASCADE;" >> "$LOG_FILE" 2>&1; then
            success "    ✓ ${table} limpiada"
        else
            warning "    ⚠ No se pudo limpiar ${table} (puede no existir)"
        fi
    done
    
    # Reactivar triggers
    PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -c "SET session_replication_role = 'origin';" >> "$LOG_FILE" 2>&1
    
    success "Tablas limpiadas correctamente"
}

# Función para importar datos a destino
import_to_destination() {
    if [ "$DRY_RUN" = true ]; then
        info "[DRY-RUN] Se importarían datos a ${DEST_HOST}:${DEST_PORT}/${DEST_DB}"
        return 0
    fi

    info "Importando estructura y datos a base de datos destino..."
    info "Usando pg_restore para formato custom (más eficiente para archivos grandes)"
    
    # Usar pg_restore para formato custom
    # --clean: DROP objetos antes de recrear
    # --if-exists: No falla si el objeto no existe
    # --no-owner: No restaura ownership
    # --no-acl: No restaura permisos
    # -v: verbose para ver progreso
    local restore_options="-h $DEST_HOST -p $DEST_PORT -U $DEST_USER -d $DEST_DB"
    restore_options="$restore_options --clean --if-exists"
    restore_options="$restore_options --no-owner --no-acl"
    restore_options="$restore_options -v"
    
    if PGPASSWORD="$DEST_PASSWORD" pg_restore $restore_options "$DUMP_FILE" 2>&1 | tee -a "$LOG_FILE"; then
        success "Datos importados correctamente"
        return 0
    else
        local exit_code=$?
        if [ $exit_code -eq 0 ] || [ $exit_code -eq 1 ]; then
            # pg_restore devuelve 1 para warnings no críticos
            success "Datos importados (con algunos warnings, revisar log)"
            return 0
        else
            error "Error al importar datos"
            return 1
        fi
    fi
}

# Función para resetear secuencias
reset_sequences() {
    if [ "$DRY_RUN" = true ]; then
        info "[DRY-RUN] Se resetearían secuencias de IDs"
        return 0
    fi

    info "Reseteando secuencias de IDs..."
    
    PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" >> "$LOG_FILE" 2>&1 << 'EOF'
DO $$
DECLARE
    seq_record RECORD;
    max_id INTEGER;
BEGIN
    FOR seq_record IN 
        SELECT schemaname, sequencename, tablename, columnname
        FROM pg_sequences
        JOIN information_schema.columns ON 
            pg_sequences.sequencename = tablename || '_' || columnname || '_seq'
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) + 1 FROM %I.%I', 
                      seq_record.columnname, 
                      seq_record.schemaname, 
                      seq_record.tablename) 
        INTO max_id;
        
        EXECUTE format('ALTER SEQUENCE %I.%I RESTART WITH %s', 
                      seq_record.schemaname, 
                      seq_record.sequencename, 
                      max_id);
    END LOOP;
END $$;
EOF
    
    if [ $? -eq 0 ]; then
        success "Secuencias reseteadas"
        return 0
    else
        warning "Hubo problemas al resetear algunas secuencias"
        return 1
    fi
}

# Función para verificar integridad
verify_integrity() {
    info "Verificando integridad de datos..."
    
    local tables=(
        "distritos"
        "barrios"
        "vias"
        "via_rangos_numeracion"
        "direcciones"
        "dea_records"
        "dea_codes"
        "dea_address_validations"
        "verification_sessions"
        "arrow_markers"
        "processed_images"
    )
    
    echo ""
    echo "┌─────────────────────────────┬──────────┬──────────┐"
    echo "│ Tabla                       │ Origen   │ Destino  │"
    echo "├─────────────────────────────┼──────────┼──────────┤"
    
    local all_match=true
    
    for table in "${tables[@]}"; do
        local source_count=$(get_table_count "$SOURCE_HOST" "$SOURCE_PORT" "$SOURCE_DB" "$SOURCE_USER" "$SOURCE_PASSWORD" "$table")
        local dest_count=$(get_table_count "$DEST_HOST" "$DEST_PORT" "$DEST_DB" "$DEST_USER" "$DEST_PASSWORD" "$table")
        
        printf "│ %-27s │ %8s │ %8s │" "$table" "$source_count" "$dest_count"
        
        if [ "$source_count" = "$dest_count" ]; then
            echo " ✓"
        else
            echo " ✗"
            all_match=false
        fi
    done
    
    echo "└─────────────────────────────┴──────────┴──────────┘"
    echo ""
    
    if [ "$all_match" = true ]; then
        success "Verificación exitosa: Todos los conteos coinciden"
        return 0
    else
        warning "Algunos conteos no coinciden. Revisar logs para más detalles."
        return 1
    fi
}

# Función de limpieza
cleanup() {
    info "Limpiando archivos temporales..."
    rm -rf "$TEMP_DIR"
    success "Limpieza completada"
}

# Función para manejar errores
handle_error() {
    error "Se produjo un error durante la copia"
    error "Revisa el log: ${LOG_FILE}"
    
    if [ -f "$BACKUP_FILE" ] && [ "$DRY_RUN" = false ]; then
        warning "Puedes restaurar desde el backup: ${BACKUP_FILE}"
        warning "Comando: PGPASSWORD='${DEST_PASSWORD}' psql -h ${DEST_HOST} -p ${DEST_PORT} -U ${DEST_USER} -d ${DEST_DB} < ${BACKUP_FILE}"
    fi
    
    cleanup
    exit 1
}

# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================

main() {
    # Mostrar banner
    show_banner
    
    # Paso 1: Configurar directorios PRIMERO (antes de cualquier log)
    mkdir -p "$BACKUP_DIR" "$LOG_DIR" "$TEMP_DIR"
    
    # Configurar trap para errores
    trap handle_error ERR
    
    # Procesar argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --schema-only)
                SCHEMA_ONLY=true
                shift
                ;;
            --tables)
                SPECIFIC_TABLES="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                error "Opción desconocida: $1"
                show_usage
                exit 1
                ;;
        esac
    done
    
    # Mostrar configuración
    info "Configuración:"
    info "  Origen:  ${SOURCE_HOST}:${SOURCE_PORT}/${SOURCE_DB}"
    info "  Destino: ${DEST_HOST}:${DEST_PORT}/${DEST_DB}"
    if [ "$DRY_RUN" = true ]; then
        warning "  Modo: DRY-RUN (simulación, sin cambios reales)"
    fi
    echo ""
    
    # Confirmar que directorios están listos
    success "Directorios creados/verificados"
    # Paso 2: Validar conexiones
    validate_connection "$SOURCE_HOST" "$SOURCE_PORT" "$SOURCE_DB" "$SOURCE_USER" "$SOURCE_PASSWORD" "ORIGEN" || exit 1
    validate_connection "$DEST_HOST" "$DEST_PORT" "$DEST_DB" "$DEST_USER" "$DEST_PASSWORD" "DESTINO" || exit 1
    echo ""
    
    # Paso 3: Crear backup de destino
    create_backup || exit 1
    echo ""
    
    # Paso 4: Exportar datos de origen
    export_source_data || exit 1
    echo ""
    
    # Paso 5: Importar datos a destino (pg_restore hace DROP/CREATE automáticamente)
    import_to_destination || exit 1
    echo ""
    
    # Paso 6: Resetear secuencias
    reset_sequences
    echo ""
    
    # Paso 8: Verificar integridad
    verify_integrity
    echo ""
    
    # Paso 9: Limpieza
    cleanup
    
    # Resumen final
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║                   ✓ COPIA COMPLETADA                       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
    success "Copia de base de datos completada exitosamente"
    info "Log completo: ${LOG_FILE}"
    if [ -f "$BACKUP_FILE" ]; then
        info "Backup disponible: ${BACKUP_FILE}"
    fi
    echo ""
}

# ============================================================================
# EJECUTAR SCRIPT
# ============================================================================

main "$@"
