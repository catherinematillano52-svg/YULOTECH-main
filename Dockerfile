# One container for Render: Apache serves the built React app and the PHP API on one origin,
# and a small Node process (realtime/server.mjs) seals Neon Realtime queries behind /realtime.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Vite bakes this in at build time, so it must be set as a Render environment variable.
ARG VITE_NEON_REALTIME_URL
ENV VITE_NEON_REALTIME_URL=$VITE_NEON_REALTIME_URL
RUN npm run build

FROM php:8.2-apache
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && a2enmod proxy proxy_http \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /usr/local/bin/node /usr/local/bin/node
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY --from=build /app/dist/ /var/www/html/
COPY api/ /var/www/html/api/
COPY --from=build /app/node_modules /opt/app/node_modules
COPY package.json /opt/app/package.json
COPY realtime/server.mjs /opt/app/realtime/server.mjs
COPY docker/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh
WORKDIR /opt/app
CMD ["start.sh"]
