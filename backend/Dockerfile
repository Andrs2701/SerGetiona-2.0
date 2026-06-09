FROM php:8.2-cli

WORKDIR /app

# Dependencias del sistema — libsqlite3-dev es requerida para pdo_sqlite
RUN apt-get update && apt-get install -y \
    zip unzip git curl libzip-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_sqlite zip \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Copiar código fuente
COPY . .

# Instalar dependencias PHP (sin dev)
RUN composer install --no-dev --optimize-autoloader --no-interaction

# Crear archivo SQLite vacío (el .gitignore lo excluye del repo)
RUN touch database/database.sqlite

# Permisos de escritura para storage y cache
RUN chmod -R 775 storage bootstrap/cache

# Exponer puerto (Render lo asigna en $PORT)
EXPOSE 10000

# Script de inicio: migrar + seed + servir
CMD sh -c "php artisan key:generate --force && \
           php artisan migrate --force && \
           php artisan db:seed --force && \
           php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"
