FROM node:16-alpine

RUN apk add --no-cache git python3 make g++

VOLUME /parse-server/cloud /parse-server/config
WORKDIR /parse-server

# نسخ ملفات الـ package أولاً
COPY package*.json ./
COPY postinstall.js ./

# تثبيت جميع المتطلبات (بما في ذلك devDependencies للبناء)
RUN npm ci

# نسخ مجلد src للبناء
COPY src src

# بناء lib/ من src/ باستخدام Babel
RUN npm run build

# نسخ باقي الملفات
COPY server.js ./
COPY cloud cloud
COPY bin bin
COPY public_html public_html
COPY views views

# إضافة parse-dashboard كـ dependency
RUN npm install parse-dashboard --save

RUN mkdir -p logs && chown -R node: logs

ENV PORT=1337
ENV NODE_ENV=production
ENV HOST=0.0.0.0
USER node
EXPOSE 1337

CMD ["npm", "start"]
