'use strict';

const express = require('express');
const http = require('http');
const path = require('path');

const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const S3Adapter = require('@parse/s3-files-adapter');

const app = express();

/* ===============================
   Trust Proxy (مهم جدًا لـ Render)
   =============================== */
app.set('trust proxy', 1);

/* ===============================
   Middlewares
   =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static Files (موقعك فقط)
   =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Parse Server Configuration
   =============================== */
const parseServer = new ParseServer({
  appId: 'myAppId',
  masterKey: 'myMasterKey',
  clientKey: 'myClientKey',
  fileKey: 'myFileKey',
  restAPIKey: 'myRestApiKey',

  databaseURI: 'mongodb://localhost:27017/dev',

  serverURL: 'https://myapp.onrender.com',
  publicServerURL: 'https://myapp.onrender.com',

  cloud: path.join(__dirname, 'cloud/main.js'),

  /* ===============================
     Backblaze B2 (S3 Adapter)
     =============================== */
  filesAdapter: new S3Adapter({
    bucket: 'flamingo', // اسم الدلو
    region: 'us-east-005',
    endpoint: 'https://s3.us-east-005.backblazeb2.com',
    accessKey: '3ff2cfbeee04', // keyID مباشرة
    secretKey: '0056df25d7c68fa161924cd7efb24a9cccb3433c74', // applicationKey مباشرة
    directAccess: true,
    signatureVersion: 'v4',
    s3ForcePathStyle: true
  }),

  /* ===============================
     LiveQuery
     =============================== */
  liveQuery: {
    classNames: ['*'],
    redisURL: 'redis://localhost:6379'
  },

  allowClientClassCreation: true,
  allowCustomObjectId: true,

  defaultLimit: 100,
  maxLimit: 1000,

  graphQLPath: '/graphql',
  graphQLPlaygroundPath: '/graphql-playground',

  logLevel: 'info'
});

/* ===============================
   Mount Parse API
   =============================== */
app.use('/parse', parseServer);

/* ===============================
   Parse Dashboard
   =============================== */
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
        serverURL: 'https://myapp.onrender.com',
        appId: 'myAppId',
        masterKey: 'myMasterKey',
        appName: 'Parse Server'
      }
    ],
    users: [
      {
        user: 'admin',
        pass: 'password123'
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
    time: new Date().toISOString()
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
const PORT = 1337;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 Running');
  console.log(`📍 API: https://myapp.onrender.com`);
  console.log(`📊 Dashboard: https://myapp.onrender.com/dashboard`);
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
