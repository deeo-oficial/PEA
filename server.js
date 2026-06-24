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

// Transmite a lista de nicks atualizada para todos os conectados
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

    // 1. LOGIN DE USUÁRIO (Garantia de Nick Único)
    if (msg.type === 'login') {
      const targetNick = msg.nick ? msg.nick.trim() : '';
      
      // Bloqueia nicks vazios, duplicados ou termos reservados do sistema
      if (!targetNick || activeUsers.has(targetNick) || targetNick.toLowerCase() === 'global') {
        ws.send(JSON.stringify({ type: 'login_response', success: false, reason: 'Nick inválido, reservado ou já em uso.' }));
        return;
      }

      ws.authenticatedNick = targetNick;
      activeUsers.set(targetNick, ws);
      
      ws.send(JSON.stringify({ type: 'login_response', success: true, nick: targetNick }));
      broadcastUserList();
      return;
    }

    if (!ws.authenticatedNick) return;

    // 2. ROTEAMENTO DE MENSAGENS (MODO HÍBRIDO)
    if (msg.type === 'chat_message' && msg.text) {
      const textClean = msg.text.trim();
      
      if (msg.to === 'GLOBAL') {
        // Modo Feed Global: Envia em broadcast para TODOS os usuários ativos na plataforma
        const globalPayload = JSON.stringify({
          type: 'global_msg_receive',
          from: ws.authenticatedNick,
          text: textClean
        });
        
        for (const client of activeUsers.values()) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(globalPayload);
          }
        }
      } else if (msg.to) {
        // Modo Privado (DM): Envia apenas para o alvo específico
        const targetClient = activeUsers.get(msg.to);
        if (targetClient && targetClient.readyState === WebSocket.OPEN) {
          targetClient.send(JSON.stringify({
            type: 'private_msg_receive',
            from: ws.authenticatedNick,
            text: textClean
          }));
        }
      }
    }
  });

  ws.on('close', () => {
    if (ws.authenticatedNick) {
      activeUsers.delete(ws.authenticatedNick);
      broadcastUserList();
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
  console.log(`Servidor PEA (Global + Privado) rodando na porta ${PORT}`);
});
