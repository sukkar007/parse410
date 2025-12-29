const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const https = require('https');
require('dotenv').config(); // تحميل متغيرات البيئة

const app = express();

/* ===============================
   Trust Proxy (مهم لـ Render)
   =============================== */
app.set('trust proxy', 1);

/* ===============================
   Middleware
   =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static Files
   =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Cloudinary Configuration
   =============================== */
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('❌ Cloudinary ENV missing!');
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
console.log('☁️ Cloudinary configured successfully');

/* ===============================
   Cloudinary Files Adapter
   =============================== */
class CloudinaryFilesAdapter {
  constructor() {
    this.cloudinary = cloudinary;
  }

  _safeName(filename) {
    if (typeof filename === 'string') return filename;
    if (filename?.name) return filename.name;
    return `file_${Date.now()}`;
  }

  _publicId(filename) {
    return this._safeName(filename).replace(/\.[^/.]+$/, '') + '_' + Date.now();
  }

  async createFile(config, filename, data, contentType) {
    const safeName = this._safeName(filename);
    const publicId = this._publicId(safeName);

    let mime = 'application/octet-stream';
    if (typeof contentType === 'string') mime = contentType;
    else if (contentType?.type) mime = contentType.type;
    else if (contentType?.mime) mime = contentType.mime;

    try {
      // تحويل البيانات إلى Buffer و Base64
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const base64 = buffer.toString('base64');
      const dataURI = `data:${mime};base64,${base64}`;

      const result = await this.cloudinary.uploader.upload(dataURI, {
        public_id: publicId,
        resource_type: 'auto',
        overwrite: true
      });

      // إعادة كائن Parse-compatible
      return {
        url: result.secure_url,
        name: safeName
      };
    } catch (err) {
      console.error('❌ Cloudinary createFile ERROR:', err.message);
      throw err;
    }
  }

  async deleteFile(config, filename) {
    try {
      const publicId = this._publicId(filename);
      await this.cloudinary.uploader.destroy(publicId);
      console.log(`🗑️ Deleted: ${publicId}`);
    } catch (err) {
      console.warn('⚠️ Delete ignored:', err.message);
    }
  }

  async getFileLocation(config, filename) {
    try {
      const publicId = this._publicId(filename);
      const res = await this.cloudinary.api.resource(publicId);
      return res.secure_url;
    } catch (err) {
      if (err.http_code === 404) return null;
      throw err;
    }
  }

  async getFileData(filename) {
    const url = await this.getFileLocation(null, filename);
    if (!url) return null;

    return new Promise((resolve, reject) => {
      https.get(url, res => {
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }).on('error', reject);
    });
  }
}

/* ===============================
   Parse Server Configuration
   =============================== */
if (!process.env.APP_ID || !process.env.MASTER_KEY || !process.env.SERVER_URL) {
  console.error('❌ Parse ENV missing!');
  process.exit(1);
}

const parseServer = new ParseServer({
  appId: process.env.APP_ID,
  masterKey: process.env.MASTER_KEY,
  clientKey: process.env.CLIENT_KEY,
  fileKey: process.env.FILE_KEY,
  restAPIKey: process.env.REST_API_KEY,
  databaseURI: process.env.DATABASE_URI,
  serverURL: process.env.SERVER_URL,
  publicServerURL: process.env.SERVER_URL,
  cloud: path.join(__dirname, 'cloud/main.js'),
  filesAdapter: new CloudinaryFilesAdapter(),
  liveQuery: {
    classNames: ['*'],
    redisURL: process.env.REDIS_URL
  },
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  defaultLimit: 100,
  maxLimit: 1000,
  graphQLPath: '/graphql',
  graphQLPlaygroundPath: '/graphql-playground',
  logLevel: process.env.LOG_LEVEL || 'info'
});

/* ===============================
   Mount Parse API
   =============================== */
app.use('/parse', parseServer);

/* ===============================
   Parse Dashboard
   =============================== */
const dashboard = new ParseDashboard({
  apps: [
    {
      serverURL: process.env.SERVER_URL,
      appId: process.env.APP_ID,
      masterKey: process.env.MASTER_KEY,
      appName: process.env.APP_NAME || 'Parse App'
    }
  ],
  users: [
    {
      user: process.env.DASHBOARD_USER,
      pass: process.env.DASHBOARD_PASS
    }
  ]
}, { allowInsecureHTTP: false });

app.use('/dashboard', dashboard);

/* ===============================
   Health Check
   =============================== */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    files: 'Cloudinary',
    liveQuery: true,
    time: new Date().toISOString()
  });
});

/* ===============================
   Server
   =============================== */
const PORT = process.env.PORT || 1337;
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('══════════════════════════════════');
  console.log('✅ Parse Server Running');
  console.log(`📍 ${process.env.SERVER_URL}`);
  console.log('📊 Dashboard: /dashboard');
  console.log('☁️  Files: Cloudinary');
  console.log('══════════════════════════════════');
});

/* ===============================
   Safety
   =============================== */
process.on('unhandledRejection', r => console.error('❌ Unhandled:', r));
process.on('uncaughtException', e => {
  console.error('❌ Crash:', e);
  process.exit(1);
});

module.exports = app;
