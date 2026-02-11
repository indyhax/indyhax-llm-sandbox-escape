const state = {
  apiKey: null,
  model: null, // autodetected if not set
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
  if (state.model) sessionStorage.setItem('GEMINI_MODEL', state.model);
}

async function listModels(){
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models?key=' +
    encodeURIComponent(state.apiKey);

  const res = await fetch(url);
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : String(res.status);
    throw new Error(msg);
  }
  return (data && data.models) ? data.models : [];
}

function pickBestModel(models){
  // Prefer Gemini *Flash* models that support generateContent.
  const usable = models
    .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map(m => m.name);

  // Ordered preference list (we'll take the first present)
  const preferred = [
    'models/gemini-3-flash',
    'models/gemini-2.0-flash',
    'models/gemini-2.0-flash-lite',
    'models/gemini-1.5-flash',
    'models/gemini-1.5-flash-8b'
  ];

  for (const p of preferred){
    if (usable.includes(p)) return p.replace('models/','');
  }

  // Otherwise, pick any flash model
  const anyFlash = usable.find(n => /flash/i.test(n));
  if (anyFlash) return anyFlash.replace('models/','');

  // Fallback: anything usable
  if (usable[0]) return usable[0].replace('models/','');

  return null;
}

async function ensureModel(){
  if (state.model) return state.model;
  const models = await listModels();
  const chosen = pickBestModel(models);
  if (!chosen) throw new Error('No generateContent-capable model found for this key.');
  state.model = chosen;
  saveKey();
  return chosen;
}

async function geminiGenerate(){
  if (!state.apiKey) {
    openModal();
    throw new Error('Missing API key');
  }

  const model = await ensureModel();

  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) +
    ':generateContent?key=' +
    encodeURIComponent(state.apiKey);

  const contents = [];
  for (const m of state.messages) {
    contents.push({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.text }]
    });
  }

  const body = {
    systemInstruction: { role: 'system', parts: [{ text: state.systemPrompt }] },
    contents: contents
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data && data.error && data.error.message ? data.error.message : (data ? JSON.stringify(data) : String(res.status));
    throw new Error(msg);
  }

  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts
      ? data.candidates[0].content.parts.map(p => p.text || '').join('')
      : '';

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
    const out = await geminiGenerate();
    addMsg('assistant', out);
  } catch (e) {
    addMsg('assistant', 'Error: ' + (e && e.message ? e.message : String(e)));
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

  el('#saveSettings').addEventListener('click', async () => {
    state.apiKey = (el('#apiKey').value || '').trim();
    const requested = (el('#model').value || '').trim();
    state.model = requested || null;
    saveKey();

    if (!state.apiKey) return;

    el('#saveSettings').disabled = true;
    try {
      // Validate or auto-pick a working model immediately
      await ensureModel();
      el('#model').value = state.model;
      el('#send').disabled = false;
      closeModal();
      addMsg('assistant', 'Model selected: ' + state.model);
    } catch (e) {
      addMsg('assistant', 'Model lookup failed: ' + (e && e.message ? e.message : String(e)));
      openModal();
    } finally {
      el('#saveSettings').disabled = false;
    }
  });
}

function init(systemPrompt, hello){
  state.systemPrompt = systemPrompt;
  loadKey();
  bind();

  el('#apiKey').value = state.apiKey || '';
  el('#model').value = state.model || '';

  if (!state.apiKey) {
    el('#send').disabled = true;
    openModal();
    setTimeout(() => el('#apiKey').focus(), 50);
  }

  addMsg('assistant', hello);
}

window.state = state;
window.addMsg = addMsg;
window.geminiGenerate = geminiGenerate;
window.init = init;