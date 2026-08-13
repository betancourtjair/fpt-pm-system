# Solo para desarrollo local vía docker compose (levanta el servidor de Vite).
# En producción, Netlify construye y sirve el sitio estático — no usa esta imagen.
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]
