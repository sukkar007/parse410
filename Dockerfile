# =========================
# Build stage
# =========================
FROM node:20-alpine AS build

RUN apk update && apk add git
WORKDIR /tmp

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build


# =========================
# Runtime stage
# =========================
FROM node:20-alpine

RUN apk update && apk add git
WORKDIR /parse-server

VOLUME /parse-server/cloud /parse-server/config

COPY package*.json ./
RUN npm ci --production --ignore-scripts

COPY bin bin
COPY public_html public_html
COPY views views
COPY cloud cloud
COPY --from=build /tmp/lib lib

RUN mkdir -p logs && chown -R node: logs

ENV PORT=1337
USER node
EXPOSE 1337

CMD ["node", "bin/parse-server"]
