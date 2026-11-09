# API de FitZone Sports (NestJS). Imagen en dos etapas: compila con todas las
# dependencias y ejecuta solo con las de producción.
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY db ./db
COPY docker-entrypoint.sh ./
# Quita CR por si el archivo se clonó en Windows con fin de línea CRLF.
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh && mkdir -p /app/archivos && chown -R node:node /app/archivos
USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
