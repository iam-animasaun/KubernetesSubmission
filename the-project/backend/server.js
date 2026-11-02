const http = require('http');

// --- Configuration (all from environment variables, nothing hard coded) ---

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

// Todos live in memory for now (a database comes later), so run a single replica.
let nextId = 4;
const todos = [
  { id: 1, text: 'Learn Kubernetes basics' },
  { id: 2, text: 'Deploy application to cluster' },
  { id: 3, text: 'Configure persistent volumes' },
];

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

  if (req.method === 'GET' && url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (req.method === 'GET' && url === '/todos') {
    return send(res, 200, todos);
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
    const todo = { id: nextId++, text };
    todos.push(todo);
    console.log(`Added todo ${todo.id}`);
    return send(res, 201, todo);
  }

  send(res, 404, { error: 'Not found' });
});

server.listen(port, () => {
  console.log(`todo-backend started in port ${port}`);
});
