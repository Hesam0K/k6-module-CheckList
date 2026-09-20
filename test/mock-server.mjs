/**
 * test/mock-server.mjs — سرویس ساختگی برای تست ماژول (بدون هیچ وابستگی)
 * ----------------------------------------------------------------------------
 * اجرای مستقیم:  node test/mock-server.mjs        (پیش‌فرض روی 127.0.0.1:8080)
 * استفاده در تست:  import { startServer } from './mock-server.mjs'
 *
 * مسیرها: /health /login /profile /products /products/:id /orders /orders/:id
 *         /slow?ms=N /error/500 /leak /upload /static/tiny.png /static/large.bin
 *         /limited /legacy /xml /text /insights
 */

import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';

function base64url(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createToken(userId) {
  const now = Math.floor(Date.now() / 1000);
  return [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: userId, iat: now, exp: now + 3600, role: 'admin' }),
    'mock-signature',
  ].join('.');
}

const PRODUCTS = [];
for (let i = 1; i <= 12; i += 1) {
  PRODUCTS.push({
    id: `p-${i}`,
    title: `Product ${i}`,
    price: 10 * i,
    createdAt: new Date(Date.UTC(2026, 0, i)).toISOString(),
  });
}

const ORDERS = { 'o-9001': { orderId: 'o-9001', success: true, state: 'CREATED' } };

function securityHeaders(extra) {
  return Object.assign(
    {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store',
    },
    extra || {}
  );
}

function sendJson(res, status, payload, extraHeaders) {
  const body = JSON.stringify(payload);
  res.writeHead(status, securityHeaders(Object.assign({ 'Content-Length': Buffer.byteLength(body) }, extraHeaders)));
  res.end(body);
}

function sendRaw(res, status, body, headers) {
  res.writeHead(status, headers);
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  if (header.indexOf('Bearer ') === 0 && header.length > 'Bearer '.length) {
    return true;
  }
  const cookie = req.headers.cookie || '';
  return cookie.indexOf('session_id=') !== -1;
}

async function handle(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method || 'GET';
  const delay = Number(url.searchParams.get('delay') || 0);

  const respond = async () => {
    if (path === '/health' && method === 'GET') {
      sendJson(res, 200, { status: 'ok', version: '1.0.0' });
      return;
    }

    if (path === '/login' && method === 'POST') {
      await readBody(req);
      sendJson(res, 200, { success: true, token: createToken('u-1001'), userId: 'u-1001' }, {
        'Set-Cookie': 'session_id=mock-session-1; Path=/; HttpOnly; SameSite=Strict',
      });
      return;
    }

    if (path === '/profile' && method === 'GET') {
      if (!isAuthorized(req)) {
        sendJson(res, 401, { success: false, message: 'unauthorized' });
        return;
      }
      sendJson(res, 200, { userId: 'u-1001', role: 'admin', displayName: 'Mock User' });
      return;
    }

    if (path === '/products' && method === 'GET') {
      const page = Number(url.searchParams.get('page') || 1);
      const size = Number(url.searchParams.get('size') || 5);
      const start = (page - 1) * size;
      const items = PRODUCTS.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      sendJson(res, 200, { page, size, total: items.length, items: items.slice(start, start + size) });
      return;
    }

    if (path.indexOf('/products/') === 0 && method === 'GET') {
      const id = path.replace('/products/', '');
      const product = PRODUCTS.filter((item) => item.id === id)[0];
      if (!product) {
        sendJson(res, 404, { success: false, message: 'not found' });
        return;
      }
      sendJson(res, 200, product);
      return;
    }

    if (path === '/orders' && method === 'POST') {
      await readBody(req);
      ORDERS['o-9001'] = { orderId: 'o-9001', success: true, state: 'CREATED' };
      sendJson(res, 201, ORDERS['o-9001'], { Location: '/orders/o-9001' });
      return;
    }

    if (path.indexOf('/orders/') === 0) {
      const id = path.replace('/orders/', '');
      const order = ORDERS[id];
      if (!order) {
        sendJson(res, 404, { success: false, message: 'order not found' });
        return;
      }
      if (method === 'GET') {
        sendJson(res, 200, order);
        return;
      }
      if (method === 'DELETE') {
        delete ORDERS[id];
        sendRaw(res, 204, '', { 'Cache-Control': 'no-store' });
        return;
      }
    }

    if (path === '/slow' && method === 'GET') {
      const ms = Number(url.searchParams.get('ms') || 100);
      setTimeout(() => sendJson(res, 200, { status: 'ok', sleptMs: ms }), ms);
      return;
    }

    if (path === '/error/500' && method === 'GET') {
      sendJson(res, 500, { success: false, message: 'internal error' });
      return;
    }

    if (path === '/leak' && method === 'GET') {
      sendRaw(
        res,
        500,
        'java.lang.NullPointerException: boom\nat com.example.Service.run(Service.java:42)\nstacktrace: '
          + 'SQLSTATE[42000]: you have an error in your sql syntax near SELECT * FROM users',
        securityHeaders({ 'Content-Type': 'text/plain; charset=utf-8' })
      );
      return;
    }

    if (path === '/upload' && method === 'POST') {
      const body = await readBody(req);
      sendJson(res, 201, { fileId: 'f-1001', bytes: Buffer.byteLength(body) });
      return;
    }

    if (path === '/static/tiny.png' && method === 'GET') {
      sendRaw(res, 200, Buffer.alloc(1024, 7), { 'Content-Type': 'image/png' });
      return;
    }

    if (path === '/static/large.bin' && method === 'GET') {
      sendRaw(res, 200, Buffer.alloc(60 * 1024, 3), { 'Content-Type': 'application/octet-stream' });
      return;
    }

    if (path === '/limited' && method === 'GET') {
      sendJson(res, 429, { success: false, message: 'too many requests' }, { 'Retry-After': '2' });
      return;
    }

    if (path === '/legacy' && method === 'GET') {
      res.writeHead(302, { Location: '/health' });
      res.end();
      return;
    }

    if (path === '/xml' && method === 'GET') {
      sendRaw(res, 200, '<?xml version="1.0" encoding="UTF-8"?><status>ok</status>', {
        'Content-Type': 'application/xml',
      });
      return;
    }

    if (path === '/text' && method === 'GET') {
      sendRaw(res, 200, 'plain text response', { 'Content-Type': 'text/plain; charset=utf-8' });
      return;
    }

    if (path === '/insights' && method === 'GET') {
      sendJson(res, 200, { success: true, transactionId: 't-1001', state: 'DONE' });
      return;
    }

    sendJson(res, 404, { success: false, message: `no route for ${method} ${path}` });
  };

  if (delay > 0) {
    setTimeout(() => {
      respond().catch((error) => sendJson(res, 500, { success: false, message: String(error && error.message) }));
    }, delay);
    return;
  }
  await respond();
}

/** بالا آوردن سرور (برای تست‌های Node). */
export function startServer(port) {
  const listenPort = Number(port || PORT);
  const server = http.createServer((req, res) => {
    handle(req, res).catch((error) => {
      sendJson(res, 500, { success: false, message: String(error && error.message) });
    });
  });

  return new Promise((resolve) => {
    server.listen(listenPort, HOST, () => resolve({ server, port: listenPort, host: HOST }));
  });
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry.endsWith('test/mock-server.mjs')) {
  startServer().then(({ host, port }) => {
    console.log(`mock-server ready on http://${host}:${port}`);
  });
}

