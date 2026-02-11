const state = {
  apiKey: null,
  model: 'gemini-3.0-flash',
  systemPrompt: null,
  messages: []
};

function el(sel){ return document.querySelector(sel); }
function addMsg(role, text){
  state.messages.push({ role, text });
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'user' ? 'user' : 'assistant');
  const meta = document.createElement('div');
  meta.className = 'meta';
  meta.textContent = role;
  const body = document.createElement('div');
  body.textContent = text;
  div.appendChild(meta);
  div.appendChild(body);
  el('#chat').appendChild(div);
  el('#chat').scrollTop = el('#chat').scrollHeight;
}

function openModal(){ el('#modal').classList.add('open'); }
function closeModal(){ el('#modal').classList.remove('open'); }

function loadKey(){
  const k = sessionStorage.getItem('GEMINI_API_KEY');
  const m = sessionStorage.getItem('GEMINI_MODEL');
  if (k) state.apiKey = k;
  if (m) state.model = m;
}

function saveKey(){
  sessionStorage.setItem('GEMINI_API_KEY', state.apiKey);
  sessionStorage.setItem('GEMINI_MODEL', state.model);
}

async function geminiGenerate(userText){
  if (!state.apiKey) throw new Error('Missing API key');

  const url = https://generativelanguage.googleapis.com/v1beta/models/:generateContent?key=;

  const contents = [];
  for (const m of state.messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }]
    });
  }

  // Add the latest user turn (also already in state.messages; kept simple).
  // contents is built from state.messages, so no need to append.

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: state.systemPrompt }] },
    contents
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = (data && (data.error && data.error.message)) ? data.error.message : JSON.stringify(data);
    throw new Error(msg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  return text || '(empty)';
}

async function onSend(){
  const ta = el('#input');
  const text = (ta.value || '').trim();
  if (!text) return;
  ta.value = '';

  addMsg('user', text);

  el('#send').disabled = true;
  try {
    const out = await geminiGenerate(text);
    addMsg('assistant', out);
  } catch (e) {
    addMsg('assistant', 'Error: ' + (e?.message || e));
  } finally {
    el('#send').disabled = false;
  }
}

function bind(){
  el('#send').addEventListener('click', onSend);
  el('#input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) onSend();
  });

  el('#openSettings').addEventListener('click', openModal);
  el('#saveSettings').addEventListener('click', () => {
    state.apiKey = (el('#apiKey').value || '').trim();
    state.model = (el('#model').value || '').trim() || state.model;
    saveKey();
    closeModal();
  });
}

function init(systemPrompt, hello){
  state.systemPrompt = systemPrompt;
  loadKey();
  bind();

  if (!state.apiKey) openModal();

  addMsg('assistant', hello);
}
