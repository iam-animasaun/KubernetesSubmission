const http = require('http');
const { Pool } = require('pg');

const port = process.env.PORT || 3000;
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres-svc',
  port: 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'postgres',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function initDb() {
  for (let i = 0; i < 30; i++) {
    try {
      await pool.query(
        'CREATE TABLE IF NOT EXISTS pingpong (id INT PRIMARY KEY, counter INT NOT NULL)'
      );
      await pool.query(
        'INSERT INTO pingpong (id, counter) VALUES (1, 0) ON CONFLICT (id) DO NOTHING'
      );
      return;
    } catch (e) {
      console.log('Database not ready, retrying...');
      await sleep(2000);
    }
  }
  throw new Error('Database unavailable');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/pingpong') {
      const r = await pool.query(
        'UPDATE pingpong SET counter = counter + 1 WHERE id = 1 RETURNING counter - 1 AS n'
      );
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(`pong ${r.rows[0].n}`);
    } else if (req.method === 'GET' && req.url === '/pings') {
      const r = await pool.query('SELECT counter FROM pingpong WHERE id = 1');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(String(r.rows[0].counter));
    } else {
      res.writeHead(404);
      res.end();
    }
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('database error');
  }
});

initDb().then(() =>
  server.listen(port, () => console.log(`Server started in port ${port}`))
);
