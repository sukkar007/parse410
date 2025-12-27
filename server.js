const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Push Notifications (Firebase FCM)
   =============================== */
let pushConfig = undefined;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    // تحويل Base64 إلى JSON
    const firebaseServiceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT, 'base64').toString('utf8')
    );

    pushConfig = {
      android: {
        firebaseAdminConfig: firebaseServiceAccount
      },
      ios: {
        // إذا لم تستخدم iOS، اتركه فارغ أو اضبط الإعدادات الخاصة بك
        pfx: '',
        bundleId: '',
        production: false
      }
    };

    console.log(`✅ Firebase FCM Push enabled for project: ${firebaseServiceAccount.project_id}`);
  } catch (e) {
    console.error('❌ Invalid FIREBASE_SERVICE_ACCOUNT JSON');
    throw e;
  }
} else {
  console.log('⚠️ Firebase Push disabled (no FIREBASE_SERVICE_ACCOUNT)');
}

/* ===============================
   Parse Server Configuration
   =============================== */
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',
  fileKey: process.env.FILE_KEY || 'myFileKey',
  restAPIKey: process.env.REST_API_KEY || 'myRestApiKey',
  databaseURI: process.env.DATABASE_URI || 'mongodb://localhost:27017/dev',
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  cloud: process.env.CLOUD_MAIN || path.join(__dirname, 'cloud/main.js'),
  filesAdapter: {
    module: '@parse/fs-files-adapter',
    params: { filesSubDir: 'files' }
  },
  liveQuery: {
    classNames: ['*'],
    redisURL: process.env.REDIS_URL
  },
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  defaultLimit: 100,
  maxLimit: 1000,
  enforcePrivateUsers: false,
  graphQLPath: '/graphql',
  graphQLPlaygroundPath: '/graphql-playground',
  push: pushConfig,
  logLevel: process.env.LOG_LEVEL || 'info'
});

// Mount Parse API
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
        clientKey: process.env.CLIENT_KEY || 'myClientKey',
        fileKey: process.env.FILE_KEY || 'myFileKey',
        restApiKey: process.env.REST_API_KEY || 'myRestApiKey',
        appName: process.env.APP_NAME || 'MyParseApp'
      }
    ],
    users: [
      {
        user: process.env.DASHBOARD_USER || 'admin',
        pass: process.env.DASHBOARD_PASS || 'admin123'
      }
    ],
    useEncryptedPasswords: false
  },
  true
);

app.use('/dashboard', dashboard);

/* ===============================
   HTTP + Live Query Server
   =============================== */
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

/* ===============================
   Health & Info
   =============================== */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    parseServer: 'running',
    liveQuery: 'enabled',
    dashboard: 'available'
  });
});

app.get('/info', (req, res) => {
  res.json({
    name: 'Parse Server',
    version: '4.10.4',
    endpoints: {
      parse: '/parse',
      dashboard: '/dashboard',
      graphql: '/parse/graphql',
      health: '/health'
    }
  });
});

/* ===============================
   Error Handling
   =============================== */
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* ===============================
   Start Server
   =============================== */
const PORT = process.env.PORT || 1337;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 Running');
  console.log(`📍 ${process.env.SERVER_URL || `http://${HOST}:${PORT}/parse`}`);
  console.log(`📊 Dashboard: /dashboard`);
  console.log(`🔔 Push: ${pushConfig ? 'ENABLED' : 'DISABLED'}`);
  console.log('════════════════════════════════════');
});

/* ===============================
   Process Safety
   =============================== */
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
