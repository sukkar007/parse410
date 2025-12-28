FROM node:16-alpine

# تثبيت الأدوات اللازمة
RUN apk add --no-cache git python3 make g++

WORKDIR /parse-server

# نسخ package.json فقط أولاً لتسريع build
COPY package.json ./

# ✅ تثبيت الحزم بدون optional dependencies (حل مشكلة B2)
RUN npm install --legacy-peer-deps --ignore-scripts --no-optional

# نسخ باقي الملفات
COPY server.js ./
COPY cloud cloud
COPY bin bin
COPY public_html public_html
COPY views views

# إنشاء مجلدات files و logs وإعطاء الصلاحيات
RUN mkdir -p files logs \
    && chown -R node:node /parse-server

# إعداد المتغيرات المهمة
ENV PORT=1337
ENV NODE_ENV=production
ENV HOST=0.0.0.0

# تشغيل كـ node user لأمان أكبر
USER node

# فتح البورت
EXPOSE 1337

# بدء السيرفر
CMD ["npm", "start"]
