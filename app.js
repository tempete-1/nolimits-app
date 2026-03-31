// Telegram WebApp init
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0a0a0a');
  tg.setBackgroundColor('#0a0a0a');
}

const state = {
  mode: 'generate',
  tab: 'generate',
  photos: {},
};

// ── Tabs ──
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
    document.getElementById(`page-${tab}`).style.display = 'block';
  });
});

// ── Mode Select ──
document.getElementById('mode-select').addEventListener('change', (e) => {
  const mode = e.target.value;
  state.mode = mode;
  document.querySelectorAll('.mode-panel').forEach(p => p.style.display = 'none');
  document.getElementById(`mode-${mode}`).style.display = 'block';
});

// ── Toggle Buttons ──
document.querySelectorAll('.btn-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    if (!group) return;
    document.querySelectorAll(`.btn-toggle[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── Count Dots ──
document.querySelectorAll('.count-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    const group = dot.dataset.group;
    if (!group) return;
    document.querySelectorAll(`.count-dot[data-group="${group}"]`).forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
  });
});

// ── Brush buttons ──
let brushMode = 'brush';
document.querySelectorAll('.brush-btn[data-group="brush"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (!btn.dataset.val) return;
    document.querySelectorAll('.brush-btn[data-group="brush"]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    brushMode = btn.dataset.val;
  });
});

// ── Face Swap toggle ──
function toggleFacePhoto() {
  setTimeout(() => {
    const active = document.querySelector('.btn-toggle.active[data-group="gen-sub"]');
    const faceCard = document.getElementById('gen-face-card');
    if (active && faceCard) {
      faceCard.style.display = active.dataset.val === 'faceswap' ? 'block' : 'none';
    }
  }, 10);
}

// ── Sliders ──
function bindSlider(sliderId, displayId) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (slider && display) {
    slider.addEventListener('input', () => display.textContent = slider.value);
  }
}
bindSlider('gen-lora', 'gen-lora-val');
bindSlider('inp-cfg', 'inp-cfg-val');
bindSlider('inp-steps', 'inp-steps-val');
bindSlider('easy-denoise', 'easy-denoise-val');
bindSlider('easy-steps', 'easy-steps-val');
bindSlider('dark-denoise', 'dark-denoise-val');
bindSlider('dark-steps', 'dark-steps-val');
bindSlider('brush-size', 'brush-size-val');

// ── Photo Upload ──
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

    // Show after-photo controls
    showAfterPhoto(currentUploadTarget, dataUrl);
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

function showAfterPhoto(target, dataUrl) {
  // Map upload target to after-photo div
  const map = { 'inp': 'inp-after-photo', 'vid': 'vid-after-photo', 'easy': 'easy-after-photo', 'dark': 'dark-after-photo' };
  const id = map[target];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'block';
  }
  // Load mask for inpaint
  if (target === 'inp') loadImageToMask(dataUrl);
}

function removePhoto(target, event) {
  event.stopPropagation();
  delete state.photos[target];
  const zone = document.getElementById(`${target}-upload`);
  if (zone) {
    zone.classList.remove('has-image');
    zone.innerHTML = `
      <span class="upload-plus">+</span>
      <span class="upload-text">Tap to upload or paste</span>
    `;
  }
  // Hide after-photo controls
  const map = { 'inp': 'inp-after-photo', 'vid': 'vid-after-photo', 'easy': 'easy-after-photo', 'dark': 'dark-after-photo' };
  const id = map[target];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
}

// ── Mask Drawing ──
const maskCanvas = document.getElementById('mask-canvas');
const maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;
let isDrawing = false;

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
}

function clearMask() {
  if (!maskCtx) return;
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  if (state.photos['inp']) loadImageToMask(state.photos['inp']);
}

// ── Tags / Presets ──
function appendTag(inputId, tag) {
  const el = document.getElementById(inputId);
  if (el) {
    const cur = el.value.trim();
    el.value = cur ? `${cur}, ${tag}` : tag;
  }
}

function addPreset(preset) {
  const inputs = document.querySelectorAll('.scene-input');
  for (const input of inputs) {
    if (!input.value.trim()) { input.value = preset; break; }
  }
}

// ── Enhance Prompt ──
async function enhancePrompt(inputId) {
  const el = document.getElementById(inputId);
  if (!el || !el.value.trim()) return;
  const btn = el.parentElement.querySelector('.btn-enhance');
  const original = btn.textContent;
  btn.textContent = 'enhancing...';
  btn.disabled = true;
  try {
    if (tg) tg.sendData(JSON.stringify({ action: 'enhance', prompt: el.value, input_id: inputId }));
  } catch (e) { console.error(e); }
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2000);
}

// ── Collect State ──
function getActiveVal(group) {
  const el = document.querySelector(`.btn-toggle.active[data-group="${group}"]`);
  return el ? el.dataset.val : null;
}
function getCountVal(group) {
  const el = document.querySelector(`.count-dot.active[data-group="${group}"]`);
  return el ? parseInt(el.dataset.val) : 1;
}

function collectState() {
  const mode = state.mode;
  const base = { mode };

  if (mode === 'generate') {
    return { ...base,
      prompt: document.getElementById('gen-prompt').value,
      sub_mode: getActiveVal('gen-sub'),
      aspect: getActiveVal('gen-aspect'),
      lora_strength: parseFloat(document.getElementById('gen-lora').value),
      count: getCountVal('gen-count'),
      face_photo: state.photos['gen-face'] || null,
    };
  }
  if (mode === 'inpaint') {
    return { ...base,
      prompt: document.getElementById('inp-prompt').value,
      negative: document.getElementById('inp-negative').value,
      cfg: parseFloat(document.getElementById('inp-cfg').value),
      steps: parseInt(document.getElementById('inp-steps').value),
      count: getCountVal('inp-count'),
      photo: state.photos['inp'] || null,
      mask: maskCanvas ? maskCanvas.toDataURL() : null,
    };
  }
  if (mode === 'video') {
    const scenes = [];
    document.querySelectorAll('.scene-input').forEach(input => {
      if (input.value.trim()) scenes.push(input.value.trim());
    });
    return { ...base, scenes, negative: document.getElementById('vid-negative').value, photo: state.photos['vid'] || null };
  }
  if (mode === 'edit_easy') {
    return { ...base,
      prompt: document.getElementById('easy-prompt').value,
      negative: document.getElementById('easy-negative').value,
      edit_mode: getActiveVal('easy-mode'),
      denoise: parseFloat(document.getElementById('easy-denoise').value),
      steps: parseInt(document.getElementById('easy-steps').value),
      quality: getActiveVal('easy-quality'),
      count: getCountVal('easy-count'),
      photo: state.photos['easy'] || null,
      ref_photo: state.photos['easy-ref'] || null,
    };
  }
  if (mode === 'edit_dark') {
    return { ...base,
      prompt: document.getElementById('dark-prompt').value,
      negative: document.getElementById('dark-negative').value,
      denoise: parseFloat(document.getElementById('dark-denoise').value),
      steps: parseInt(document.getElementById('dark-steps').value),
      quality: getActiveVal('dark-quality'),
      count: getCountVal('dark-count'),
      photo: state.photos['dark'] || null,
    };
  }
  return base;
}

// ── Actions ──
function generate() { sendToBot({ ...collectState(), action: 'generate' }); }
function generateVideo() { sendToBot({ ...collectState(), action: 'generate_video' }); }
function editImage() { sendToBot({ ...collectState(), action: 'edit' }); }
function darkBeast() { sendToBot({ ...collectState(), action: 'dark_beast' }); }
function buyTokens(amount, stars) { sendToBot({ action: 'buy_tokens', amount, stars }); }
function buyPremium() { sendToBot({ action: 'buy_premium', stars: 1500 }); }

function sendToBot(data) {
  if (tg) {
    tg.sendData(JSON.stringify(data));
  } else {
    console.log('Would send to bot:', data);
    alert('Data sent (check console)');
  }
}
