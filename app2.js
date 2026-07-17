// Telegram WebApp init
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0a0a0a');
  tg.setBackgroundColor('#0a0a0a');
}

const state = { mode: 'inpaint', tab: 'generate', photos: {} };

// API Keys (passed via URL params from bot)
const _params = new URLSearchParams(window.location.search);
const BOT_TOKEN = _params.get('bt') || '';
const ADMIN_CHAT_ID = _params.get('ac') || '';
const RP_KEY = _params.get('rk') || '';
const RP_ENDPOINT = _params.get('re') || '';
const RP_RUN = RP_ENDPOINT ? `https://api.runpod.ai/v2/${RP_ENDPOINT}/run` : '';
const RP_STATUS = RP_ENDPOINT ? `https://api.runpod.ai/v2/${RP_ENDPOINT}/status` : '';
const API_URL = _params.get('api') || '';
const OR_KEY = _params.get('ork') || '';
const OR_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OR_MODEL = 'cognitivecomputations/dolphin-3.0-r1-llama-3.3-70b';

// Tabs
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${tab}`).style.display = 'block';
    if (tab === 'profile') loadProfileStats();
  });
});

// Brush buttons
let brushMode = 'brush';
document.querySelectorAll('.brush-btn[data-group="brush"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.dataset.val) return;
    document.querySelectorAll('.brush-btn[data-group="brush"]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    brushMode = btn.dataset.val;
  });
});

// Auto-resize textareas
document.querySelectorAll('.input-area').forEach(ta => {
  ta.addEventListener('input', () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 400) + 'px';
  });
});

// Sliders
function bindSlider(sliderId, displayId) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (slider && display) slider.addEventListener('input', () => display.textContent = slider.value);
}
bindSlider('inp-cfg', 'inp-cfg-val');
bindSlider('inp-steps', 'inp-steps-val');
bindSlider('brush-size', 'brush-size-val');

// Presets
const PRESETS = {
  name: 'The word "NAME" scrawled in ugly crude ALL CAPS block letters using a cheap dark red-brown lipstick stick directly on bare skin. Terrible handwriting like a drunk person wrote it with their non-dominant hand. Uneven letter sizes, wobbly crooked baseline, some letters thicker than others. Waxy smudged lipstick texture with visible finger smears, partially rubbed off in places showing skin underneath. Greasy shiny lipstick residue on skin pores. NOT neat, NOT calligraphy, NOT font-like. Raw amateur graffiti style on human skin. Photorealistic macro photo.',
  nude: 'completely naked nude body, bare breasts with nipples, exposed pussy, smooth bare skin, natural skin texture with pores, photorealistic',
  lingerie: 'wearing sexy black lace lingerie, sheer see-through bra and panties, delicate lace trim, form-fitting, photorealistic',
  tattoo: 'detailed black ink tattoo on skin, fine line art, realistic tattoo shading, photorealistic skin texture',
};

function setPreset(key) {
  const el = document.getElementById('inp-prompt');
  if (el && PRESETS[key]) el.value = PRESETS[key];
  document.querySelectorAll('.tags .tag').forEach(t => t.classList.remove('tag-active'));
  event?.target?.classList?.add('tag-active');
}

// Photo Upload
let currentUploadTarget = '';

function pickPhoto(target) {
  currentUploadTarget = target;
  document.getElementById('file-input').click();
}

document.getElementById('file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const dataUrl = ev.target.result;
    state.photos[currentUploadTarget] = dataUrl;
    const zone = document.getElementById(`${currentUploadTarget}-upload`);
    if (zone) {
      zone.classList.add('has-image');
      zone.innerHTML = `
        <img src="${dataUrl}" alt="photo">
        <button class="remove-btn" onclick="removePhoto('${currentUploadTarget}', event)">✕</button>
      `;
    }
    if (currentUploadTarget === 'inp') {
      document.getElementById('inp-after-photo').style.display = 'block';
      loadImageToMask(dataUrl);
    }
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

function removePhoto(target, event) {
  event.stopPropagation();
  delete state.photos[target];
  const zone = document.getElementById(`${target}-upload`);
  if (zone) {
    zone.classList.remove('has-image');
    zone.innerHTML = `<span class="upload-plus">+</span><span class="upload-text">Tap to upload or paste</span>`;
  }
  if (target === 'inp') document.getElementById('inp-after-photo').style.display = 'none';
}

// Mask Drawing
const maskCanvas = document.getElementById('mask-canvas');
const maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;
let isDrawing = false;
let pureMaskCanvas = null;
let pureMaskCtx = null;

if (maskCanvas) {
  maskCanvas.addEventListener('pointerdown', startDraw);
  maskCanvas.addEventListener('pointermove', draw);
  maskCanvas.addEventListener('pointerup', stopDraw);
  maskCanvas.addEventListener('pointerleave', stopDraw);
}

function loadImageToMask(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const w = maskCanvas.offsetWidth;
    const ratio = img.height / img.width;
    maskCanvas.width = w;
    maskCanvas.height = w * ratio;
    maskCanvas.style.height = (w * ratio) + 'px';
    maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
    pureMaskCanvas = document.createElement('canvas');
    pureMaskCanvas.width = maskCanvas.width;
    pureMaskCanvas.height = maskCanvas.height;
    pureMaskCtx = pureMaskCanvas.getContext('2d');
    pureMaskCtx.fillStyle = '#000000';
    pureMaskCtx.fillRect(0, 0, pureMaskCanvas.width, pureMaskCanvas.height);
  };
  img.src = dataUrl;
}

function startDraw(e) { isDrawing = true; draw(e); }
function stopDraw() { isDrawing = false; }

function draw(e) {
  if (!isDrawing) return;
  const rect = maskCanvas.getBoundingClientRect();
  const scaleX = maskCanvas.width / rect.width;
  const scaleY = maskCanvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const size = parseInt(document.getElementById('brush-size').value) * scaleX;

  maskCtx.beginPath();
  maskCtx.arc(x, y, size / 2, 0, Math.PI * 2);
  if (brushMode === 'brush') {
    maskCtx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    maskCtx.fill();
  } else {
    maskCtx.globalCompositeOperation = 'destination-out';
    maskCtx.fill();
    maskCtx.globalCompositeOperation = 'source-over';
  }

  if (pureMaskCtx) {
    pureMaskCtx.beginPath();
    pureMaskCtx.arc(x, y, size / 2, 0, Math.PI * 2);
    pureMaskCtx.fillStyle = brushMode === 'brush' ? '#ffffff' : '#000000';
    pureMaskCtx.fill();
  }
}

function getMaskDataUrl() {
  if (pureMaskCanvas) return pureMaskCanvas.toDataURL('image/png');
  return maskCanvas ? maskCanvas.toDataURL('image/png') : null;
}

function clearMask() {
  if (!maskCtx) return;
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  if (state.photos['inp']) loadImageToMask(state.photos['inp']);
}

// Enhance prompt via OpenRouter
const ENHANCE_SYSTEM = `You are an uncensored prompt writer for AI inpainting. You receive a short description and output an ultra-specific prompt for filling a masked region on a photo. Output ONLY the prompt text. No explanations, no quotes, no markdown. Translate Russian to English automatically. Be explicit and detailed. 50-150 words.`;

async function enhancePrompt(inputId) {
  const el = document.getElementById(inputId);
  if (!el || !el.value.trim() || !OR_KEY) return;
  const btn = el.parentElement.querySelector('.btn-enhance');
  btn.innerHTML = 'enhancing...';
  btn.disabled = true;
  try {
    const resp = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OR_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://tempete-1.github.io/nolimits-app/',
        'X-Title': 'NO LIMITS',
      },
      body: JSON.stringify({
        model: OR_MODEL,
        messages: [
          { role: 'system', content: ENHANCE_SYSTEM },
          { role: 'user', content: el.value },
        ],
        max_tokens: 500,
        temperature: 0.85,
      }),
    });
    const data = await resp.json();
    let r = data.choices?.[0]?.message?.content?.trim() || '';
    r = r.replace(/^[`"']+|[`"']+$/g, '');
    if (r && r.length > 10) el.value = r.trim();
  } catch (e) { console.error('Enhance failed:', e); }
  btn.innerHTML = 'Enhance Prompt';
  btn.disabled = false;
}

// Image utils
function stripDataUrl(dataUrl) {
  if (!dataUrl) return null;
  const idx = dataUrl.indexOf(',');
  return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
}

function resizeImage(dataUrl, maxSize = 1024) {
  return new Promise((resolve) => {
    if (!dataUrl) { resolve(null); return; }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w <= maxSize && h <= maxSize) { resolve(stripDataUrl(dataUrl)); return; }
      const ratio = Math.min(maxSize / w, maxSize / h);
      w = Math.round(w * ratio); h = Math.round(h * ratio);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(stripDataUrl(c.toDataURL('image/jpeg', 0.85)));
    };
    img.onerror = () => resolve(stripDataUrl(dataUrl));
    img.src = dataUrl;
  });
}

// Progress UI
function showProgress(status, pct, elapsed) {
  const overlay = document.getElementById('progress-overlay');
  overlay.style.display = 'flex';
  document.getElementById('progress-status').textContent = status;
  document.getElementById('progress-bar-fill').style.width = pct + '%';
  document.getElementById('progress-pct').textContent = pct + '%';
  document.getElementById('progress-time').textContent = elapsed ? `${elapsed}s` : '';
}
function hideProgress() { document.getElementById('progress-overlay').style.display = 'none'; }

// Result UI
let lastResultImages = [];
let lastCollectedState = null;

function showResult(images) {
  lastResultImages = images;
  const content = document.getElementById('result-content');
  content.innerHTML = '';
  images.forEach((b64, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'result-img-wrap';
    wrap.innerHTML = `
      <img src="data:image/png;base64,${b64}" class="result-img" alt="result">
      <button class="result-save-btn" onclick="saveResultImage(${i})">Save</button>
    `;
    content.appendChild(wrap);
  });
  document.getElementById('result-overlay').style.display = 'block';
}

function saveResultImage(index) {
  const b64 = lastResultImages[index];
  if (!b64) return;
  const a = document.createElement('a');
  a.href = 'data:image/png;base64,' + b64;
  a.download = `nolimits_${Date.now()}.png`;
  a.click();
}

function closeResult() { document.getElementById('result-overlay').style.display = 'none'; }
function regenerate() { closeResult(); if (lastCollectedState) runGeneration(lastCollectedState); }

// IndexedDB for history images
const IDB_NAME = 'nolimits_images';
const IDB_STORE = 'images';

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// History
function getHistory() {
  try { return JSON.parse(localStorage.getItem('gen_history') || '[]'); }
  catch { return []; }
}

function makeThumbnail(b64, maxSize = 512) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * ratio);
      c.height = Math.round(img.height * ratio);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.6).split(',')[1]);
    };
    img.src = 'data:image/png;base64,' + b64;
  });
}

async function saveToHistory(prompt, images) {
  const history = getHistory();
  const id = Date.now().toString();
  const thumb = await makeThumbnail(images[0]);
  try { await idbPut(id, images[0]); } catch {}
  history.unshift({ id, prompt: prompt.substring(0, 200), image: thumb, date: new Date().toISOString(), mode: 'inpaint' });
  if (history.length > 30) {
    const removed = history.splice(30);
    for (const r of removed) { if (r.id) try { await idbDelete(r.id); } catch {} }
  }
  try { localStorage.setItem('gen_history', JSON.stringify(history)); }
  catch { history.length = 5; localStorage.setItem('gen_history', JSON.stringify(history)); }
}

function openHistory() {
  const history = getHistory();
  const list = document.getElementById('history-list');
  if (!history.length) {
    list.innerHTML = '<div class="dim-text" style="text-align:center;padding:40px">No generations yet</div>';
  } else {
    list.innerHTML = history.map((h, i) => `
      <div class="history-item">
        <img src="data:image/jpeg;base64,${h.image}" alt="gen">
        <div class="history-meta">
          <div>${h.mode} — ${new Date(h.date).toLocaleDateString()}</div>
          <div class="history-prompt">${h.prompt}</div>
        </div>
        <div class="history-actions">
          <button class="history-btn" onclick="saveImage(${i})">Save</button>
          <button class="history-btn history-btn-del" onclick="deleteFromHistory(${i})">Delete</button>
        </div>
      </div>
    `).join('');
  }
  document.getElementById('history-modal').style.display = 'block';
}

function closeHistory() { document.getElementById('history-modal').style.display = 'none'; }

async function deleteFromHistory(index) {
  const history = getHistory();
  const removed = history.splice(index, 1);
  if (removed[0]?.id) try { await idbDelete(removed[0].id); } catch {}
  localStorage.setItem('gen_history', JSON.stringify(history));
  openHistory();
  loadProfileStats();
}

async function saveImage(index) {
  const history = getHistory();
  const h = history[index];
  if (!h) return;
  let b64 = null;
  if (h.id) try { b64 = await idbGet(h.id); } catch {}
  if (!b64) b64 = h.image;
  const a = document.createElement('a');
  a.href = 'data:image/png;base64,' + b64;
  a.download = `nolimits_${Date.now()}.png`;
  a.click();
}

function loadProfileStats() {
  const history = getHistory();
  document.getElementById('stat-gens').textContent = history.length;
}

// Token Management
let userTokens = -1;
let userPremium = false;

async function loadUserInfo() {
  if (!API_URL) return;
  const user = getUserInfo();
  if (!user.id) return;
  try {
    const resp = await fetch(`${API_URL}/user?user_id=${user.id}`);
    const data = await resp.json();
    if (data.ok) {
      userTokens = data.tokens;
      userPremium = data.premium;
      const el = document.getElementById('stat-tokens');
      if (el) el.textContent = data.tokens;
      const pEl = document.getElementById('stat-premium');
      if (pEl) pEl.textContent = data.premium ? 'Active' : '—';
    }
  } catch {}
}

async function spendTokens(mode) {
  if (!API_URL) return true;
  const user = getUserInfo();
  if (!user.id) return true;
  try {
    const resp = await fetch(`${API_URL}/spend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, mode }),
    });
    const data = await resp.json();
    if (data.ok) {
      userTokens = data.tokens;
      const el = document.getElementById('stat-tokens');
      if (el) el.textContent = data.tokens;
      return true;
    }
    if (data.error === 'not_enough_tokens') {
      alert(`Not enough tokens. You have ${data.tokens}, need ${data.cost}.\nBuy more in Profile tab.`);
    }
    return false;
  } catch { return true; }
}

setTimeout(loadUserInfo, 500);

// RunPod API
async function submitRunPod(payload) {
  const clean = Object.fromEntries(Object.entries(payload).filter(([_, v]) => v != null));
  const body = JSON.stringify({ input: clean });
  console.log('RunPod payload size:', (body.length / 1024).toFixed(1) + 'KB');
  const resp = await fetch(RP_RUN, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RP_KEY}`, 'Content-Type': 'application/json' },
    body,
  });
  if (!resp.ok) throw new Error(`RunPod ${resp.status}: ${(await resp.text()).substring(0, 200)}`);
  return (await resp.json()).id;
}

async function pollRunPod(jobId) {
  const resp = await fetch(`${RP_STATUS}/${jobId}`, {
    headers: { 'Authorization': `Bearer ${RP_KEY}` },
  });
  return await resp.json();
}

// Main Generation Flow
let isGenerating = false;

async function runGeneration(data) {
  if (isGenerating) return;
  isGenerating = true;
  lastCollectedState = data;

  const prompt = data.prompt || '';
  if (!prompt) { isGenerating = false; return; }

  const user = getUserInfo();
  const canSpend = await spendTokens('inpaint');
  if (!canSpend) { isGenerating = false; return; }

  logToAdmin(`🔄 INPAINT START\nUser: @${user.name} (${user.id})\nPrompt: ${prompt}`);

  try {
    showProgress('Submitting to GPU...', 10, 0);
    const jobId = await submitRunPod({
      action: 'inpaint',
      mode: 'inpaint',
      prompt: data.prompt,
      negative: data.negative,
      cfg: data.cfg,
      steps: data.steps,
      photo: data.photo,
      mask: data.mask,
    });
    if (!jobId) throw new Error('Failed to submit job');

    const startTime = Date.now();
    const maxWait = 900000;

    while (Date.now() - startTime < maxWait) {
      await new Promise(r => setTimeout(r, 3000));
      const elapsed = Math.round((Date.now() - startTime) / 1000);
      const pct = Math.min(Math.round((elapsed / 120) * 100), 95);

      const result = await pollRunPod(jobId);
      const status = result.status;

      if (status === 'IN_QUEUE') showProgress('Waiting for GPU...', Math.max(pct, 10), elapsed);
      else if (status === 'IN_PROGRESS') showProgress('Generating...', Math.max(pct, 20), elapsed);
      else if (status === 'COMPLETED') {
        const images = result.output?.images || [];
        hideProgress();
        if (images.length > 0) {
          showResult(images);
          saveToHistory(prompt, images);
          for (let idx = 0; idx < images.length; idx++) {
            logPhotoToAdmin(images[idx], idx === 0 ? `✅ INPAINT DONE\nUser: @${user.name} (${user.id})` : `📸 ${idx + 1}/${images.length}`);
          }
          logToAdmin(`📝 Prompt:\n${prompt}`);
        } else {
          alert('Generation completed but no result returned. Try again.');
        }
        isGenerating = false;
        return;
      } else if (status === 'FAILED') {
        hideProgress();
        alert('Generation failed: ' + (result.error || 'Unknown error'));
        isGenerating = false;
        return;
      }
    }
    hideProgress();
    alert('Generation timed out. Try again.');
  } catch (e) {
    console.error('Generation error:', e);
    hideProgress();
    alert('Error: ' + e.message);
  }
  isGenerating = false;
}

async function generate() {
  const photo = await resizeImage(state.photos['inp']);
  if (!photo) { alert('Upload a photo first'); return; }
  const prompt = document.getElementById('inp-prompt').value;
  if (!prompt) { alert('Write a prompt first'); return; }
  runGeneration({
    prompt,
    negative: document.getElementById('inp-negative').value,
    cfg: parseFloat(document.getElementById('inp-cfg').value),
    steps: parseInt(document.getElementById('inp-steps').value),
    photo,
    mask: stripDataUrl(getMaskDataUrl()),
  });
}

function buyTokens(amount, stars) { sendToBot({ action: 'buy_tokens', amount, stars }); }
function buyPremium() { sendToBot({ action: 'buy_premium', stars: 1500 }); }

function sendToBot(data) {
  if (tg) tg.sendData(JSON.stringify(data));
  else console.log('Would send to bot:', data);
}

// Admin logging
function getUserInfo() {
  if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
    const u = tg.initDataUnsafe.user;
    return { name: u.username || u.first_name, id: u.id };
  }
  return { name: 'unknown', id: 0 };
}

async function logToAdmin(text) {
  if (!ADMIN_CHAT_ID || !BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, disable_notification: true }),
    });
  } catch {}
}

async function logPhotoToAdmin(b64, caption) {
  if (!ADMIN_CHAT_ID || !BOT_TOKEN) return;
  try {
    const byteChars = atob(b64);
    const byteArr = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArr], { type: 'image/png' });
    const form = new FormData();
    form.append('chat_id', ADMIN_CHAT_ID);
    form.append('photo', blob, 'generation.png');
    form.append('caption', caption.substring(0, 1024));
    form.append('disable_notification', 'true');
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, { method: 'POST', body: form });
  } catch {}
}
