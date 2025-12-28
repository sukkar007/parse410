const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');
const B2 = require('backblaze-b2'); // npm i backblaze-b2

const app = express();
app.set('trust proxy', 1); // مهم لـ Render

/* ===============================
   Middleware
=============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static Files لموقعك فقط
=============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Backblaze B2 Adapter
=============================== */
class B2FilesAdapter {
  constructor(options) {
    this.bucketName = options.bucketName;
    this.b2 = new B2({
      applicationKeyId: options.applicationKeyId,
      applicationKey: options.applicationKey
    });
    this.b2.authorize().catch(err => console.error('B2 Authorization Error:', err));
  }

  async createFile(config, filename, data, contentType) {
    const uploadUrlResponse = await this.b2.getUploadUrl({ bucketId: this.bucketName });
    const uploadUrl = uploadUrlResponse.data.uploadUrl;
    const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

    await this.b2.uploadFile({
      uploadUrl,
      uploadAuthToken,
      fileName: filename,
      data,
      contentType
    });

    return {
      url: `https://f000.backblazeb2.com/file/${this.bucketName}/${filename}`
    };
  }

  async deleteFile(config, filename) {
    console.log('Delete file not implemented for B2');
  }
}

/* ===============================
   Parse Server Configuration
=============================== */
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',
  fileKey: process.env.FILE_KEY,
  restAPIKey: process.env.REST_API_KEY,
  databaseURI: process.env.DATABASE_URI,
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  publicServerURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  cloud: path.join(__dirname, 'cloud/main.js'),
  filesAdapter: new B2FilesAdapter({
    applicationKeyId: process.env.B2_KEY_ID || '3ff2cfbeee04',
    applicationKey: process.env.B2_APPLICATION_KEY || '005ab4454c98830468aa3cb458c870d1bf036f4a3e',
    bucketName: process.env.B2_BUCKET_NAME || 'my-bucket'
  }),
  liveQuery: { classNames: ['*'], redisURL: process.env.REDIS_URL },
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  defaultLimit: 100,
  maxLimit: 1000,
  logLevel: process.env.LOG_LEVEL || 'info'
});

/* ===============================
   Mount Parse API
=============================== */
app.use('/parse', parseServer);

/* ===============================
   Parse Dashboard
=============================== */
const dashboard = new ParseDashboard(
  {
    apps: [
      {
        serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
        appId: process.env.APP_ID || 'myAppId',
        masterKey: process.env.MASTER_KEY || 'myMasterKey',
        appName: process.env.APP_NAME || 'MyParseApp'
      }
    ],
    users: [
      {
        user: process.env.DASHBOARD_USER || 'admin',
        pass: process.env.DASHBOARD_PASS || 'admin123'
      }
    ]
  },
  { allowInsecureHTTP: true }
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
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/* ===============================
   Error Handling
=============================== */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
});

/* ===============================
   Start Server
=============================== */
const PORT = process.env.PORT || 1337;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 Running');
  console.log(`📍 ${process.env.SERVER_URL || `http://localhost:${PORT}/parse`}`);
  console.log('📊 Dashboard: /dashboard');
  console.log('📁 Files: Backblaze B2 (Direct Access)');
  console.log('════════════════════════════════════');
});

/* ===============================
   Process Safety
=============================== */
process.on('unhandledRejection', reason => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', error => { console.error('Uncaught Exception:', error); process.exit(1); });

module.exports = app;
