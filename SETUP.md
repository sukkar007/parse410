# Parse Server 4.10.4 - إعداد شامل

## 🚀 نظرة عامة

هذا المشروع يوفر إعداداً كاملاً لـ **Parse Server 4.10.4** مع:
- ✅ **Parse Dashboard** - لوحة تحكم شاملة
- ✅ **Live Query** - استعلامات فورية في الوقت الفعلي
- ✅ **Cloud Code** - منطق خادم متقدم
- ✅ **صلاحيات كاملة** - إضافة، تعديل، حذف، بحث لجميع المستخدمين
- ✅ **REST API** - واجهة برمجية كاملة
- ✅ **GraphQL** - استعلامات GraphQL متقدمة

---

## 📋 المتطلبات

### للتطوير المحلي:
- **Node.js** >= 16
- **MongoDB** >= 4.0
- **Redis** (اختياري، للـ Live Query)
- **npm** أو **yarn**

### للإنتاج:
- **Docker** و **Docker Compose**
- أو منصة استضافة مثل **Render**, **Heroku**, **AWS**, إلخ

---

## 🛠️ التثبيت والتشغيل

### 1. التثبيت المحلي

```bash
# استنساخ المستودع
git clone https://github.com/sukkar007/parse410.git
cd parse410

# تثبيت المتطلبات
npm install

# بناء المشروع
npm run build

# تشغيل الخادم
npm start
```

### 2. استخدام Docker Compose

```bash
# بناء وتشغيل جميع الخدمات
docker-compose up -d

# عرض السجلات
docker-compose logs -f parse-server

# إيقاف الخدمات
docker-compose down
```

### 3. متغيرات البيئة

انسخ ملف `.env.example` إلى `.env` وعدّل القيم:

```bash
cp .env.example .env
```

**المتغيرات الأساسية:**

```env
# معرّفات التطبيق
APP_ID=myAppId
MASTER_KEY=myMasterKey
CLIENT_KEY=myClientKey
REST_API_KEY=myRestApiKey
JAVA_KEY=myJavaKey

# قاعدة البيانات
DATABASE_URI=mongodb://localhost:27017/dev

# لوحة التحكم
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123

# Redis (للـ Live Query)
REDIS_URL=redis://localhost:6379
```

---

## 🌐 الوصول إلى الخدمات

بعد التشغيل، يمكنك الوصول إلى:

| الخدمة | الرابط | الوصف |
|--------|--------|-------|
| **Parse API** | `http://localhost:1337/parse` | واجهة REST API |
| **Dashboard** | `http://localhost:1337/dashboard` | لوحة التحكم |
| **GraphQL** | `http://localhost:1337/parse/graphql` | استعلامات GraphQL |
| **GraphQL Playground** | `http://localhost:1337/parse/graphql-playground` | بيئة اختبار GraphQL |
| **Health Check** | `http://localhost:1337/health` | فحص صحة الخادم |
| **Info** | `http://localhost:1337/info` | معلومات التطبيق |

### بيانات تسجيل الدخول للـ Dashboard:
- **Username:** `admin`
- **Password:** `admin123`

---

## 🔑 المفاتيح والمعرّفات

### معرّفات التطبيق:
```
App ID: myAppId
Master Key: myMasterKey
Client Key: myClientKey
File Key: myFileKey
REST API Key: myRestApiKey
Java Key: myJavaKey
```

### استخدام المفاتيح في الطلبات:

**مثال REST API:**
```bash
curl -X GET \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-REST-API-Key: myRestApiKey" \
  http://localhost:1337/parse/classes/GameScore
```

**مثال مع Master Key:**
```bash
curl -X GET \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-Master-Key: myMasterKey" \
  http://localhost:1337/parse/classes/GameScore
```

---

## 📝 Cloud Code

### أمثلة الدوال المتاحة:

#### 1. دالة بسيطة:
```javascript
Parse.Cloud.define("hello", (request) => {
  return "Hello from Cloud Code!";
});
```

#### 2. دالة مع معاملات:
```javascript
Parse.Cloud.define("greet", (request) => {
  const { name } = request.params;
  return `Hello, ${name}!`;
});
```

#### 3. إنشاء كائن:
```javascript
Parse.Cloud.define("createObject", async (request) => {
  const { className, data } = request.params;
  const object = new Parse.Object(className);
  for (const key in data) {
    object.set(key, data[key]);
  }
  await object.save(null, { useMasterKey: true });
  return { success: true, objectId: object.id };
});
```

#### 4. البحث:
```javascript
Parse.Cloud.define("search", async (request) => {
  const { className, key, value } = request.params;
  const query = new Parse.Query(className);
  query.equalTo(key, value);
  return await query.find({ useMasterKey: true });
});
```

#### 5. التحديث:
```javascript
Parse.Cloud.define("updateObject", async (request) => {
  const { className, objectId, data } = request.params;
  const query = new Parse.Query(className);
  const object = await query.get(objectId, { useMasterKey: true });
  for (const key in data) {
    object.set(key, data[key]);
  }
  await object.save(null, { useMasterKey: true });
  return { success: true };
});
```

#### 6. الحذف:
```javascript
Parse.Cloud.define("deleteObject", async (request) => {
  const { className, objectId } = request.params;
  const query = new Parse.Query(className);
  const object = await query.get(objectId, { useMasterKey: true });
  await object.destroy({ useMasterKey: true });
  return { success: true };
});
```

---

## 🔄 Live Query

### تفعيل Live Query:

في `server.js`، تم تفعيل Live Query لجميع الفئات:

```javascript
liveQuery: {
  classNames: ['*'], // جميع الفئات
  redisURL: process.env.REDIS_URL
}
```

### استخدام Live Query من العميل:

```javascript
// إنشاء استعلام
let query = new Parse.Query('GameScore');
query.greaterThan('score', 100);

// الاشتراك في الاستعلام
let subscription = await query.subscribe();

// الاستماع لأحداث الإنشاء
subscription.on('create', (object) => {
  console.log('New object created:', object);
});

// الاستماع لأحداث التحديث
subscription.on('update', (object) => {
  console.log('Object updated:', object);
});

// الاستماع لأحداث الحذف
subscription.on('delete', (object) => {
  console.log('Object deleted:', object);
});
```

---

## 🔐 الصلاحيات

تم تفعيل الصلاحيات الكاملة للمستخدمين:

```javascript
allowClientClassCreation: true,  // إنشاء فئات جديدة
allowCustomObjectId: true,       // Object IDs مخصصة
enforcePrivateUsers: false       // قراءة بيانات المستخدمين
```

---

## 📊 قاعدة البيانات

### MongoDB:

```bash
# الاتصال المحلي
mongodb://localhost:27017/dev

# MongoDB Atlas
mongodb+srv://username:password@cluster.mongodb.net/dbname
```

### إنشاء فهرس نصي (للبحث):

```javascript
db.GameScore.createIndex({ name: "text", description: "text" })
```

---

## 🚀 النشر على Render

### 1. إنشاء حساب على Render:
- اذهب إلى https://render.com
- سجل دخولك أو أنشئ حساباً جديداً

### 2. ربط مستودع GitHub:
- انقر على "New +"
- اختر "Web Service"
- اختر "Connect a repository"
- اختر مستودعك `parse410`

### 3. إعدادات النشر:
- **Name:** parse-server
- **Environment:** Docker
- **Branch:** main
- **Build Command:** `npm run build`
- **Start Command:** `npm start`

### 4. متغيرات البيئة:
أضف في قسم "Environment":

```
APP_ID=myAppId
MASTER_KEY=myMasterKey
CLIENT_KEY=myClientKey
REST_API_KEY=myRestApiKey
DATABASE_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
REDIS_URL=redis://user:pass@redis-host:port
DASHBOARD_USER=admin
DASHBOARD_PASS=admin123
```

### 5. قاعدة البيانات:
- استخدم **MongoDB Atlas** للـ MongoDB
- استخدم **Redis Cloud** أو **Upstash** للـ Redis

---

## 🧪 اختبار الخادم

### فحص الصحة:
```bash
curl http://localhost:1337/health
```

### الحصول على المعلومات:
```bash
curl http://localhost:1337/info
```

### إنشاء كائن:
```bash
curl -X POST \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-REST-API-Key: myRestApiKey" \
  -H "Content-Type: application/json" \
  -d '{"name":"John","score":100}' \
  http://localhost:1337/parse/classes/GameScore
```

### الحصول على الكائنات:
```bash
curl -X GET \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-REST-API-Key: myRestApiKey" \
  http://localhost:1337/parse/classes/GameScore
```

### استدعاء دالة Cloud:
```bash
curl -X POST \
  -H "X-Parse-Application-Id: myAppId" \
  -H "X-Parse-REST-API-Key: myRestApiKey" \
  -H "Content-Type: application/json" \
  -d '{"name":"World"}' \
  http://localhost:1337/parse/functions/greet
```

---

## 📚 الموارد والمراجع

- [Parse Server Documentation](https://docs.parseplatform.org/parse-server/guide/)
- [Parse Dashboard](https://github.com/parse-community/parse-dashboard)
- [Parse SDKs](https://parseplatform.org/)
- [Live Query Protocol](https://github.com/parse-community/parse-server/wiki/Parse-LiveQuery-Protocol-Specification)
- [Cloud Code Guide](https://docs.parseplatform.org/cloudcode/guide/)

---

## 🐛 استكشاف الأخطاء

### المشكلة: لا يمكن الاتصال بـ MongoDB

**الحل:**
```bash
# تأكد من أن MongoDB يعمل
mongod --version

# أو استخدم Docker
docker run -d -p 27017:27017 mongo:4.4
```

### المشكلة: Live Query لا يعمل

**الحل:**
```bash
# تأكد من أن Redis يعمل
redis-cli ping

# أو استخدم Docker
docker run -d -p 6379:6379 redis:7-alpine
```

### المشكلة: الصلاحيات غير كافية

**الحل:**
تأكد من استخدام `useMasterKey: true` في عمليات Cloud Code:
```javascript
await object.save(null, { useMasterKey: true });
```

---

## 📞 الدعم

للمساعدة والدعم:
- 📧 البريد الإلكتروني: support@example.com
- 🐛 تقارير الأخطاء: https://github.com/sukkar007/parse410/issues
- 💬 المجتمع: https://community.parseplatform.org/

---

## 📄 الترخيص

هذا المشروع مرخص تحت **BSD 3-Clause License**

---

**تم الإنشاء بواسطة:** sukkar007  
**التاريخ:** 2025-12-26  
**الإصدار:** 4.10.4
