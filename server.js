'use strict';

const express = require('express');
const http = require('http');
const path = require('path');

const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');

const app = express();

/* =============================== Trust Proxy =============================== */
app.set('trust proxy', 1);

/* =============================== Middlewares =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =============================== Static Files =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* =============================== Parse Server Configuration =============================== */
// ✅ الحل الفوري: بدون محول ملفات خارجي
// Parse Server سيستخدم المحول الافتراضي
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

  // ❌ لا نستخدم filesAdapter - سيستخدم المحول الافتراضي
  // هذا يحل مشكلة بيانات AWS غير الصحيحة

  /* =============================== LiveQuery =============================== */
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

/* =============================== Mount Parse API =============================== */
app.use('/parse', parseServer);

/* =============================== Parse Dashboard =============================== */
const dashboard = new ParseDashboard(
  {
    apps: [
      {
        serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
        appId: process.env.APP_ID || 'myAppId',
        masterKey: process.env.MASTER_KEY || 'myMasterKey',
        appName: process.env.APP_NAME || 'Parse Server'
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

/* =============================== HTTP + LiveQuery Server =============================== */
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

/* =============================== Health Check =============================== */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    filesAdapter: 'default (built-in)'
  });
});

/* =============================== Error Handling =============================== */
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

/* =============================== Start Server =============================== */
const PORT = process.env.PORT || 1337;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 Running');
  console.log(`📍 API: http://localhost:${PORT}/parse`);
  console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
  console.log('📁 Files: Using default adapter');
  console.log('════════════════════════════════════');
});

/* =============================== Process Safety =============================== */
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;
