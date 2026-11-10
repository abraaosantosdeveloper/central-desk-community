# Build do front (Vite) e servidor nginx que entrega os arquivos e repassa /api ao back-end.

FROM node:24-slim AS build
WORKDIR /app
COPY package*.json .npmrc ./
# Com package-lock.json (gere com "npm install" e versione): npm ci; sem ele: npm install
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY . .
# As VITE_* (nome da empresa e do setor de atendimento) entram no build: no Railway, declare-as no serviço
ARG VITE_COMPANY_NAME
ARG VITE_SUPPORT_TEAM_NAME
RUN npm run build-only

FROM nginx:1.27-alpine
# A imagem oficial do nginx troca as variáveis do template na subida do container.
# O filtro limita a troca a estas duas, para não mexer nas variáveis do próprio nginx ($uri, $host...).
ENV NGINX_ENVSUBST_FILTER="^(PORT|API_UPSTREAM)$" \
    PORT=8080 \
    API_UPSTREAM=http://localhost:8080
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
