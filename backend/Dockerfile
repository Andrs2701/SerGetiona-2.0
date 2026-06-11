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

# Crear .env desde el ejemplo (los valores reales vienen de las env vars de Render)
RUN cp .env.example .env

# Crear archivo SQLite vacío
RUN touch database/database.sqlite

# Permisos de escritura para storage y cache
RUN chmod -R 775 storage bootstrap/cache

# Exponer puerto (Render lo asigna en $PORT)
EXPOSE 10000

# Inicio: migrar → seed → servir. APP_KEY debe venir del entorno.
CMD sh -c "php artisan migrate --force && \
           php artisan app:seed-if-empty && \
           php artisan serve --host=0.0.0.0 --port=${PORT:-10000}"
