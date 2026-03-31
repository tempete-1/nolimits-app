// Telegram WebApp init
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0a0a0a');
  tg.setBackgroundColor('#0a0a0a');
}

// State
const state = {
  mode: 'generate',
  tab: 'generate',
  // photos stored as data URLs
  photos: {},
};

// ── Tabs ──
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    state.tab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${tab}`).classList.remove('hidden');
  });
});

// ── Mode Select ──
document.getElementById('mode-select').addEventListener('change', (e) => {
  const mode = e.target.value;
  state.mode = mode;
  document.querySelectorAll('.mode-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`mode-${mode}`).classList.remove('hidden');
});

// ── Toggle Buttons ──
document.querySelectorAll('.btn-toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.btn-toggle[data-group="${group}"]`).forEach(b => {
      b.classList.remove('active');
    });
    btn.classList.add('active');
  });
});

// ── Sliders ──
function bindSlider(sliderId, displayId) {
  const slider = document.getElementById(sliderId);
  const display = document.getElementById(displayId);
  if (slider && display) {
    slider.addEventListener('input', () => {
      display.textContent = slider.value;
    });
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

    // Load to mask canvas if inpaint
    if (currentUploadTarget === 'inp') {
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
    zone.innerHTML = '<span>tap to upload photo</span>';
  }
}

// ── Mask Drawing ──
const maskCanvas = document.getElementById('mask-canvas');
const maskCtx = maskCanvas ? maskCanvas.getContext('2d') : null;
let isDrawing = false;
let brushMode = 'brush';

if (maskCanvas) {
  maskCanvas.addEventListener('pointerdown', startDraw);
  maskCanvas.addEventListener('pointermove', draw);
  maskCanvas.addEventListener('pointerup', stopDraw);
  maskCanvas.addEventListener('pointerleave', stopDraw);
}

function loadImageToMask(dataUrl) {
  const img = new Image();
  img.onload = () => {
    maskCanvas.width = maskCanvas.offsetWidth;
    maskCanvas.height = maskCanvas.offsetHeight;
    maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
  };
  img.src = dataUrl;
}

function startDraw(e) {
  isDrawing = true;
  draw(e);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = maskCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const size = parseInt(document.getElementById('brush-size').value);

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

function stopDraw() {
  isDrawing = false;
}

function clearMask() {
  if (!maskCtx) return;
  maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
  // reload image if exists
  if (state.photos['inp']) {
    loadImageToMask(state.photos['inp']);
  }
}

// brush mode toggle
document.querySelectorAll('.btn-toggle[data-group="brush"]').forEach(btn => {
  btn.addEventListener('click', () => {
    brushMode = btn.dataset.val;
  });
});

// ── Tags / Presets ──
function appendTag(inputId, tag) {
  const el = document.getElementById(inputId);
  if (el) {
    const current = el.value.trim();
    el.value = current ? `${current}, ${tag}` : tag;
  }
}

function addPreset(preset) {
  const inputs = document.querySelectorAll('.scene-input');
  for (const input of inputs) {
    if (!input.value.trim()) {
      input.value = preset;
      break;
    }
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
    // Send to bot backend for enhancement
    if (tg) {
      tg.sendData(JSON.stringify({
        action: 'enhance',
        prompt: el.value,
        input_id: inputId,
      }));
    }
  } catch (e) {
    console.error(e);
  }

  // Reset button after delay (actual result comes from bot)
  setTimeout(() => {
    btn.textContent = original;
    btn.disabled = false;
  }, 2000);
}

// ── Collect State ──
function getActiveVal(group) {
  const active = document.querySelector(`.btn-toggle.active[data-group="${group}"]`);
  return active ? active.dataset.val : null;
}

function collectState() {
  const mode = state.mode;
  const base = { mode };

  if (mode === 'generate') {
    return {
      ...base,
      prompt: document.getElementById('gen-prompt').value,
      sub_mode: getActiveVal('gen-sub'),
      aspect: getActiveVal('gen-aspect'),
      lora_strength: parseFloat(document.getElementById('gen-lora').value),
      count: parseInt(getActiveVal('gen-count')),
    };
  }
  if (mode === 'inpaint') {
    return {
      ...base,
      prompt: document.getElementById('inp-prompt').value,
      negative: document.getElementById('inp-negative').value,
      cfg: parseFloat(document.getElementById('inp-cfg').value),
      steps: parseInt(document.getElementById('inp-steps').value),
      count: parseInt(getActiveVal('inp-count')),
      photo: state.photos['inp'] || null,
      mask: maskCanvas ? maskCanvas.toDataURL() : null,
    };
  }
  if (mode === 'video') {
    const scenes = [];
    document.querySelectorAll('.scene-input').forEach(input => {
      if (input.value.trim()) scenes.push(input.value.trim());
    });
    return {
      ...base,
      scenes,
      negative: document.getElementById('vid-negative').value,
      photo: state.photos['vid'] || null,
    };
  }
  if (mode === 'edit_easy') {
    return {
      ...base,
      prompt: document.getElementById('easy-prompt').value,
      negative: document.getElementById('easy-negative').value,
      edit_mode: getActiveVal('easy-mode'),
      denoise: parseFloat(document.getElementById('easy-denoise').value),
      steps: parseInt(document.getElementById('easy-steps').value),
      quality: getActiveVal('easy-quality'),
      count: parseInt(getActiveVal('easy-count')),
      photo: state.photos['easy'] || null,
      ref_photo: state.photos['easy-ref'] || null,
    };
  }
  if (mode === 'edit_dark') {
    return {
      ...base,
      prompt: document.getElementById('dark-prompt').value,
      negative: document.getElementById('dark-negative').value,
      denoise: parseFloat(document.getElementById('dark-denoise').value),
      steps: parseInt(document.getElementById('dark-steps').value),
      quality: getActiveVal('dark-quality'),
      count: parseInt(getActiveVal('dark-count')),
      photo: state.photos['dark'] || null,
    };
  }
  return base;
}

// ── Actions ──
function generate() {
  const data = collectState();
  data.action = 'generate';
  sendToBot(data);
}

function generateVideo() {
  const data = collectState();
  data.action = 'generate_video';
  sendToBot(data);
}

function editImage() {
  const data = collectState();
  data.action = 'edit';
  sendToBot(data);
}

function darkBeast() {
  const data = collectState();
  data.action = 'dark_beast';
  sendToBot(data);
}

function buyTokens(amount, stars) {
  sendToBot({ action: 'buy_tokens', amount, stars });
}

function buyPremium() {
  sendToBot({ action: 'buy_premium', stars: 1500 });
}

function sendToBot(data) {
  if (tg) {
    tg.sendData(JSON.stringify(data));
  } else {
    console.log('Would send to bot:', data);
    alert('Data sent (check console)');
  }
}
