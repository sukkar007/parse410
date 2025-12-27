const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');

const app = express();

// ✅ Trust Proxy مهم لـ Render + Dashboard
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 👇 Serve static files (HTML, CSS, JS, images...) from public_html
app.use(express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Push Notifications (Firebase FCM)
   =============================== */
let pushConfig = undefined;
console.log('⚠️ Firebase Push disabled — running without push notifications');

/* ===============================
   Parse Server Configuration
   =============================== */
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',
  fileKey: process.env.FILE_KEY || 'myFileKey',
  restAPIKey: process.env.REST_API_KEY || 'myRestApiKey',

  // 🔹 MongoDB URI
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
        serverURL: process.env.SERVER_URL,
        appId: process.env.APP_ID,
        masterKey: process.env.MASTER_KEY,
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
  {
    allowInsecureHTTP: true // مهم على Render
  }
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
  console.log(`🔔 Push: DISABLED`);
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
