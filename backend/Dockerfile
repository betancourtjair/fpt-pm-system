# Imagen de producción del backend — usada por Render (ver PID sección 4.3)
# Node 22+ (no 20): @supabase/supabase-js necesita WebSocket nativo para su
# módulo realtime, que Node 20 no trae — sin esto el proceso truena al
# arrancar con "Node.js detected but native WebSocket not found" en cuanto
# SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY están configuradas (ver
# archivos/archivos-storage.service.ts).
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/main"]
