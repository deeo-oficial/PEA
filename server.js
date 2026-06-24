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

// Mapeamento de usuários ativos: Nickname -> WebSocket
const activeUsers = new Map();

// Função para transmitir a lista de usuários online atualizada para todos
function broadcastUserList() {
  const listPayload = JSON.stringify({
    type: 'user_list',
    users: Array.from(activeUsers.keys())
  });
  for (const client of activeUsers.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(listPayload);
    }
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.authenticatedNick = null;

  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch (_) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    // 1. TENTATIVA DE LOGIN (Validação de Nick Único)
    if (msg.type === 'login') {
      const targetNick = msg.nick ? msg.nick.trim() : '';
      
      if (!targetNick || activeUsers.has(targetNick)) {
        ws.send(JSON.stringify({ type: 'login_response', success: false, reason: 'Nick já em uso ou inválido.' }));
        return;
      }

      ws.authenticatedNick = targetNick;
      activeUsers.set(targetNick, ws);
      
      ws.send(JSON.stringify({ type: 'login_response', success: true, nick: targetNick }));
      broadcastUserList(); // Atualiza a barra lateral de todo mundo
      return;
    }

    // Se o usuário tentar mandar algo sem estar logado, ignora
    if (!ws.authenticatedNick) return;

    // 2. ROTEAMENTO DE MENSAGEM PRIVADA
    if (msg.type === 'private_message' && msg.to && msg.text) {
      const targetClient = activeUsers.get(msg.to);
      if (targetClient && targetClient.readyState === WebSocket.OPEN) {
        targetClient.send(JSON.stringify({
          type: 'private_msg_receive',
          from: ws.authenticatedNick,
          text: msg.text
        }));
      }
    }
  });

  ws.on('close', () => {
    if (ws.authenticatedNick) {
      activeUsers.delete(ws.authenticatedNick);
      broadcastUserList(); // Atualiza a barra lateral após a saída
    }
  });
});

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      if (ws.authenticatedNick) activeUsers.delete(ws.authenticatedNick);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => { clearInterval(interval); });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Chat Privado PEA ativo na porta ${PORT}`);
});
