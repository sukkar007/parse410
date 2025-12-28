const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');

const app = express();

/* ===============================
   Trust Proxy (مهم جدًا لـ Render)
   =============================== */
app.set('trust proxy', 1);

/* ===============================
   Middleware
   =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Static Files لموقعك فقط
   =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Firebase Push (معطّل)
   =============================== */
let pushConfig = undefined;
console.log('⚠️ Firebase Push disabled');

/* ===============================
   Start Server (ASYNC – مهم جدًا)
   =============================== */
async function startServer() {
  /* ===============================
     Parse Server Configuration
     =============================== */
  const parseServer = new ParseServer({
    appId: process.env.APP_ID,
    masterKey: process.env.MASTER_KEY,
    clientKey: process.env.CLIENT_KEY,
    fileKey: process.env.FILE_KEY,
    restAPIKey: process.env.REST_API_KEY,

    databaseURI: process.env.DATABASE_URI,

    serverURL: process.env.SERVER_URL,        // HTTPS
    publicServerURL: process.env.SERVER_URL, // Dashboard

    cloud: path.join(__dirname, 'cloud/main.js'),

    /* ✅ التخزين الصحيح على Render */
    filesAdapter: {
      module: 'parse-server/lib/Adapters/Files/GridFSAdapter',
      options: {
        databaseURI: process.env.DATABASE_URI
      }
    },

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

    push: pushConfig,
    logLevel: process.env.LOG_LEVEL || 'info'
  });

  /* 🔴 السطر الأهم – بدونه يظهر خطأ filesController */
  await parseServer.start();

  /* ===============================
     Mount Parse API
     =============================== */
  app.use('/parse', parseServer.app);

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
          serverURL: process.env.SERVER_URL,
          appId: process.env.APP_ID,
          masterKey: process.env.MASTER_KEY,
          appName: process.env.APP_NAME || 'MyParseApp'
        }
      ],
      users: [
        {
          user: process.env.DASHBOARD_USER,
          pass: process.env.DASHBOARD_PASS
        }
      ]
    },
    {
      allowInsecureHTTP: false
    }
  );

  app.use('/dashboard', dashboard);

  /* ===============================
     Health Check
     =============================== */
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString()
    });
  });

  /* ===============================
     Error Handling
     =============================== */
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  /* ===============================
     HTTP + LiveQuery Server
     =============================== */
  const httpServer = http.createServer(app);
  ParseServer.createLiveQueryServer(httpServer);

  const PORT = process.env.PORT || 1337;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log('════════════════════════════════════');
    console.log('✅ Parse Server Running');
    console.log(`📍 ${process.env.SERVER_URL}`);
    console.log('📊 Dashboard: /dashboard');
    console.log('📁 Files: GridFS (MongoDB)');
    console.log('════════════════════════════════════');
  });
}

/* ===============================
   Boot
   =============================== */
startServer().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
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
