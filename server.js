const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const app = express();

/* ===============================
   Trust Proxy (مهم جدًا لـ Render)
   =============================== */
app.set('trust proxy', 1);

/* ===============================
   Middleware
   =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static Files لموقعك فقط
   (بدون تعارض مع Dashboard)
   =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Cloudinary Configuration
   =============================== */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

console.log('☁️ Cloudinary configured:', {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME ? '✅' : '❌',
  api_key: process.env.CLOUDINARY_API_KEY ? '✅' : '❌',
  api_secret: process.env.CLOUDINARY_API_SECRET ? '✅' : '❌'
});

/* ===============================
   Cloudinary Files Adapter
   =============================== */
class CloudinaryFilesAdapter {
  constructor() {
    this.cloudinary = cloudinary;
  }

  async createFile(config, filename, data, contentType) {
    try {
      // تحويل البيانات إلى Base64
      const base64Data = data.toString('base64');
      const dataURI = `data:${contentType || 'application/octet-stream'};base64,${base64Data}`;

      // رفع الملف إلى Cloudinary
      const result = await this.cloudinary.uploader.upload(dataURI, {
        public_id: filename.replace(/\.[^/.]+$/, ''), // إزالة الامتداد
        resource_type: 'auto',
        overwrite: true
      });

      console.log(`✅ File uploaded to Cloudinary: ${filename}`);

      return {
        url: result.secure_url
      };
    } catch (error) {
      console.error('❌ Error creating file in Cloudinary:', error);
      throw error;
    }
  }

  async deleteFile(config, filename) {
    try {
      const publicId = filename.replace(/\.[^/.]+$/, '');
      await this.cloudinary.uploader.destroy(publicId);
      console.log(`✅ File deleted from Cloudinary: ${filename}`);
    } catch (error) {
      console.error('❌ Error deleting file from Cloudinary:', error);
      throw error;
    }
  }

  async getFileData(filename) {
    try {
      const publicId = filename.replace(/\.[^/.]+$/, '');
      const resource = await this.cloudinary.api.resource(publicId);
      
      // احصل على البيانات من URL
      const response = await fetch(resource.secure_url);
      return await response.buffer();
    } catch (error) {
      console.error('❌ Error getting file data from Cloudinary:', error);
      throw error;
    }
  }

  async getFileLocation(config, filename) {
    try {
      const publicId = filename.replace(/\.[^/.]+$/, '');
      const resource = await this.cloudinary.api.resource(publicId);
      return resource.secure_url;
    } catch (error) {
      console.error('❌ Error getting file location from Cloudinary:', error);
      throw error;
    }
  }
}

/* ===============================
   Firebase Push (معطّل)
   =============================== */
let pushConfig = undefined;
console.log('⚠️ Firebase Push disabled — running without push notifications');

/* ===============================
   Parse Server Configuration
   =============================== */
const parseServer = new ParseServer({
  appId: process.env.APP_ID,
  masterKey: process.env.MASTER_KEY,
  clientKey: process.env.CLIENT_KEY,
  fileKey: process.env.FILE_KEY,
  restAPIKey: process.env.REST_API_KEY,

  databaseURI: process.env.DATABASE_URI,

  serverURL: process.env.SERVER_URL,        // يجب أن يكون HTTPS
  publicServerURL: process.env.SERVER_URL, // مهم للداش بورد

  cloud: path.join(__dirname, 'cloud/main.js'),

  /* =============================== Cloudinary Files Adapter =============================== */
  filesAdapter: new CloudinaryFilesAdapter(),

  liveQuery: {
    classNames: ['*'],
    redisURL: process.env.REDIS_URL
  },

  /* =============================== Permissions & Security =============================== */
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  enforcePrivateUsers: false,
  allowUserPasswordReset: true,
  allowExpiredAuthDataToken: true,

  defaultLimit: 100,
  maxLimit: 1000,

  graphQLPath: '/graphql',
  graphQLPlaygroundPath: '/graphql-playground',

  push: pushConfig,
  logLevel: process.env.LOG_LEVEL || 'info'
});

/* ===============================
   Mount Parse API
   =============================== */
app.use('/parse', parseServer);

/* ===============================
   Parse Dashboard (الحل الجذري)
   =============================== */

// ⭐ static خاص بالداش بورد (مهم جدًا)
app.use(
  '/dashboard',
  express.static(
    path.join(__dirname, 'node_modules/parse-dashboard/public')
  )
);

const dashboard = new ParseDashboard(
  {
    apps: [
      {
        serverURL: process.env.SERVER_URL,
        appId: process.env.APP_ID,
        masterKey: process.env.MASTER_KEY,
        appName: process.env.APP_NAME || 'MyParseApp'
      }
    ],
    users: [
      {
        user: process.env.DASHBOARD_USER,
        pass: process.env.DASHBOARD_PASS
      }
    ]
  },
  {
    allowInsecureHTTP: false
  }
);

app.use('/dashboard', dashboard);

/* ===============================
   HTTP + LiveQuery Server
   =============================== */
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

/* ===============================
   Health Check
   =============================== */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    filesAdapter: 'Cloudinary ☁️',
    storage: '25 GB Free',
    permissions: 'Enabled ✅',
    liveQuery: 'Enabled ✅'
  });
});

/* ===============================
   Error Handling
   =============================== */
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* ===============================
   Start Server
   =============================== */
const PORT = process.env.PORT || 1337;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 Running');
  console.log(`📍 ${process.env.SERVER_URL}`);
  console.log('📊 Dashboard: /dashboard');
  console.log('☁️  Files: Cloudinary Storage (25 GB Free)');
  console.log('📡 Live Query: Enabled');
  console.log('🔐 Permissions: Enabled');
  console.log('════════════════════════════════════');
});

/* ===============================
   Process Safety
   =============================== */
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
