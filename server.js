// PEA - Servidor Unificado (HTTP + Feed WebSocket Aberto)
// -----------------------------------------------------------------
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_MSG_BYTES = 64 * 1024; // 64KB por payload

// Servidor HTTP integrado para servir o frontend na rede
const server = http.createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Rota principal: entrega o index.html direto
  if (req.url === '/' || req.url === '/index.html') {
    const filePath = path.join(__dirname, 'index.html');
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Erro interno ao carregar index.html no servidor.');
      }
      res.writeHead(200, { 
        'Content-Type': 'text/html; charset=UTF-8',
        'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self' ws: wss:; img-src 'self' data:; base-uri 'none'; form-action 'none';"
      });
      res.end(content);
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found\n');
  }
});

// Gerenciador do Feed WebSocket (Broadcast unificado)
const wss = new WebSocket.Server({ server, maxPayload: MAX_MSG_BYTES });
const connectedUsers = new Set();

wss.on('connection', (ws) => {
  connectedUsers.add(ws);

  ws.on('message', (raw) => {
    let msg;
    try { 
      msg = JSON.parse(raw.toString()); 
    } catch (_) { return; }

    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'feed_message' && msg.data) {
      const outboundPayload = JSON.stringify({
        type: 'feed_broadcast',
        data: {
          user: msg.data.user,
          text: msg.data.text
        }
      });

      for (const client of connectedUsers) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(outboundPayload);
        }
      }
    }
  });

  ws.on('close', () => {
    connectedUsers.delete(ws);
  });
});

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\x1b[32m%s\x1b[0m', '\n=================================================');
  console.log('\x1b[32m%s\x1b[0m', '   PEA LIVE FEED - MULTIUSER ONLINE');
  console.log('\x1b[32m%s\x1b[0m', '=================================================');
  console.log(`\n> Local (Nesta máquina): \x1b[36mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`> Na sua Rede Wi-Fi (Outros aparelhos): \x1b[36mhttp://${localIp}:${PORT}\x1b[0m`);
  console.log('\x1b[32m%s\x1b[0m', '\n=================================================\n');
});
