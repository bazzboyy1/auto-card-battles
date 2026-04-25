'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
};

http.createServer((req, res) => {
  const urlPath  = req.url.split('?')[0];
  const filePath = urlPath === '/' ? '/index.html' : urlPath;
  const full = path.join(__dirname, filePath);
  const mime = MIME[path.extname(full)] || 'text/plain';

  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Auto-Card Battles dev server: http://localhost:${PORT}`));
