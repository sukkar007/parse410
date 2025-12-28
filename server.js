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

  /* =============================== Backblaze B2 (S3 Adapter ثابت) =============================== */
  filesAdapter: new (require('@parse/s3-files-adapter'))({
    bucket: 'flamingo',                               // اسم الدلو
    region: 'us-east-005',                             // المنطقة
    endpoint: 'https://s3.us-east-005.backblazeb2.com', // endpoint كامل
    accessKey: '0053ff2cfbeee040000000001',           // keyID الجديد
    secretKey: 'K005fqNn6BDH8is4Eh3ss9mzWTtdh2Y',    // applicationKey الجديد
    directAccess: true,
    signatureVersion: 'v4',
    s3ForcePathStyle: true
  }),

  /* =============================== LiveQuery =============================== */
  liveQuery: { classNames: ['*'], redisURL: process.env.REDIS_URL },

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
app.use(
  '/dashboard',
  express.static(path.join(__dirname, 'node_modules/parse-dashboard/public'))
);

const dashboard = new ParseDashboard(
  {
    apps: [
      {
        serverURL: process.env.SERVER_URL,
        appId: process.env.APP_ID,
        masterKey: process.env.MASTER_KEY,
        appName: process.env.APP_NAME || 'Parse Server'
      }
    ],
    users: [
      { user: process.env.DASHBOARD_USER, pass: process.env.DASHBOARD_PASS }
    ]
  },
  { allowInsecureHTTP: false }
);

app.use('/dashboard', dashboard);

/* =============================== HTTP + LiveQuery Server =============================== */
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

/* =============================== Health Check =============================== */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
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
  console.log(`📍 API: ${process.env.SERVER_URL}`);
  console.log(
    `📊 Dashboard: ${process.env.SERVER_URL.replace('/parse', '/dashboard')}`
  );
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
