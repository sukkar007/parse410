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

/* =============================== Parse Server =============================== */
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',

  databaseURI: process.env.DATABASE_URI,

  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  publicServerURL: process.env.SERVER_URL || 'http://localhost:1337/parse',

  cloud: path.join(__dirname, 'cloud/main.js'),

  /* 🔥 السماح المطلق */
  allowClientClassCreation: true,
  allowClientClassUpdate: true,
  allowCustomObjectId: true,
  enableAnonymousUsers: true,

  /* 🔥 تعطيل حماية السكيمة */
  disableSchemaHooks: true,
  schemaCacheTTL: 0,

  /* 🔥 إجبار استخدام masterKey داخليًا */
  useMasterKeyForQuery: true,

  defaultLimit: 100,
  maxLimit: 1000,

  liveQuery: {
    classNames: ['*']
  },

  logLevel: 'verbose'
});

/* =============================== Mount Parse =============================== */
app.use('/parse', parseServer);

/* =============================== Dashboard =============================== */
const dashboard = new ParseDashboard(
  {
    apps: [
      {
        serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
        appId: process.env.APP_ID || 'myAppId',
        masterKey: process.env.MASTER_KEY || 'myMasterKey',
        appName: 'Parse Server'
      }
    ],
    users: [
      { user: 'admin', pass: 'admin123' }
    ]
  },
  { allowInsecureHTTP: true }
);

app.use('/dashboard', dashboard);

/* =============================== HTTP Server =============================== */
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

/* =============================== Health =============================== */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    schema: 'unrestricted',
    userClass: 'editable'
  });
});

/* =============================== Start =============================== */
const PORT = process.env.PORT || 1337;

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('================================');
  console.log('✅ Parse Server RUNNING');
  console.log('🔓 Schema: OPEN (ALL)');
  console.log('👤 _User: EDITABLE');
  console.log(`📍 http://localhost:${PORT}/parse`);
  console.log('================================');
});

module.exports = app;
