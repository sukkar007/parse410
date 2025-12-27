FROM node:16-alpine

RUN apk add --no-cache git python3 make g++

WORKDIR /parse-server

COPY package.json ./

RUN npm install --legacy-peer-deps --ignore-scripts

COPY server.js ./
COPY cloud cloud
COPY bin bin
COPY public_html public_html
COPY views views

# 👇 الحل الحقيقي هنا
RUN mkdir -p files logs \
    && chown -R node:node /parse-server

ENV PORT=1337
ENV NODE_ENV=production
ENV HOST=0.0.0.0

USER node
EXPOSE 1337

CMD ["npm", "start"]
