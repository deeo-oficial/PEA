'use strict';

let ws = null;
let myUsername = '';

// Defesa Anti-XSS Camada 1: Higienização contra caracteres de controle invisíveis
function sanitize(str, max) {
  if (typeof str !== 'string') return '';
  let clean = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  clean = clean.trim();
  return max ? clean.slice(0, max) : clean;
}

// Defesa Anti-XSS Camada 2: Escrita segura via textContent pura
function safeRender(element, text) {
  if (element) element.textContent = text;
}

function printMessage(user, text, className) {
  const box = document.getElementById('chatBox');
  if (!box) return;

  const wrapper = document.createElement('div');
  wrapper.className = `msg ${className}`;

  const boldUser = document.createElement('strong');
  safeRender(boldUser, user ? `${user}: ` : '');

  const spanText = document.createElement('span');
  safeRender(spanText, text);

  wrapper.appendChild(boldUser);
  wrapper.appendChild(spanText);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
}

function updateStatus(text, isErr = false) {
  const el = document.getElementById('statusText');
  safeRender(el, text);
  if (el) el.className = 'status' + (isErr ? ' err' : '');
}

function initWebSocket() {
  // Configuração automática e dinâmica de protocolo (WS ou WSS global)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    updateStatus('Online no Feed Global');
    document.getElementById('chatBox').style.display = 'flex';
    document.getElementById('sendRow').style.display = 'flex';
  };

  ws.onerror = () => updateStatus('Erro de conexão com o feed.', true);
  ws.onclose = () => {
    updateStatus('Conexão encerrada.', true);
    document.getElementById('sendRow').style.display = 'none';
  };

  ws.onmessage = (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch(_) { return; }

    if (payload && payload.type === 'feed_broadcast' && payload.data) {
      const rUser = sanitize(payload.data.user, 25);
      const rText = sanitize(payload.data.text, 2000);
      printMessage(rUser, rText, 'them');
    }
  };
}

function sendBroadcast() {
  const input = document.getElementById('msgInput');
  const text = sanitize(input.value, 2000);

  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({
    type: 'feed_message',
    data: { user: myUsername, text: text }
  }));

  printMessage(myUsername, text, 'me');
  input.value = '';
}

// Event Listeners Mapeados
document.getElementById('usernameInput').addEventListener('input', (e) => {
  const val = sanitize(e.target.value, 25);
  e.target.value = val;
  safeRender(document.getElementById('charCount'), `${val.length}/25`);
});

document.getElementById('btnEnter').addEventListener('click', () => {
  const inputName = document.getElementById('usernameInput').value;
  myUsername = sanitize(inputName, 25) || `Anon_${Math.floor(Math.random() * 9000 + 1000)}`;

  document.getElementById('screenJoin').classList.add('hidden');
  document.getElementById('screenFeed').classList.remove('hidden');

  initWebSocket();
});

document.getElementById('btnSend').addEventListener('click', sendBroadcast);
document.getElementById('msgInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendBroadcast();
});
