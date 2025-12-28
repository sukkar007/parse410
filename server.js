const express = require('express');
const { ParseServer, FilesAdapter } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');
const B2 = require('backblaze-b2');

const app = express();

// ===============================
// Trust Proxy
// ===============================
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/', express.static(path.join(__dirname, 'public_html')));

// ===============================
// Backblaze B2 Adapter
// ===============================
class B2FilesAdapter extends FilesAdapter {
  constructor(options) {
    super();
    this.bucketName = options.bucketName;
    this.b2 = new B2({
      applicationKeyId: options.applicationKeyId,
      applicationKey: options.applicationKey
    });
    this.b2.authorize().catch(err => console.error('B2 Authorization Error:', err));
  }

  async createFile(config, filename, data, contentType) {
    // upload file
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

    // return public URL
    return {
      url: `https://f000.backblazeb2.com/file/${this.bucketName}/${filename}`
    };
  }

  async deleteFile(config, filename) {
    // حذف ملف إذا احتجت
    console.log('Delete file not implemented for B2');
  }
}

// ===============================
// Parse Server
// ===============================
const parseServer = new ParseServer({
  appId: process.env.APP_ID,
  masterKey: process.env.MASTER_KEY,
  clientKey: process.env.CLIENT_KEY,
  restAPIKey: process.env.REST_API_KEY,
  databaseURI: process.env.DATABASE_URI,
  serverURL: process.env.SERVER_URL,
  publicServerURL: process.env.SERVER_URL,
  cloud: path.join(__dirname, 'cloud/main.js'),
  filesAdapter: new B2FilesAdapter({
    applicationKeyId: process.env.B2_KEY_ID,
    applicationKey: process.env.B2_APPLICATION_KEY,
    bucketName: process.env.B2_BUCKET_NAME
  }),
  liveQuery: { classNames: ['*'] },
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  defaultLimit: 100,
  maxLimit: 1000,
  logLevel: process.env.LOG_LEVEL || 'info'
});

app.use('/parse', parseServer);

// ===============================
// Parse Dashboard
// ===============================
const dashboard = new ParseDashboard({
  apps: [{
    serverURL: process.env.SERVER_URL,
    appId: process.env.APP_ID,
    masterKey: process.env.MASTER_KEY,
    appName: process.env.APP_NAME || 'MyParseApp'
  }],
  users: [{
    user: process.env.DASHBOARD_USER,
    pass: process.env.DASHBOARD_PASS
  }]
}, { allowInsecureHTTP: false });

app.use('/dashboard', dashboard);

// ===============================
// HTTP + LiveQuery
// ===============================
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

// ===============================
// Health Check
// ===============================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ===============================
// Error Handling
// ===============================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// ===============================
// Start Server
// ===============================
const PORT = process.env.PORT || 1337;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('✅ Parse Server Running');
  console.log(`📍 ${process.env.SERVER_URL}`);
  console.log('📊 Dashboard: /dashboard');
});

// ===============================
// Process Safety
// ===============================
process.on('unhandledRejection', reason => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', error => { console.error('Uncaught Exception:', error); process.exit(1); });

module.exports = app;
