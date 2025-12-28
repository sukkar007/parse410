import express from 'express';
import { ParseServer } from 'parse-server';
import ParseDashboard from 'parse-dashboard';
import path from 'path';
import http from 'http';
import B2Adapter from '@parse/b2-files-adapter'; // npm i @parse/b2-files-adapter

const __dirname = path.resolve();
const app = express();

/* ===============================
   Trust Proxy
   =============================== */
app.set('trust proxy', 1);

/* ===============================
   Middleware
   =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static Files
   =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Backblaze B2 Files Adapter
   =============================== */
const filesAdapter = new B2Adapter({
  applicationKeyId: '3ff2cfbeee04',       // KeyID
  applicationKey: '005ab4454c98830468aa3cb458c870d1bf036f4a3e', // Application Key
  bucketName: 'flamingo',                  // اسم الحاوية
  directAccess: true                        // true = روابط مباشرة للمستخدمين
});

/* ===============================
   Start Server
   =============================== */
async function startServer() {
  const parseServer = new ParseServer({
    appId: process.env.APP_ID || 'myAppId',
    masterKey: process.env.MASTER_KEY || 'myMasterKey',
    clientKey: process.env.CLIENT_KEY || 'myClientKey',
    restAPIKey: process.env.REST_API_KEY || 'myRestApiKey',

    databaseURI: process.env.DATABASE_URI,  // MongoDB Atlas

    serverURL: process.env.SERVER_URL,      // https://domain/parse
    publicServerURL: process.env.SERVER_URL,
    cloud: path.join(__dirname, 'cloud/main.js'),

    filesAdapter: filesAdapter,

    liveQuery: { classNames: ['*'] },
    allowClientClassCreation: true,
    allowCustomObjectId: true,
    defaultLimit: 100,
    maxLimit: 1000,
    logLevel: 'info'
  });

  await parseServer.start();
  app.use('/parse', parseServer.app);

  /* ===============================
     Parse Dashboard
     =============================== */
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

  /* ===============================
     Health Check
     =============================== */
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  /* ===============================
     Error Handling
     =============================== */
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
  });

  /* ===============================
     HTTP + LiveQuery
     =============================== */
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
}

/* ===============================
   Boot
   =============================== */
startServer().catch(err => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

/* ===============================
   Process Safety
   =============================== */
process.on('unhandledRejection', reason => console.error('Unhandled Rejection:', reason));
process.on('uncaughtException', error => { console.error('Uncaught Exception:', error); process.exit(1); });

export default app;
