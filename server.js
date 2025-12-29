'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const { ParseServer } = require('parse-server');

const app = express();

/* ================= Trust Proxy ================= */
app.set('trust proxy', 1);

/* ================= Middlewares ================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ================= Static ================= */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ================= Parse Server ================= */
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',

  databaseURI: process.env.DATABASE_URI,

  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  publicServerURL: process.env.SERVER_URL || 'http://localhost:1337/parse',

  cloud: path.join(__dirname, 'cloud/main.js'),

  /* فتح عام */
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  enableAnonymousUsers: true,

  /* مهم */
  schemaCacheTTL: 0,

  /* LiveQuery */
  liveQuery: { classNames: ['*'] },

  logLevel: 'verbose'
});

/* ================= FORCE MASTERKEY FOR _User ================= */
app.use('/parse/classes/_User', (req, res, next) => {
  req.headers['x-parse-master-key'] = process.env.MASTER_KEY || 'myMasterKey';
  next();
});

/* ================= Mount ================= */
app.use('/parse', parseServer);

/* ================= HTTP ================= */
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

/* ================= Health ================= */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    userSchema: 'auto',
    mode: 'force-masterkey'
  });
});

/* ================= Start ================= */
const PORT = process.env.PORT || 1337;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('====================================');
  console.log('✅ Parse Server RUNNING');
  console.log('👤 _User: AUTO FIELDS ENABLED');
  console.log('🔓 Schema: DYNAMIC');
  console.log(`📍 /parse`);
  console.log('====================================');
});

module.exports = app;
