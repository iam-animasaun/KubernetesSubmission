const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 3000;
const dir = '/usr/src/app/files';
const file = path.join(dir, 'pingpong.txt');
let counter = 0;

http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/pingpong') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end(`pong ${counter}`);
    counter++;
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(file, String(counter));
  } else {
    res.writeHead(404);
    res.end();
  }
}).listen(port, () => console.log(`Server started in port ${port}`));
