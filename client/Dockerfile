FROM node:22-alpine AS build

WORKDIR /app

# Copy shared constants first (referenced by vite alias)
COPY shared /app/shared

# Copy client source
COPY client/package.json client/package-lock.json* ./client/
WORKDIR /app/client
RUN npm ci

COPY client/ .

# Build (vite resolves @shared to ../shared)
RUN npm run build

# --- Production image ---
FROM nginx:alpine

COPY --from=build /app/client/dist /usr/share/nginx/html
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
