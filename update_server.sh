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

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/var/www/html/sergestiona"
BACKEND_DIR="$APP_DIR/backend"
FRONTEND_DIR="$APP_DIR/frontend"
DB_FILE="$BACKEND_DIR/database/database.sqlite"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}   SERGESTIONA 2.0 - ACTUALIZACIÓN SEGURA          ${NC}"
echo -e "${BLUE}   $(date '+%d/%m/%Y %H:%M:%S')                    ${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# ─────────────────────────────────────────────
# PASO 0: Backup automático de la base de datos
# ─────────────────────────────────────────────
echo -e "${BLUE}[0/4] Realizando backup de la base de datos...${NC}"
mkdir -p "$BACKUP_DIR"
if [ -f "$DB_FILE" ]; then
    cp "$DB_FILE" "$BACKUP_DIR/database_$TIMESTAMP.sqlite"
    echo -e "  ${GREEN}✓ Backup guardado: $BACKUP_DIR/database_$TIMESTAMP.sqlite${NC}"
else
    echo -e "  ${YELLOW}⚠ No se encontró base de datos en $DB_FILE (primera instalación)${NC}"
fi
# Conservar solo los últimos 10 backups
ls -t "$BACKUP_DIR"/database_*.sqlite 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null || true
echo ""

# ─────────────────────────────────────────────
# PASO 1: Actualizar Backend (Laravel)
# ─────────────────────────────────────────────
echo -e "${BLUE}[1/4] Actualizando Backend (Laravel)...${NC}"
cd "$BACKEND_DIR"

# Instalar/actualizar dependencias PHP (sin dev, optimizado)
echo -e "  Instalando dependencias Composer..."
sudo composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -3

# Ejecutar SOLO migraciones nuevas (NO migrate:fresh — no borra datos)
echo -e "  Aplicando migraciones nuevas..."
php artisan migrate --force
echo -e "  ${GREEN}✓ Migraciones aplicadas (datos conservados)${NC}"

# Limpiar y regenerar caché de producción
echo -e "  Regenerando caché de Laravel..."
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
echo -e "  ${GREEN}✓ Caché regenerada${NC}"

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
echo -e "  Backup BD en:       $BACKUP_DIR/database_$TIMESTAMP.sqlite"
echo ""
echo -e "  Estado PM2:"
pm2 list 2>/dev/null | grep sergestiona || echo "  Verificar con: pm2 list"
echo ""
echo -e "  Estado Nginx:   $(sudo systemctl is-active nginx)"
echo ""
echo -e "${YELLOW}  TIP: Si algo falló, restaura el backup con:${NC}"
echo -e "${YELLOW}  cp $BACKUP_DIR/database_$TIMESTAMP.sqlite $DB_FILE${NC}"
echo ""
