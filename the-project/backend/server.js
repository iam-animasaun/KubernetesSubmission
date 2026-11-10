const http = require('http');
const { Pool } = require('pg');
 
// --- Logging: one JSON object per line, easy to search in Grafana/Loki ---
 
function log(level, msg, fields = {}) {
  console.log(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }));
}
 
// --- Configuration (all from environment variables, nothing hard coded) ---
 
function requiredString(name) {
  const value = process.env[name];
  if (!value) {
    log('error', `Environment variable ${name} must be set`);
    process.exit(1);
  }
  return value;
}
 
function requiredInt(name) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value <= 0) {
    log('error', `Environment variable ${name} must be set to a positive integer`);
    process.exit(1);
  }
  return value;
}
 
const port = requiredInt('PORT');
const maxTodoLength = requiredInt('MAX_TODO_LENGTH');
 
const pool = new Pool({
  host: requiredString('DB_HOST'),
  port: requiredInt('DB_PORT'),
  database: requiredString('DB_NAME'),
  user: requiredString('DB_USER'),
  password: requiredString('DB_PASSWORD'),
});
// An idle connection dropping (for example when the database restarts) must not crash the app.
pool.on('error', (err) => log('error', 'database pool error', { error: err.message }));
 
// --- Database --------------------------------------------------------------
 
let dbReady = false;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
 
// The database pod may start after this one, so keep trying until it answers.
async function initDb() {
  for (;;) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS todos (
          id SERIAL PRIMARY KEY,
          text TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
      dbReady = true;
      log('info', 'connected to database');
      return;
    } catch (err) {
      log('warn', 'database not ready, retrying', { error: err.code || err.message });
      await sleep(2000);
    }
  }
}
 
// --- HTTP ------------------------------------------------------------------
 
function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
 
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10_000) {
        reject(new Error('too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}
 
const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  const started = process.hrtime.bigint();
 
  // Kubernetes probes /healthz every few seconds, so it is left out to keep the logs readable.
  res.on('finish', () => {
    if (url === '/healthz') return;
    log('info', 'request', {
      method: req.method,
      path: url,
      status: res.statusCode,
      durationMs: Number((process.hrtime.bigint() - started) / 1000000n),
    });
  });
 
  try {
    // Ready only when the database answers, so Kubernetes holds traffic until then.
    if (req.method === 'GET' && url === '/healthz') {
      await pool.query('SELECT 1');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end('ok');
    }
 
    if (url === '/todos' && !dbReady) {
      return send(res, 503, { error: 'Database not ready' });
    }
 
    if (req.method === 'GET' && url === '/todos') {
      const { rows } = await pool.query('SELECT id, text FROM todos ORDER BY id');
      return send(res, 200, rows);
    }
 
    if (req.method === 'POST' && url === '/todos') {
      let body;
      try {
        body = await readJson(req);
      } catch {
        log('warn', 'todo rejected', { reason: 'body is not valid JSON' });
        return send(res, 400, { error: 'Request body must be JSON like {"todo": "text"}' });
      }
      const text = typeof body.todo === 'string' ? body.todo.trim() : '';
      if (!text) {
        log('warn', 'todo rejected', { reason: 'empty' });
        return send(res, 400, { error: 'Todo cannot be empty' });
      }
      if (text.length > maxTodoLength) {
        log('warn', 'todo rejected', {
          reason: 'too long',
          length: text.length,
          limit: maxTodoLength,
          todo: text,
        });
        return send(res, 400, { error: `Todo cannot be longer than ${maxTodoLength} characters` });
      }
      const { rows } = await pool.query(
        'INSERT INTO todos (text) VALUES ($1) RETURNING id, text',
        [text]
      );
      log('info', 'todo created', { id: rows[0].id, length: text.length, todo: text });
      return send(res, 201, rows[0]);
    }
 
    send(res, 404, { error: 'Not found' });
  } catch (err) {
    log('error', 'request failed', { path: url, error: err.code || err.message });
    if (url === '/healthz') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('database unavailable');
    }
    send(res, 500, { error: 'Something went wrong' });
  }
});
 
server.listen(port, () => {
  log('info', 'todo-backend started', { port, maxTodoLength });
  initDb();
});
