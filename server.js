const express = require('express');
const { ParseServer, FilesAdapter } = require('parse-server'); // ✅ استيراد FilesAdapter
const ParseDashboard = require('parse-dashboard');
const http = require('http');
const path = require('path');
const B2 = require('backblaze-b2'); // npm i backblaze-b2

const app = express();
app.set('trust proxy', 1); // مهم لـ Render

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
Backblaze B2 Adapter
=============================== */
class B2FilesAdapter extends FilesAdapter { // ✅ الوراثة من FilesAdapter
    constructor(options) {
        super(); // ✅ استدعاء super()
        this.bucketName = options.bucketName;
        this.b2 = new B2({
            applicationKeyId: options.applicationKeyId,
            applicationKey: options.applicationKey,
        });
    }

    async createFile(config, filename, data, contentType) {
        const uploadUrlResponse = await this.b2.getUploadUrl({ bucketId: this.bucketName });
        const uploadUrl = uploadUrlResponse.data.uploadUrl;
        const uploadAuthToken = uploadUrlResponse.data.authorizationToken;

        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadAuthToken,
                'X-Bz-File-Name': filename,
                'Content-Type': contentType
            },
            body: data
        });

        return {
            url: `https://f000.backblazeb2.com/file/${this.bucketName}/${filename}`
        };
    }

    async deleteFile(config, filename) {
        console.log('Delete file not implemented for B2');
    }
}

/* ===============================
Parse Server Configuration
=============================== */
const parseServer = new ParseServer({
    appId: process.env.APP_ID || 'myAppId',
    masterKey: process.env.MASTER_KEY || 'myMasterKey',
    clientKey: process.env.CLIENT_KEY || 'myClientKey',
    fileKey: process.env.FILE_KEY,
    restAPIKey: process.env.REST_API_KEY,
    databaseURI: process.env.DATABASE_URI,
    serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
    publicServerURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
    cloud: path.join(__dirname, 'cloud/main.js'),
    filesAdapter: new B2FilesAdapter({
        applicationKeyId: process.env.B2_KEY_ID || '3ff2cfbeee04',
        applicationKey: process.env.B2_APPLICATION_KEY || '005ab4454c98830468aa3cb458c870d1bf036f4a3e',
        bucketName: process.env.B2_BUCKET_NAME || 'my-bucket'
    }),
    liveQuery: { classNames: ['*'], redisURL: process.env.REDIS_URL },
    allowClientClassCreation: true,
    allowCustomObjectId: true,
    defaultLimit: 100,
    maxLimit: 1000,
    logLevel: process.env.LOG_LEVEL || 'info'
});

/* ===============================
Mount Parse API
=============================== */
app.use('/parse', parseServer);

/* ===============================
Parse Dashboard
=============================== */
const dashboard = new ParseDashboard(
    {
        apps: [
            {
                serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',
                appId: process.env.APP_ID || 'myAppId',
                masterKey: process.env.MASTER_KEY || 'myMasterKey',
                appName: process.env.APP_NAME || 'MyParseApp'
            }
        ],
        users: [
            {
                user: process.env.DASHBOARD_USER || 'admin',
                pass: process.env.DASHBOARD_PASS || 'admin123'
            }
        ]
    },
    { allowInsecureHTTP: true }
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
    res.status(200).json({ status: 'ok' });
});

/* ===============================
Start Server
=============================== */
const PORT = process.env.PORT || 1337;
httpServer.listen(PORT, () => {
    console.log(`Parse Server running on port ${PORT}`);
    console.log(`Parse API: http://localhost:${PORT}/parse`);
    console.log(`Parse Dashboard: http://localhost:${PORT}/dashboard`);
});
