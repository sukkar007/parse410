# Build stage
FROM node:16-alpine as build

RUN apk add --no-cache git
WORKDIR /tmp
COPY package*.json ./
COPY postinstall.js ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Release stage
FROM node:16-alpine as release

RUN apk add --no-cache git

VOLUME /parse-server/cloud /parse-server/config
WORKDIR /parse-server

COPY package*.json ./
COPY postinstall.js ./
RUN npm ci --production --ignore-scripts

COPY bin bin
COPY public_html public_html
COPY views views
COPY cloud cloud
COPY --from=build /tmp/lib lib

RUN mkdir -p logs && chown -R node: logs

ENV PORT=1337
ENV NODE_ENV=production
ENV HOST=0.0.0.0
USER node
EXPOSE 1337

CMD ["npm", "start"]
