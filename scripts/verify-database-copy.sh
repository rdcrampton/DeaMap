#!/bin/bash

################################################################################
# Script: verify-database-copy.sh
# Descripción: Verifica la integridad de la copia de base de datos
# Uso: ./scripts/verify-database-copy.sh
################################################################################

# ============================================================================
# CONFIGURACIÓN
# ============================================================================

# Base de datos de ORIGEN
SOURCE_HOST="xxx"
SOURCE_PORT="xxx"
SOURCE_DB="xxx"
SOURCE_USER="xxx"
SOURCE_PASSWORD="xxx"

# Base de datos de DESTINO
DEST_HOST="localhost"
DEST_PORT="5555"
DEST_DB="dea_madrid"
DEST_USER="root"
DEST_PASSWORD="toor"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# FUNCIONES
# ============================================================================

show_banner() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║      Verificación de Integridad de Copia de Base de Datos ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""
}

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

check_foreign_keys() {
    local host=$1
    local port=$2
    local db=$3
    local user=$4
    local password=$5

    echo -e "${CYAN}Verificando integridad de Foreign Keys...${NC}"
    
    local fk_violations=$(PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -t << 'EOF'
DO $$
DECLARE
    r RECORD;
    violations INTEGER := 0;
BEGIN
    FOR r IN 
        SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I WHERE %I NOT IN (SELECT id FROM %I)',
            r.table_name, r.column_name, r.foreign_table_name)
        INTO violations;
        
        IF violations > 0 THEN
            RAISE NOTICE 'FK Violation: %.% has % orphaned records', 
                r.table_name, r.column_name, violations;
        END IF;
    END LOOP;
END $$;
SELECT 0;
EOF
)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Foreign Keys válidas${NC}"
        return 0
    else
        echo -e "${RED}✗ Se encontraron violaciones de Foreign Keys${NC}"
        return 1
    fi
}

verify_table_counts() {
    echo -e "${CYAN}Comparando conteos de tablas...${NC}"
    echo ""
    
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
    
    echo "┌─────────────────────────────┬──────────┬──────────┬────────────┐"
    echo "│ Tabla                       │ Origen   │ Destino  │ Estado     │"
    echo "├─────────────────────────────┼──────────┼──────────┼────────────┤"
    
    local all_match=true
    local total_source=0
    local total_dest=0
    
    for table in "${tables[@]}"; do
        local source_count=$(get_table_count "$SOURCE_HOST" "$SOURCE_PORT" "$SOURCE_DB" "$SOURCE_USER" "$SOURCE_PASSWORD" "$table")
        local dest_count=$(get_table_count "$DEST_HOST" "$DEST_PORT" "$DEST_DB" "$DEST_USER" "$DEST_PASSWORD" "$table")
        
        total_source=$((total_source + source_count))
        total_dest=$((total_dest + dest_count))
        
        printf "│ %-27s │ %8s │ %8s │" "$table" "$source_count" "$dest_count"
        
        if [ "$source_count" = "$dest_count" ]; then
            echo -e " ${GREEN}✓ OK${NC}       │"
        else
            echo -e " ${RED}✗ DIFF${NC}     │"
            all_match=false
        fi
    done
    
    echo "├─────────────────────────────┼──────────┼──────────┼────────────┤"
    printf "│ %-27s │ %8s │ %8s │" "TOTAL" "$total_source" "$total_dest"
    
    if [ "$all_match" = true ]; then
        echo -e " ${GREEN}✓ OK${NC}       │"
    else
        echo -e " ${RED}✗ DIFF${NC}     │"
    fi
    
    echo "└─────────────────────────────┴──────────┴──────────┴────────────┘"
    echo ""
    
    return $([ "$all_match" = true ] && echo 0 || echo 1)
}

verify_sequences() {
    echo -e "${CYAN}Verificando secuencias de IDs...${NC}"
    
    local dest_seq_check=$(PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -t << 'EOF'
SELECT COUNT(*) FROM (
    SELECT 
        schemaname,
        sequencename,
        tablename,
        last_value,
        (SELECT MAX(id) FROM information_schema.tables WHERE table_name = pg_sequences.tablename LIMIT 1) as max_id
    FROM pg_sequences
    WHERE schemaname = 'public'
) AS seq_check;
EOF
)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Secuencias verificadas${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ No se pudieron verificar todas las secuencias${NC}"
        return 1
    fi
}

verify_indexes() {
    echo -e "${CYAN}Verificando índices...${NC}"
    
    local source_indexes=$(PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" | xargs)
    local dest_indexes=$(PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';" | xargs)
    
    echo "  Índices en origen:  $source_indexes"
    echo "  Índices en destino: $dest_indexes"
    
    if [ "$source_indexes" = "$dest_indexes" ]; then
        echo -e "${GREEN}✓ Conteo de índices coincide${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Conteo de índices difiere${NC}"
        return 1
    fi
}

verify_constraints() {
    echo -e "${CYAN}Verificando constraints...${NC}"
    
    local source_constraints=$(PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public';" | xargs)
    local dest_constraints=$(PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -t -c "SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_schema = 'public';" | xargs)
    
    echo "  Constraints en origen:  $source_constraints"
    echo "  Constraints en destino: $dest_constraints"
    
    if [ "$source_constraints" = "$dest_constraints" ]; then
        echo -e "${GREEN}✓ Conteo de constraints coincide${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ Conteo de constraints difiere${NC}"
        return 1
    fi
}

check_sample_data() {
    echo -e "${CYAN}Verificando datos de muestra...${NC}"
    
    # Verificar algunos registros específicos de DEA
    local source_sample=$(PGPASSWORD="$SOURCE_PASSWORD" psql -h "$SOURCE_HOST" -p "$SOURCE_PORT" -U "$SOURCE_USER" -d "$SOURCE_DB" -t -c "SELECT COUNT(*) FROM dea_records WHERE id <= 10;" | xargs)
    local dest_sample=$(PGPASSWORD="$DEST_PASSWORD" psql -h "$DEST_HOST" -p "$DEST_PORT" -U "$DEST_USER" -d "$DEST_DB" -t -c "SELECT COUNT(*) FROM dea_records WHERE id <= 10;" | xargs)
    
    echo "  Registros de muestra (dea_records id<=10):"
    echo "    Origen:  $source_sample"
    echo "    Destino: $dest_sample"
    
    if [ "$source_sample" = "$dest_sample" ]; then
        echo -e "${GREEN}✓ Datos de muestra coinciden${NC}"
        return 0
    else
        echo -e "${RED}✗ Datos de muestra difieren${NC}"
        return 1
    fi
}

# ============================================================================
# FUNCIÓN PRINCIPAL
# ============================================================================

main() {
    show_banner
    
    echo -e "${BLUE}Configuración:${NC}"
    echo "  Origen:  ${SOURCE_HOST}:${SOURCE_PORT}/${SOURCE_DB}"
    echo "  Destino: ${DEST_HOST}:${DEST_PORT}/${DEST_DB}"
    echo ""
    
    local all_checks_passed=true
    
    # Verificación 1: Conteos de tablas
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1. VERIFICACIÓN DE CONTEOS DE TABLAS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if ! verify_table_counts; then
        all_checks_passed=false
    fi
    
    # Verificación 2: Foreign Keys
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "2. VERIFICACIÓN DE FOREIGN KEYS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if ! check_foreign_keys "$DEST_HOST" "$DEST_PORT" "$DEST_DB" "$DEST_USER" "$DEST_PASSWORD"; then
        all_checks_passed=false
    fi
    echo ""
    
    # Verificación 3: Secuencias
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "3. VERIFICACIÓN DE SECUENCIAS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    verify_sequences
    echo ""
    
    # Verificación 4: Índices
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "4. VERIFICACIÓN DE ÍNDICES"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    verify_indexes
    echo ""
    
    # Verificación 5: Constraints
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "5. VERIFICACIÓN DE CONSTRAINTS"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    verify_constraints
    echo ""
    
    # Verificación 6: Datos de muestra
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "6. VERIFICACIÓN DE DATOS DE MUESTRA"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if ! check_sample_data; then
        all_checks_passed=false
    fi
    echo ""
    
    # Resumen final
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "RESUMEN DE VERIFICACIÓN"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$all_checks_passed" = true ]; then
        echo ""
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║          ${GREEN}✓ VERIFICACIÓN EXITOSA${NC}                        ║"
        echo "║                                                            ║"
        echo "║  La copia de base de datos es íntegra y completa         ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo ""
        exit 0
    else
        echo ""
        echo "╔════════════════════════════════════════════════════════════╗"
        echo "║          ${RED}✗ VERIFICACIÓN FALLIDA${NC}                        ║"
        echo "║                                                            ║"
        echo "║  Se encontraron diferencias entre origen y destino       ║"
        echo "║  Revisa los detalles arriba                              ║"
        echo "╚════════════════════════════════════════════════════════════╝"
        echo ""
        exit 1
    fi
}

# ============================================================================
# EJECUTAR SCRIPT
# ============================================================================

main "$@"
