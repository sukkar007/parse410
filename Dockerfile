# =========================
# Build stage
# =========================
FROM node:20-alpine AS build

RUN apk update && apk add git
WORKDIR /tmp

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# =========================
# Release stage
# =========================
FROM node:20-alpine

RUN apk update && apk add git
WORKDIR /parse-server

# Volumes (اختياري)
VOLUME /parse-server/cloud /parse-server/config

# Dependencies production فقط
COPY package*.json ./
RUN npm ci --production --ignore-scripts

# نسخ الملفات المطلوبة
COPY bin bin
COPY public_html public_html
COPY views views
COPY cloud cloud
COPY --from=build /tmp/lib lib
COPY server.js server.js

# Logs
RUN mkdir -p logs && chown -R node: logs

ENV PORT=1337
USER node
EXPOSE 1337

CMD ["node", "server.js"]
