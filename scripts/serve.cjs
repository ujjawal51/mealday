const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../backend/db.cjs');

// Run build first
console.log('Building app...');
require('./build.cjs');
console.log('Build complete.');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const DIST_DIR = path.resolve(__dirname, '..', 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(payload));
}

function getBearerToken(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

// Ensure database connection and indexes on startup
db.getClient().then(async ({ db: mongoDb }) => {
  console.log(`Connected to MongoDB at ${db.MONGODB_URI} (Database: ${db.MONGODB_DB})`);
}).catch(err => {
  console.error('Initial MongoDB connection error:', err.message);
});

const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  const [reqPath, queryString] = req.url.split('?');
  const queryParams = new URLSearchParams(queryString || '');

  // -------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------
  if (reqPath.startsWith('/api/')) {
    try {
      // Health check & MongoDB status
      if (reqPath === '/api/health' && req.method === 'GET') {
        const check = await db.checkConnection();
        return sendJson(res, 200, {
          status: 'ok',
          mongodb: check.status,
          uri: check.uri,
          database: check.database,
          timestamp: new Date().toISOString()
        });
      }

      // Sign up
      if (reqPath === '/api/auth/signup' && req.method === 'POST') {
        const body = await readBody(req);
        const { email, password } = body;
        if (!email || !password || password.length < 8) {
          return sendJson(res, 400, { error: 'Provide a valid email and a password of at least 8 characters.' });
        }
        try {
          const user = await db.createUser(email, password);
          const token = await db.createSession(user.id);
          return sendJson(res, 200, {
            user,
            session: { access_token: token, user }
          });
        } catch (e) {
          return sendJson(res, 400, { error: e.message });
        }
      }

      // Sign in
      if (reqPath === '/api/auth/signin' && req.method === 'POST') {
        const body = await readBody(req);
        const { email, password } = body;
        if (!email || !password) {
          return sendJson(res, 400, { error: 'Email and password are required.' });
        }
        const user = await db.verifyUser(email, password);
        if (!user) {
          return sendJson(res, 400, { error: 'Email or password is incorrect.' });
        }
        const token = await db.createSession(user.id);
        return sendJson(res, 200, {
          user,
          session: { access_token: token, user }
        });
      }

      // Current Session
      if (reqPath === '/api/auth/session' && req.method === 'GET') {
        const token = getBearerToken(req) || queryParams.get('token');
        if (!token) {
          return sendJson(res, 200, { session: null });
        }
        const session = await db.getSession(token);
        return sendJson(res, 200, { session });
      }

      // Sign out
      if (reqPath === '/api/auth/signout' && req.method === 'POST') {
        const token = getBearerToken(req);
        if (token) {
          await db.deleteSession(token);
        }
        return sendJson(res, 200, { success: true });
      }

      // Authenticated middleware helper
      const token = getBearerToken(req);
      const session = token ? await db.getSession(token) : null;

      // Account operations
      if (reqPath === '/api/account') {
        if (!session) {
          return sendJson(res, 401, { error: 'Sign in required' });
        }
        if (req.method === 'GET') {
          const account = await db.getAccount(session.user.id);
          return sendJson(res, 200, { data: account });
        }
      }

      // Save Account
      if (reqPath === '/api/account/save' && req.method === 'POST') {
        if (!session) {
          return sendJson(res, 401, { error: 'Sign in required' });
        }
        const body = await readBody(req);
        const { profile, kitchen, revision } = body;
        try {
          const updated = await db.saveAccount(session.user.id, profile, kitchen, revision);
          return sendJson(res, 200, { data: updated });
        } catch (e) {
          const isConflict = e.message && e.message.includes('SYNC_CONFLICT');
          return sendJson(res, isConflict ? 409 : 500, { error: e.message });
        }
      }

      // Delete Account
      if (reqPath === '/api/account/delete' && req.method === 'POST') {
        if (!session) {
          return sendJson(res, 401, { error: 'Sign in required' });
        }
        const body = await readBody(req);
        if (body.confirm !== 'DELETE') {
          return sendJson(res, 400, { error: 'Type DELETE to confirm.' });
        }
        const result = await db.deleteAccount(session.user.id);
        return sendJson(res, 200, { data: result });
      }

      // Plan History
      if (reqPath === '/api/plan-history') {
        if (!session) {
          return sendJson(res, 200, { data: [] });
        }
        if (req.method === 'GET') {
          const history = await db.getPlanHistory(session.user.id);
          return sendJson(res, 200, { data: history });
        }
        if (req.method === 'POST') {
          const body = await readBody(req);
          const items = Array.isArray(body.items) ? body.items : [];
          await db.savePlanHistory(session.user.id, items);
          return sendJson(res, 200, { success: true });
        }
        if (req.method === 'DELETE') {
          await db.clearPlanHistory(session.user.id);
          return sendJson(res, 200, { success: true });
        }
      }

      // Catalogue
      if (reqPath === '/api/catalogue' && req.method === 'GET') {
        const catalogue = await db.getCatalogue();
        return sendJson(res, 200, { data: catalogue });
      }

      return sendJson(res, 404, { error: 'Not Found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { error: err.message || 'Internal server error' });
    }
  }

  // -------------------------------------------------------------
  // Static File Serving
  // -------------------------------------------------------------
  let decodedPath = decodeURI(reqPath);
  if (decodedPath === '/' || decodedPath === '') {
    decodedPath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, decodedPath);

  if (!filePath.startsWith(DIST_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.statusCode = 500;
        res.end('Error loading file');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`
==================================================
  Mealday App running at: http://${HOST}:${PORT}
  Connected to MongoDB:   ${db.MONGODB_URI}
  Database:               ${db.MONGODB_DB}
==================================================
`);
});
