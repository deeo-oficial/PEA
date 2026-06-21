const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Erro interno ao carregar index.html');
      }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      res.end(content);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n');
  }
});

const wss = new WebSocket.Server({ server });
const connectedUsers = new Set();

wss.on('connection', (ws) => {
  connectedUsers.add(ws);
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
    if (msg && msg.type === 'feed_message' && msg.data) {
      const outbound = JSON.stringify({
        type: 'feed_broadcast',
        data: { user: msg.data.user, text: msg.data.text }
      });
      for (const client of connectedUsers) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(outbound);
        }
      }
    }
  });
  ws.on('close', () => { connectedUsers.delete(ws); });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor ativo na porta ${PORT}`);
});
