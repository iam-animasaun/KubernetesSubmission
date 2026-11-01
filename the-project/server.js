const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const cacheDir = process.env.CACHE_DIR || path.join(__dirname, 'cache');
const imagePath = path.join(cacheDir, 'image.jpg');
const IMAGE_URL = 'https://picsum.photos/1200';
const MAX_AGE_MS = 10 * 60 * 1000;

fs.mkdirSync(cacheDir, { recursive: true });

// --- Image cache -----------------------------------------------------------

// Node hides the real reason for "fetch failed" in err.cause, so dig it out.
function describe(err) {
  const c = err.cause;
  if (!c) return err.message;
  const inner = c.errors ? c.errors.map((e) => e.code || e.message).join(', ') : c.code || c.message;
  return `${err.message} (${inner})`;
}

let fetching = null;

function fetchNewImage() {
  if (fetching) return fetching;
  fetching = (async () => {
    const res = await fetch(IMAGE_URL);
    if (!res.ok) throw new Error(`picsum returned ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const tmp = imagePath + '.tmp';
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, imagePath); // new file => new mtime
    console.log('Fetched a new image');
  })().finally(() => {
    fetching = null;
  });
  return fetching;
}

async function getImage() {
  let stat = null;
  try {
    stat = fs.statSync(imagePath);
  } catch {}

  if (!stat) {
    await fetchNewImage(); // nothing cached yet, so we have to wait
  } else if (Date.now() - stat.mtimeMs > MAX_AGE_MS) {
    // Too old: serve the old one this time, refresh for the next request.
    fetchNewImage().catch((err) => console.error(describe(err)));
  }
  return fs.readFileSync(imagePath);
}

// --- Page ------------------------------------------------------------------

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Todo app</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #f0f0f0; margin: 0; padding: 2rem 1rem; color: #333; }
    main { max-width: 36rem; margin: 0 auto; background: #fff; padding: 1.5rem; border-radius: 6px; text-align: center; }
    img { width: 100%; max-width: 22rem; aspect-ratio: 1; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
    .caption { color: #666; font-size: .9rem; }
    form { display: flex; gap: .5rem; justify-content: center; margin: 1.5rem 0 .25rem; }
    input { flex: 1; max-width: 22rem; padding: .5rem; border: 2px solid #4caf50; border-radius: 4px; font-size: 1rem; }
    button { background: #4caf50; color: #fff; border: 0; border-radius: 4px; padding: .5rem 1.25rem; font-size: 1rem; cursor: pointer; }
    #count { color: #666; font-size: .8rem; }
    #error { color: #c62828; min-height: 1.2em; margin: .25rem 0 0; }
    ul { list-style: none; padding: 0; text-align: left; }
    li { background: #f9f9f9; border-left: 4px solid #4caf50; padding: .75rem 1rem; margin-bottom: .5rem; border-radius: 4px; }
  </style>
</head>
<body>
  <main>
    <h1>Todo App</h1>
    <img src="/image" alt="Random picture">
    <p class="caption">DevOps with Kubernetes 2026</p>
    <form id="form">
      <input id="todo" type="text" maxlength="140" placeholder="Enter a new todo (max 140 characters)" required>
      <button type="submit">Send</button>
    </form>
    <span id="count">0/140</span>
    <p id="error" role="alert"></p>
    <h2>Todos</h2>
    <ul id="list"></ul>
  </main>
  <script>
    var input = document.getElementById('todo');
    var count = document.getElementById('count');
    var list = document.getElementById('list');
    var form = document.getElementById('form');
    var errorEl = document.getElementById('error');

    function render(todos) {
      list.textContent = '';
      todos.forEach(function (t) {
        var li = document.createElement('li');
        li.textContent = t.text;
        list.appendChild(li);
      });
    }

    function load() {
      fetch('/todos')
        .then(function (r) {
          if (!r.ok) throw new Error('bad status');
          return r.json();
        })
        .then(render)
        .catch(function () {
          errorEl.textContent = 'Could not load todos';
        });
    }

    input.addEventListener('input', function () {
      count.textContent = input.value.length + '/140';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errorEl.textContent = '';
      fetch('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ todo: input.value }),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (!r.ok) throw new Error(body.error || 'Could not save todo');
          });
        })
        .then(function () {
          input.value = '';
          count.textContent = '0/140';
          load();
        })
        .catch(function (err) {
          errorEl.textContent = err.message;
        });
    });

    load();
  </script>
</body>
</html>
`;

// --- Server ----------------------------------------------------------------

const server = http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  if (req.method === 'GET' && url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(page);
  }

  if (req.method === 'GET' && url === '/image') {
    try {
      const img = await getImage();
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' });
      return res.end(img);
    } catch (err) {
      console.error(describe(err));
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      return res.end('Could not get an image\n');
    }
  }

  if (req.method === 'GET' && url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  // For testing only: crash the container to check the cache survives.
  if (req.method === 'POST' && url === '/shutdown' && process.env.ENABLE_SHUTDOWN === 'true') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Shutting down\n');
    return setTimeout(() => process.exit(1), 100);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found\n');
});

server.listen(port, () => {
  console.log(`Server started in port ${port}`);
});
