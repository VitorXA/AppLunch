# Etapa 1: compila o frontend
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: imagem final — o servidor não tem dependências npm, só Node + os arquivos abaixo
FROM node:22-alpine
ENV NODE_ENV=production \
    DATABASE_PATH=/data/applunch.db \
    STATIC_DIR=/app/dist
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY --from=build /app/dist ./dist
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "server/index.js"]
