# 🚀 نشر Parse Server على Render

## المتطلبات

- حساب على [Render.com](https://render.com)
- حساب GitHub (مع المستودع `sukkar007/parse410`)
- حساب MongoDB Atlas (اختياري، أو استخدام MongoDB محلي)
- حساب Redis Cloud (اختياري، أو استخدام Redis محلي)

---

## خطوات النشر على Render

### الخطوة 1: إنشاء حساب على Render

1. اذهب إلى [https://render.com](https://render.com)
2. انقر على **"Get Started"**
3. اختر **"Sign up with GitHub"** أو **"Sign up with Email"**
4. أكمل عملية التسجيل

### الخطوة 2: ربط مستودع GitHub

1. في لوحة التحكم، انقر على **"New +"**
2. اختر **"Web Service"**
3. انقر على **"Connect a repository"**
4. اختر **"GitHub"** وسجل دخولك
5. ابحث عن مستودعك **"sukkar007/parse410"**
6. انقر على **"Connect"**

### الخطوة 3: إعدادات الخدمة

#### الإعدادات الأساسية:

| الحقل | القيمة |
|-------|--------|
| **Name** | `parse-server` |
| **Environment** | `Docker` |
| **Region** | اختر المنطقة الأقرب إليك |
| **Branch** | `main` |

#### أوامر البناء والتشغيل:

```
Build Command: npm install && npm run build
Start Command: npm start
```

### الخطوة 4: متغيرات البيئة

انقر على **"Environment"** وأضف المتغيرات التالية:

#### المفاتيح الأساسية:

```
APP_ID=myAppId
MASTER_KEY=myMasterKey
CLIENT_KEY=myClientKey
FILE_KEY=myFileKey
REST_API_KEY=myRestApiKey
JAVA_KEY=myJavaKey
```

#### قاعدة البيانات (MongoDB 3.6):

**خيار 1: استخدام MongoDB Atlas**

```
DATABASE_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=false
```

**خيار 2: استخدام MongoDB محلي على Render**

```
DATABASE_URI=mongodb://parse-mongodb:27017/dev
```

#### Redis:

**خيار 1: استخدام Redis Cloud**

```
REDIS_URL=redis://:password@host:port
```

**خيار 2: استخدام Redis محلي على Render**

```
REDIS_URL=redis://parse-redis:6379
```

#### إعدادات أخرى:

```
NODE_ENV=production
PORT=1337
HOST=0.0.0.0
SERVER_URL=https://parse-server.onrender.com/parse
CLOUD_MAIN=./cloud/main.js
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123
LOG_LEVEL=info
```

### الخطوة 5: إضافة قاعدة بيانات MongoDB

1. انقر على **"New +"** → **"PostgreSQL"** أو **"MongoDB"**
2. اختر **"MongoDB"**
3. أدخل الاسم: `parse-mongodb`
4. اختر المنطقة والخطة
5. انقر على **"Create Database"**

### الخطوة 6: إضافة Redis

1. انقر على **"New +"** → **"Redis"**
2. أدخل الاسم: `parse-redis`
3. اختر المنطقة والخطة
4. انقر على **"Create"**

### الخطوة 7: ربط الخدمات

1. عد إلى خدمة `parse-server`
2. انقر على **"Environment"**
3. حدّث قيم `DATABASE_URI` و `REDIS_URL` بناءً على الخدمات التي أنشأتها

### الخطوة 8: النشر

1. انقر على **"Create Web Service"**
2. سيبدأ Render ببناء وتشغيل التطبيق
3. انتظر حتى يكتمل البناء (عادة 5-10 دقائق)

---

## التحقق من النشر

بعد اكتمال النشر، يمكنك الوصول إلى:

| الخدمة | الرابط |
|--------|--------|
| **Parse API** | `https://parse-server.onrender.com/parse` |
| **Dashboard** | `https://parse-server.onrender.com/dashboard` |
| **Health Check** | `https://parse-server.onrender.com/health` |
| **Info** | `https://parse-server.onrender.com/info` |

---

## بيانات تسجيل الدخول

### لوحة التحكم (Dashboard):

```
Username: admin
Password: admin123
```

### معرّفات التطبيق:

```
App ID: myAppId
Master Key: myMasterKey
Client Key: myClientKey
REST API Key: myRestApiKey
Java Key: myJavaKey
```

---

## اختبار التطبيق

### فحص الصحة:

```bash
curl https://parse-server.onrender.com/health
```

### الحصول على المعلومات:

```bash
curl https://parse-server.onrender.com/info
```

### إنشاء كائن:

```bash
curl -X POST \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-REST-API-Key: myRestApiKey" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","score":100}' \
  https://parse-server.onrender.com/parse/classes/GameScore
```

### الحصول على الكائنات:

```bash
curl -X GET \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-REST-API-Key: myRestApiKey" \
  https://parse-server.onrender.com/parse/classes/GameScore
```

---

## استكشاف الأخطاء

### المشكلة: الخدمة لا تبدأ

**الحل:**
1. تحقق من السجلات في Render
2. تأكد من أن جميع متغيرات البيئة صحيحة
3. تأكد من أن قاعدة البيانات متصلة

### المشكلة: خطأ في الاتصال بـ MongoDB

**الحل:**
1. تحقق من `DATABASE_URI`
2. تأكد من أن MongoDB قيد التشغيل
3. تأكد من أن كلمة المرور صحيحة

### المشكلة: Live Query لا يعمل

**الحل:**
1. تحقق من `REDIS_URL`
2. تأكد من أن Redis قيد التشغيل
3. تأكد من أن البيانات صحيحة

---

## التحديثات المستقبلية

### لتحديث التطبيق:

1. قم بإجراء التغييرات في مستودع GitHub
2. ادفع التغييرات إلى الفرع `main`
3. سيقوم Render تلقائياً بإعادة بناء وتشغيل التطبيق

### لتعطيل النشر التلقائي:

1. انقر على **"Settings"** في خدمة `parse-server`
2. ابحث عن **"Auto-Deploy"**
3. اختر **"Off"**

---

## الأمان

### توصيات الأمان:

1. **غيّر المفاتيح الافتراضية:**
   - غيّر `MASTER_KEY` إلى قيمة قوية
   - غيّر `DASHBOARD_PASS` إلى كلمة مرور قوية

2. **استخدم HTTPS:**
   - Render يوفر HTTPS افتراضياً

3. **حماية قاعدة البيانات:**
   - استخدم كلمات مرور قوية
   - قيّد الوصول إلى عناوين IP المعروفة

4. **تفعيل المصادقة:**
   - استخدم `enforcePrivateUsers: true` إذا لزم الأمر

---

## الدعم والمساعدة

- 📚 [توثيق Render](https://render.com/docs)
- 📚 [توثيق Parse Server](https://docs.parseplatform.org/)
- 💬 [مجتمع Parse](https://community.parseplatform.org/)
- 🐛 [تقارير الأخطاء](https://github.com/sukkar007/parse410/issues)

---

**تم النشر بنجاح! 🎉**

استمتع بـ Parse Server الخاص بك على Render!
