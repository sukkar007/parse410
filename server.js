const express = require('express');
const { ParseServer } = require('parse-server');
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');
const cors = require('cors');

/* ===============================
   S3 Files Adapter
   =============================== */
const S3Adapter = require('@parse/s3-files-adapter');

/* ===============================
   Initialize Express
   =============================== */
const app = express();

/* ===============================
   Trust Proxy (مهم جدًا لـ Render)
   =============================== */
app.set('trust proxy', 1);

/* ===============================
   CORS Configuration
   =============================== */
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://frococs.onrender.com',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://localhost:5173'
    ];

    if (!origin || allowedOrigins.includes(origin) || origin.includes('onrender.com')) {
      callback(null, true);
    } else {
      console.warn('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'X-Parse-Application-Id',
    'X-Parse-Master-Key',
    'X-Parse-Session-Token',
    'X-Parse-REST-API-Key',
    'X-Parse-Client-Key',
    'Authorization'
  ],
  exposedHeaders: [
    'X-Parse-Application-Id',
    'X-Parse-Session-Token'
  ],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/* ===============================
   Middleware
   =============================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===============================
   Request Logging
   =============================== */
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    console.log(`📊 [${req.method}] ${req.url} - ${res.statusCode} - ${duration}ms`);
  });
  next();
});

/* ===============================
   Static Files لموقعك فقط
   =============================== */
app.use('/', express.static(path.join(__dirname, 'public_html')));

/* ===============================
   Firebase Push (معطّل)
   =============================== */
let pushConfig = undefined;
console.log('⚠️ Firebase Push disabled — running without push notifications');

/* ===============================
   S3 Adapter Configuration
   =============================== */
const s3Adapter = new S3Adapter(
  process.env.AWS_ACCESS_KEY_ID,
  process.env.AWS_SECRET_ACCESS_KEY,
  process.env.AWS_BUCKET,
  {
    region: process.env.AWS_REGION || 'ap-southeast-1',
    directAccess: true // false = الوصول عبر Parse API
  }
);

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

  serverURL: process.env.SERVER_URL,
  publicServerURL: process.env.SERVER_URL,

  cloud: path.join(__dirname, 'cloud/main.js'),

  filesAdapter: s3Adapter, // 🔹 استخدم S3 Adapter

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

/* ===============================
   Mount Parse API
   =============================== */
app.use('/parse', parseServer);

/* ===============================
   Parse Dashboard
   =============================== */
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
  { allowInsecureHTTP: false }
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
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/* ===============================
   Server Info
   =============================== */
app.get('/api/server-info', (req, res) => {
  res.json({
    name: process.env.APP_NAME || 'Parse Server',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
    serverURL: process.env.SERVER_URL,
    corsEnabled: true
  });
});

/* ===============================
   404 Handler
   =============================== */
app.use((req, res) => {
  console.warn('⚠️ 404 Not Found:', req.url);
  res.status(404).json({ code: 404, message: 'Not Found', url: req.url });
});

/* ===============================
   Error Handling
   =============================== */
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', {
    message: err.message,
    url: req.url,
    method: req.method,
    origin: req.get('origin'),
    timestamp: new Date().toISOString()
  });

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ code: 403, message: 'CORS policy violation', error: err.message });
  }

  res.status(err.status || 500).json({ code: err.status || 500, message: err.message || 'Internal Server Error' });
});

/* ===============================
   Start Server
   =============================== */
const PORT = process.env.PORT || 1337;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 Running');
  console.log(`📍 ${process.env.SERVER_URL}`);
  console.log('📊 Dashboard: /dashboard');
  console.log('🌐 CORS: Enabled');
  console.log('════════════════════════════════════');
  console.log('🔍 Health Check: /health');
  console.log('🔍 Server Info: /api/server-info');
  console.log('════════════════════════════════════');
});

/* ===============================
   Process Safety
   =============================== */
process.on('unhandledRejection', (reason) => console.error('❌ Unhandled Rejection:', reason));
process.on('uncaughtException', (error) => { console.error('❌ Uncaught Exception:', error); process.exit(1); });
process.on('SIGTERM', () => { console.log('🔴 SIGTERM received'); httpServer.close(() => process.exit(0)); });
process.on('SIGINT', () => { console.log('🔴 SIGINT received'); httpServer.close(() => process.exit(0)); });

module.exports = app;
