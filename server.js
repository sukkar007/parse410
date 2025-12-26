import express from 'express';
import { ParseServer } from 'parse-server';
import ParseDashboard from 'parse-dashboard';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// إعداد Parse Server مع جميع الميزات
const parseServer = new ParseServer({
  // معرّفات التطبيق
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || 'myMasterKey',
  clientKey: process.env.CLIENT_KEY || 'myClientKey',
  fileKey: process.env.FILE_KEY || 'myFileKey',
  
  // قاعدة البيانات
  databaseURI: process.env.DATABASE_URI || 'mongodb://localhost:27017/dev',
  
  // عنوان الخادم
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
  
  // Cloud Code
  cloud: process.env.CLOUD_MAIN || path.join(__dirname, 'cloud/main.js'),
  
  // Live Query - تفعيل جميع الفئات
  liveQuery: {
    classNames: ['*'], // تفعيل Live Query لجميع الفئات
    redisURL: process.env.REDIS_URL // اختياري للإنتاج
  },
  
  // الصلاحيات - تفعيل كامل
  allowClientClassCreation: true, // السماح بإنشاء فئات جديدة من العميل
  allowCustomObjectId: true, // السماح بـ Object IDs مخصصة
  
  // الملفات
  filesAdapter: {
    module: '@parse/fs-files-adapter',
    params: {
      filesSubDir: 'files'
    }
  },
  
  // الصلاحيات الافتراضية - إعطاء صلاحيات كاملة للجميع
  defaultLimit: 100,
  maxLimit: 1000,
  
  // REST API
  restAPIKey: process.env.REST_API_KEY || 'myRestApiKey',
  
  // Java Key (إن كان مطلوباً)
  javaKey: process.env.JAVA_KEY || 'myJavaKey',
  
  // تسجيل الأخطاء
  logLevel: process.env.LOG_LEVEL || 'info',
  
  // الأمان
  enforcePrivateUsers: false, // السماح بقراءة بيانات المستخدمين
  
  // GraphQL
  graphQLPath: '/graphql',
  graphQLPlaygroundPath: '/graphql-playground',
  
  // الإشعارات (اختياري)
  push: {
    android: {
      senderId: process.env.ANDROID_SENDER_ID || '',
      apiKey: process.env.ANDROID_API_KEY || ''
    }
  }
});

// ربط Parse على مسار /parse
app.use('/parse', parseServer);

// إعداد Dashboard
const dashboard = new ParseDashboard({
  apps: [
    {
      serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
      appId: process.env.APP_ID || 'myAppId',
      masterKey: process.env.MASTER_KEY || 'myMasterKey',
      clientKey: process.env.CLIENT_KEY || 'myClientKey',
      fileKey: process.env.FILE_KEY || 'myFileKey',
      restApiKey: process.env.REST_API_KEY || 'myRestApiKey',
      appName: process.env.APP_NAME || 'MyParseApp'
    }
  ],
  users: [
    {
      user: process.env.DASHBOARD_USER || 'admin',
      pass: process.env.DASHBOARD_PASS || 'admin123'
    }
  ],
  useEncryptedPasswords: false
}, true);

app.use('/dashboard', dashboard);

// إعداد Live Query Server
const httpServer = http.createServer(app);

// تهيئة Live Query Server
const parseLiveQueryServer = ParseServer.createLiveQueryServer(httpServer);

// معالج الأخطاء
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// مسار الصحة
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    parseServer: 'running',
    liveQuery: 'enabled',
    dashboard: 'available'
  });
});

// مسار معلومات التطبيق
app.get('/info', (req, res) => {
  res.json({
    name: 'Parse Server 4.10.4',
    version: '4.10.4',
    features: {
      parseServer: true,
      dashboard: true,
      liveQuery: true,
      cloudCode: true,
      graphQL: true
    },
    endpoints: {
      parse: '/parse',
      dashboard: '/dashboard',
      graphql: '/parse/graphql',
      graphqlPlayground: '/parse/graphql-playground',
      health: '/health'
    }
  });
});

// بدء السيرفر
const PORT = process.env.PORT || 1337;
const HOST = process.env.HOST || '0.0.0.0';

httpServer.listen(PORT, HOST, () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log('✅ Parse Server 4.10.4 is running!');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📍 Server URL: ${process.env.SERVER_URL || `http://localhost:${PORT}/parse`}`);
  console.log(`🎯 Parse API: http://${HOST}:${PORT}/parse`);
  console.log(`📊 Dashboard: http://${HOST}:${PORT}/dashboard`);
  console.log(`🔄 Live Query: ws://${HOST}:${PORT}`);
  console.log(`📈 GraphQL: http://${HOST}:${PORT}/parse/graphql`);
  console.log(`🎮 GraphQL Playground: http://${HOST}:${PORT}/parse/graphql-playground`);
  console.log(`💚 Health Check: http://${HOST}:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('📝 Dashboard Credentials:');
  console.log(`   Username: ${process.env.DASHBOARD_USER || 'admin'}`);
  console.log(`   Password: ${process.env.DASHBOARD_PASS || 'admin123'}`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('🔑 API Keys:');
  console.log(`   App ID: ${process.env.APP_ID || 'myAppId'}`);
  console.log(`   Master Key: ${process.env.MASTER_KEY || 'myMasterKey'}`);
  console.log(`   Client Key: ${process.env.CLIENT_KEY || 'myClientKey'}`);
  console.log(`   REST API Key: ${process.env.REST_API_KEY || 'myRestApiKey'}`);
  console.log('═══════════════════════════════════════════════════════');
});

// معالجة الأخطاء غير المعالجة
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
