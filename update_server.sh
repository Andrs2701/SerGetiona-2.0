#!/bin/bash
# ============================================================
#  Sergestiona 2.0 - Script de Actualización Segura
#  Diseñado por Antigravity
#  Uso: bash update_server.sh
#
#  ESTE SCRIPT ES SEGURO PARA PRODUCCIÓN:
#  - NO borra la base de datos
#  - NO re-seedea datos
#  - Solo aplica migraciones NUEVAS (incrementales)
#  - Hace backup automático de la BD antes de migrar
# ============================================================

set -e
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/var/www/html/sergestiona"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/mysql_$TIMESTAMP.sql"

# Credenciales de MySQL leídas del .env real (nunca hardcodeadas en el script)
ENV_FILE="$BACKEND_DIR/.env"
DB_DATABASE=$(grep -E '^DB_DATABASE=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)
DB_USERNAME=$(grep -E '^DB_USERNAME=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)
DB_PASSWORD=$(grep -E '^DB_PASSWORD=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)
DB_HOST=$(grep -E '^DB_HOST=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)
DB_PORT=$(grep -E '^DB_PORT=' "$ENV_FILE" | tail -1 | cut -d '=' -f2-)
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   SERGESTIONA 2.0 - ACTUALIZACIÓN SEGURA          ${NC}"
echo -e "${BLUE}   $(date '+%d/%m/%Y %H:%M:%S')                    ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# ─────────────────────────────────────────────
# PASO 0: Backup automático de la base de datos (MySQL real, no sqlite)
# ─────────────────────────────────────────────
echo -e "${BLUE}[0/4] Realizando backup de la base de datos MySQL...${NC}"
mkdir -p "$BACKUP_DIR"

if [ -z "$DB_DATABASE" ]; then
    echo -e "  ${RED}✗ No se pudo leer DB_DATABASE de $ENV_FILE. Abortando por seguridad.${NC}"
    exit 1
fi

MYSQL_PWD="$DB_PASSWORD" mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" \
    --single-transaction --routines --triggers "$DB_DATABASE" > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
    echo -e "  ${GREEN}✓ Backup guardado: $BACKUP_FILE${NC}"
else
    echo -e "  ${RED}✗ El backup de MySQL falló o quedó vacío. Abortando actualización sin tocar nada.${NC}"
    rm -f "$BACKUP_FILE"
    exit 1
fi
# Conservar solo los últimos 10 backups
ls -t "$BACKUP_DIR"/mysql_*.sql 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
echo ""

# ─────────────────────────────────────────────
# PASO 1: Actualizar Backend (Laravel)
# ─────────────────────────────────────────────
echo -e "${BLUE}[1/4] Actualizando Backend (Laravel)...${NC}"
cd "$BACKEND_DIR"

# Instalar/actualizar dependencias PHP (sin dev, optimizado)
# Sin sudo: el usuario que corre este script ya es dueño de vendor/, y el
# secure_path por defecto de sudo en RHEL no incluye /usr/local/bin (donde
# vive composer), lo que hacía fallar "sudo composer" con "command not found".
echo -e "  Instalando dependencias Composer..."
composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -3

# Limpiar caché de config ANTES de migrar: si quedó una config cacheada
# desactualizada (p.ej. una ruta de base de datos vieja), migrate la usaría
# en vez de leer el .env real y fallaría de forma confusa.
echo -e "  Limpiando caché de configuración..."
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Ejecutar SOLO migraciones nuevas (NO migrate:fresh — no borra datos)
echo -e "  Aplicando migraciones nuevas..."
php artisan migrate --force
echo -e "  ${GREEN}✓ Migraciones aplicadas (datos conservados)${NC}"

# Enlace simbólico de almacenamiento público (fotos de perfil, etc.)
# El comando es seguro de repetir: si el enlace ya existe, no hace nada.
echo -e "  Verificando enlace de storage público..."
php artisan storage:link
echo -e "  ${GREEN}✓ Storage público enlazado${NC}"

# Limpiar caché de producción para ejecución dinámica y estable
echo -e "  Limpiando y preparando caché de Laravel..."
php artisan config:clear
php artisan route:clear
php artisan view:clear
rm -f bootstrap/cache/config.php bootstrap/cache/routes-v7.php 2>/dev/null || true
echo -e "  ${GREEN}✓ Caché limpia y dinámica asegurada${NC}"

# Ajustar permisos para asegurar que el servidor web/PHP-FPM pueda escribir
echo -e "  Ajustando permisos de directorios..."
sudo chown -R moodle:apache "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache" "$BACKEND_DIR/database" 2>/dev/null || true
sudo chmod -R 775 "$BACKEND_DIR/storage" "$BACKEND_DIR/bootstrap/cache" "$BACKEND_DIR/database" 2>/dev/null || true
echo -e "  ${GREEN}✓ Permisos de escritura asegurados${NC}"

# Reiniciar PHP-FPM para limpiar OPcache
sudo systemctl reload php-fpm 2>/dev/null || sudo systemctl restart php-fpm 2>/dev/null || true
echo -e "${GREEN}Backend actualizado correctamente.${NC}\n"

# ─────────────────────────────────────────────
# PASO 2: Actualizar Frontend (Next.js)
# ─────────────────────────────────────────────
echo -e "${BLUE}[2/4] Actualizando Frontend (Next.js)...${NC}"
cd "$FRONTEND_DIR"

# Instalar dependencias nuevas si las hay
echo -e "  Instalando dependencias npm..."
npm install --production=false 2>&1 | tail -3

# Compilar para producción
echo -e "  Compilando Next.js (puede tardar 1-2 minutos)..."
npm run build
echo -e "${GREEN}Frontend compilado correctamente.${NC}\n"

# ─────────────────────────────────────────────
# PASO 3: Reiniciar Frontend con PM2
# ─────────────────────────────────────────────
echo -e "${BLUE}[3/4] Reiniciando Frontend con PM2...${NC}"
pm2 restart sergestiona-frontend 2>/dev/null || {
    echo -e "  ${YELLOW}Proceso no encontrado, iniciando nuevo...${NC}"
    pm2 start npm --name "sergestiona-frontend" -- start -- -p 3000
}
pm2 save
echo -e "${GREEN}Frontend reiniciado.${NC}\n"

# ─────────────────────────────────────────────
# PASO 4: Recargar Nginx (config sin reiniciar)
# ─────────────────────────────────────────────
echo -e "${BLUE}[4/4] Recargando Nginx...${NC}"
sudo nginx -t && sudo systemctl reload nginx
echo -e "${GREEN}Nginx recargado.${NC}\n"

# ─────────────────────────────────────────────
# RESUMEN
# ─────────────────────────────────────────────
DOMAIN="virtualidad.usergioarboleda.edu.co"
echo -e "${BLUE}====================================================${NC}"
echo -e "${GREEN}   ACTUALIZACIÓN COMPLETADA EXITOSAMENTE            ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""
echo -e "  App disponible en:  http://$DOMAIN/sergestiona"
echo -e "  API disponible en:  http://$DOMAIN/api"
echo -e "  Backup BD en:       $BACKUP_FILE"
echo ""
echo -e "  Estado PM2:"
pm2 list 2>/dev/null | grep sergestiona || echo "  Verificar con: pm2 list"
echo ""
echo -e "  Estado Nginx:   $(sudo systemctl is-active nginx)"
echo ""
echo -e "${YELLOW}  TIP: Si algo falló, restaura el backup con:${NC}"
echo -e "${YELLOW}  MYSQL_PWD='...' mysql -h $DB_HOST -P $DB_PORT -u $DB_USERNAME $DB_DATABASE < $BACKUP_FILE${NC}"
echo ""
