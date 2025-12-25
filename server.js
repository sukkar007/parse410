import express from 'express';
import { ParseServer } from 'parse-server';
import ParseDashboard from 'parse-dashboard';
import http from 'http';

const app = express();

// إعداد Parse Server
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  databaseURI: process.env.DATABASE_URI || 'mongodb://localhost:27017/dev',
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  cloud: process.env.CLOUD_MAIN || './cloud/main.js'
});

// ربط Parse على مسار /parse
app.use('/parse', parseServer);

// إعداد Dashboard اختياري
const dashboard = new ParseDashboard({
  apps: [
    {
      serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
      appId: process.env.APP_ID || 'myAppId',
      masterKey: process.env.MASTER_KEY || 'myMasterKey',
      appName: 'MyParseApp'
    }
  ],
  users: [
    { user: process.env.DASHBOARD_USER || 'admin', pass: process.env.DASHBOARD_PASS || 'pass' }
  ]
}, true);

app.use('/dashboard', dashboard);

// بدء السيرفر
const httpServer = http.createServer(app);
httpServer.listen(process.env.PORT || 1337, () => {
  console.log(`Parse Server running at ${process.env.SERVER_URL || 'http://localhost:1337/parse'}`);
});
