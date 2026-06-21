'use strict';

let ws = null;
let myUsername = '';

function sanitize(str, max) {
  if (typeof str !== 'string') return '';
  let clean = str.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  return max ? clean.trim().slice(0, max) : clean.trim();
}

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    document.getElementById('statusText').textContent = 'Online';
    document.getElementById('chatBox').style.display = 'flex';
    document.getElementById('sendRow').style.display = 'flex';
  };

  ws.onerror = () => { document.getElementById('statusText').textContent = 'Erro na conexão.'; };
  ws.onclose = () => { document.getElementById('sendRow').style.style.display = 'none'; };

  ws.onmessage = (event) => {
    let payload;
    try { payload = JSON.parse(event.data); } catch(_) { return; }
    if (payload && payload.type === 'feed_broadcast' && payload.data) {
      printMessage(sanitize(payload.data.user, 25), sanitize(payload.data.text, 2000), 'them');
    }
  };
}

function printMessage(user, text, className) {
  const box = document.getElementById('chatBox');
  const wrapper = document.createElement('div');
  wrapper.className = `msg ${className}`;
  wrapper.innerHTML = `<strong></strong> <span></span>`;
  wrapper.querySelector('strong').textContent = user ? `${user}: ` : '';
  wrapper.querySelector('span').textContent = text;
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
}

function sendBroadcast() {
  const input = document.getElementById('msgInput');
  const text = sanitize(input.value, 2000);
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(JSON.stringify({ type: 'feed_message', data: { user: myUsername, text: text } }));
  printMessage(myUsername, text, 'me');
  input.value = '';
}

// Vinculação direta sem esperar DOMContentLoaded para garantir a execução
const roomInput = document.getElementById('roomName');
if(roomInput) {
  roomInput.oninput = (e) => {
    const val = sanitize(e.target.value, 25);
    e.target.value = val;
    document.getElementById('roomNameCount').textContent = `${val.length}/25`;
  };
}

const btnGo = document.getElementById('btnGo');
if(btnGo) {
  btnGo.onclick = () => {
    myUsername = sanitize(roomInput.value, 25) || 'Anon';
    document.getElementById('screenJoin').classList.add('hidden');
    document.getElementById('screenFeed').classList.remove('hidden');
    initWebSocket();
  };
}

document.getElementById('btnSend').onclick = sendBroadcast;
document.getElementById('msgInput').onkeydown = (e) => { if (e.key === 'Enter') sendBroadcast(); };
