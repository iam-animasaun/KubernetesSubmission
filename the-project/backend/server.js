const http = require('http');
const { Pool } = require('pg');

// --- Configuration (all from environment variables, nothing hard coded) ---

function requiredString(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Environment variable ${name} must be set`);
    process.exit(1);
  }
  return value;
}

function requiredInt(name) {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value) || value <= 0) {
    console.error(`Environment variable ${name} must be set to a positive integer`);
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
pool.on('error', (err) => console.error(`Database pool error: ${err.message}`));

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
      console.log('Connected to database');
      return;
    } catch (err) {
      console.error(`Database not ready (${err.code || err.message}), retrying`);
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
        return send(res, 400, { error: 'Request body must be JSON like {"todo": "text"}' });
      }
      const text = typeof body.todo === 'string' ? body.todo.trim() : '';
      if (!text) return send(res, 400, { error: 'Todo cannot be empty' });
      if (text.length > maxTodoLength) {
        return send(res, 400, { error: `Todo cannot be longer than ${maxTodoLength} characters` });
      }
      const { rows } = await pool.query(
        'INSERT INTO todos (text) VALUES ($1) RETURNING id, text',
        [text]
      );
      console.log(`Added todo ${rows[0].id}`);
      return send(res, 201, rows[0]);
    }

    send(res, 404, { error: 'Not found' });
  } catch (err) {
    console.error(`Request failed: ${err.code || err.message}`);
    if (url === '/healthz') {
      res.writeHead(503, { 'Content-Type': 'text/plain' });
      return res.end('database unavailable');
    }
    send(res, 500, { error: 'Something went wrong' });
  }
});

server.listen(port, () => {
  console.log(`todo-backend started in port ${port}`);
  initDb();
});
