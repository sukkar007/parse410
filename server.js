const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const path = require('path');
const http = require('http');
const B2 = require('backblaze-b2'); // npm i backblaze-b2

const app = express(); // __dirname لا تحتاج لتعريفه

// Trust Proxy
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Files
app.use('/', express.static(path.join(__dirname, 'public_html')));

// Backblaze B2 setup
const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID || '3ff2cfbeee04',
  applicationKey: process.env.B2_APPLICATION_KEY || '005ab4454c98830468aa3cb458c870d1bf036f4a3e'
});

// Parse Server
const parseServer = new ParseServer({
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',
  restAPIKey: process.env.REST_API_KEY || 'myRestApiKey',
  databaseURI: process.env.DATABASE_URI,
  serverURL: process.env.SERVER_URL,
  publicServerURL: process.env.SERVER_URL,
  filesAdapter: undefined, // إذا أردت يمكن إنشاء adapter B2 هنا
  liveQuery: { classNames: ['*'] },
  allowClientClassCreation: true,
  allowCustomObjectId: true,
  defaultLimit: 100,
  maxLimit: 1000,
  logLevel: 'info'
});
app.use('/parse', parseServer.app);

// Parse Dashboard
const dashboard = new ParseDashboard({
  apps: [{
    serverURL: process.env.SERVER_URL,
    appId: process.env.APP_ID || 'myAppId',
    masterKey: process.env.MASTER_KEY || 'myMasterKey',
    appName: 'Flamingo Parse App'
  }],
  users: [{
    user: process.env.DASHBOARD_USER || 'admin',
    pass: process.env.DASHBOARD_PASS || 'admin123'
  }]
}, { allowInsecureHTTP: true });
app.use('/dashboard', dashboard);

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Error Handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
});

// HTTP + LiveQuery
const httpServer = http.createServer(app);
ParseServer.createLiveQueryServer(httpServer);

const PORT = process.env.PORT || 1337;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server Running');
  console.log(`📍 ${process.env.SERVER_URL}`);
  console.log('📊 Dashboard: /dashboard');
  console.log('📁 Files: Backblaze B2 (Direct Access)');
  console.log('════════════════════════════════════');
});

// Process Safety
process.on('unhandledRejection', reason => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', error => { console.error('Uncaught Exception:', error); process.exit(1); });

module.exports = app;
