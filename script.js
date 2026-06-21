'use strict';

// Configurações de Rede Dinâmicas baseadas no host atual
const defaultWsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const defaultServerUrl = `${defaultWsProto}//${window.location.host}`;

let ws = null;
let currentUsername = '';

/**
 * Higieniza strings para mitigar ataques de injeção de controle
 * e remove quebras maliciosas de caracteres.
 */
function sanitizeInput(str, maxLen) {
  if (typeof str !== 'string') return '';
  let cleaned = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  cleaned = cleaned.trim();
  if (maxLen && cleaned.length > maxLen) cleaned = cleaned.slice(0, maxLen);
  return cleaned;
}

/**
 * Defesa Crucial Anti-XSS: Altera apenas o nós de texto (textContent).
 * Garante que payloads como <img src=x onerror=...> sejam impressos como texto puro.
 */
function renderSecureText(element, text) {
  if (element) element.textContent = text;
}

/**
 * Injeta uma nova mensagem no feed de forma isolada e segura.
 */
function appendMessageToFeed(username, message, typeClass) {
  const feedBox = document.getElementById('chatBox');
  if (!feedBox) return;

  const msgWrapper = document.createElement('div');
  msgWrapper.className = `msg ${typeClass}`;

  const metaSpan = document.createElement('strong');
  renderSecureText(metaSpan, username ? `${username}: ` : '');

  const textSpan = document.createElement('span');
  renderSecureText(textSpan, message);

  msgWrapper.appendChild(metaSpan);
  msgWrapper.appendChild(textSpan);
  
  feedBox.appendChild(msgWrapper);
  feedBox.scrollTop = feedBox.scrollHeight; // Auto-scroll
}

function updateStatus(text, isError = false) {
  const statusEl = document.getElementById('statusText');
  renderSecureText(statusEl, text);
  if (statusEl) statusEl.className = 'status' + (isError ? ' err' : '');
}

/**
 * Conexão com o Servidor de Sinalização / Transmissor do Feed
 */
function connectToFeed(serverUrl, roomHash) {
  try {
    ws = new WebSocket(serverUrl);
  } catch (e) {
    updateStatus('URL do servidor WebSocket inválida.', true);
    return;
  }

  ws.onopen = () => {
    updateStatus('Conectado.');
    // Exibe a tela do feed e esconde o formulário inicial
    document.getElementById('screenRoomForm').classList.add('hidden');
    document.getElementById('screenRoom').classList.remove('hidden');
    document.getElementById('chatBox').style.display = 'flex';
    document.getElementById('sendRow').style.display = 'flex';
    
    // Registra a conexão no canal comum do feed
    ws.send(JSON.stringify({ type: 'join', room: roomHash }));
  };

  ws.onerror = () => {
    updateStatus('Falha na comunicação com o servidor.', true);
  };

  ws.onclose = () => {
    updateStatus('Conexão encerrada.', true);
    document.getElementById('sendRow').style.display = 'none';
  };

  ws.onmessage = (event) => {
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch (_) { return; }

    if (!payload || typeof payload.type !== 'string') return;

    // Quando o servidor repassa uma mensagem enviada por outro usuário
    if (payload.type === 'signal' && payload.data) {
      const data = payload.data;
      if (data.user && data.text) {
        appendMessageToFeed(data.user, data.text, 'them');
      }
    }
  };
}

/**
 * Transmite a mensagem para todos os conectados através do WebSocket
 */
function broadcastMessage() {
  const input = document.getElementById('msgInput');
  const text = sanitizeInput(input.value, 2000);

  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  const messagePayload = {
    type: 'signal',
    data: {
      user: currentUsername,
      text: text
    }
  };

  ws.send(JSON.stringify(messagePayload));
  
  // Renderiza localmente na direita para o próprio autor
  appendMessageToFeed(currentUsername, text, 'me');
  input.value = '';
}

/**
 * Inicialização e Bind dos Eventos da DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  // Preenche dinamicamente o campo oculto do servidor com a origem correta
  const serverInput = document.getElementById('serverUrl');
  if (serverInput) serverInput.value = defaultServerUrl;

  const btnGo = document.getElementById('btnGo');
  if (btnGo) {
    btnGo.addEventListener('click', () => {
      const nameInput = document.getElementById('roomName'); // Campo reutilizado para o Nickname
      currentUsername = sanitizeInput(nameInput.value, 25) || `Anon_${Math.floor(Math.random() * 9000 + 1000)}`;
      
      const targetServer = sanitizeInput(serverInput.value, 200) || defaultServerUrl;
      
      // Criamos um identificador fixo para o Feed Global (substituindo a antiga derivação por senha)
      const globalFeedHash = 'global-feed-stream-channel';
      
      updateStatus('Entrando...');
      connectToFeed(targetServer, globalFeedHash);
    });
  }

  const btnSend = document.getElementById('btnSendMessage');
  if (btnSend) {
    btnSend.addEventListener('click', broadcastMessage);
  }

  const msgInput = document.getElementById('msgInput');
  if (msgInput) {
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') broadcastMessage();
    });
  }
});
