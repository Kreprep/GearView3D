# Web image: builds the Vite bundle, then serves it with nginx.
#
# nginx does two jobs here - serve the static build, and proxy /api to the
# backend container. That is what replaces the Vite dev server's proxy (see
# vite.config.js), which only exists in development. It also means your reverse
# proxy on Proxmox has a single upstream to point at instead of two.
#
# Build from the REPO ROOT so the context matches the backend image:
#
#   docker build -f frontend/Dockerfile .
FROM node:22-slim AS build

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
