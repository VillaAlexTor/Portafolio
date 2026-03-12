/* ═══════════════════════════════════════════════════
   main.js — Alexander Villarroel Torrico Portfolio IDE
   Handles: file switching, tabs, gutter, terminal
═══════════════════════════════════════════════════ */

/* ── File registry ──────────────────────────────── */
const FILES = {
  about:      { label: 'about.md',       lang: 'Markdown',  icon: 'M',  iconClass: 'icon-md',   lines: 30 },
  projects:   { label: 'projects.json',  lang: 'JSON',      icon: '{}', iconClass: 'icon-json', lines: 18 },
  skills:     { label: 'skills.sh',      lang: 'Shell',     icon: '$',  iconClass: 'icon-sh',   lines: 38 },
  experience: { label: 'experience.log', lang: 'Log',       icon: '!',  iconClass: 'icon-log',  lines: 44 },
  contact:    { label: 'contact.txt',    lang: 'Plaintext', icon: '≡',  iconClass: 'icon-txt',  lines: 26 },
};

/* ── State ──────────────────────────────────────── */
let openTabs   = [];
let activeFile = null;
const cache    = {};   // stores fetched HTML to avoid re-fetching

/* ── DOM refs ───────────────────────────────────── */
const tabsBar    = document.getElementById('tabsBar');
const editorPane = document.getElementById('editorPane');
const gutter     = document.getElementById('gutter');
const bcFile     = document.getElementById('bcFile');
const sbLang     = document.getElementById('sbLang');
const themeToggle = document.getElementById('themeToggle');
const mailApp = document.getElementById('mailApp');
const mailForm = document.getElementById('mailForm');
const mailSendBtn = document.getElementById('mailSendBtn');
const mailCloseBtn = document.getElementById('mailCloseBtn');
const taskbarApps = document.querySelectorAll('.task-app');
const toastStack = document.getElementById('toastStack');

const THEME_KEY = 'portfolio-theme';
const EMAILJS_SERVICE_ID = 'service_k7eyitg';
const EMAILJS_TEMPLATE_ID = 'template_mhq0col';
const EMAILJS_PUBLIC_KEY = 'fQuoRWBUYBjQejMXe';
const SEND_COOLDOWN_MS = 30000;

let isMailSending = false;
let cooldownUntil = 0;
let cooldownTimer = null;

function updateThemeToggle(theme) {
  if (!themeToggle) return;
  themeToggle.textContent = theme === 'light' ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-pressed', String(theme === 'dark'));
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
  updateThemeToggle(theme);
}

function initTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  const preferredTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(storedTheme || preferredTheme);
}

function toggleTheme() {
  const nextTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
  applyTheme(nextTheme);
}

/* ═══════════════════════════════════════════════════
   OPEN FILE
═══════════════════════════════════════════════════ */
async function openFile(file) {
  if (!FILES[file]) return;

  // Add tab if not already open
  if (!openTabs.includes(file)) {
    openTabs.push(file);
    renderTabs();
  }

  activeFile = file;

  // Update sidebar highlight
  document.querySelectorAll('.sidebar-file').forEach(el => {
    el.classList.toggle('active', el.dataset.file === file);
  });

  // Update tab highlight
  document.querySelectorAll('.tab').forEach(el => {
    el.classList.toggle('active', el.dataset.file === file);
  });

  // Update breadcrumb + status bar
  bcFile.textContent = FILES[file].label;
  sbLang.textContent = FILES[file].lang;

  // Update gutter
  renderGutter(FILES[file].lines);

  // Load content
  await loadPage(file);
}

/* ═══════════════════════════════════════════════════
   LOAD PAGE via fetch
═══════════════════════════════════════════════════ */
async function loadPage(file) {
  // Show loading state
  editorPane.innerHTML = '<div class="pane-loading">Cargando...</div>';

  try {
    // Use cache if available
    if (cache[file]) {
      renderPage(cache[file], file);
      return;
    }

    const res  = await fetch(`pages/${file}.html`);
    if (!res.ok) throw new Error(`${res.status}`);
    const html = await res.text();

    cache[file] = html;
    renderPage(html, file);

  } catch (err) {
    editorPane.innerHTML = `
      <div class="code-block">
        <span class="cmt">// Error cargando pages/${file}.html</span>
        <br><span class="dim">${err.message}</span>
      </div>`;
  }
}

function renderPage(html, file) {
  editorPane.innerHTML = html;
  editorPane.classList.remove('pane-fade-in');
  void editorPane.offsetWidth; // reflow trick
  editorPane.classList.add('pane-fade-in');

  // Post-render hooks per file
  if (file === 'skills')     animateSkillBars();
  if (file === 'projects')   bindProjectToggles();
  if (file === 'contact')    bindContactActions();
}

function setTaskbarActive(app) {
  taskbarApps.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.app === app);
  });
}

function switchDesktopApp(app) {
  const isMail = app === 'mail';
  document.body.classList.toggle('mail-mode', isMail);
  if (mailApp) mailApp.setAttribute('aria-hidden', String(!isMail));
  setTaskbarActive(app);
}

function openMailApp(prefill = {}) {
  switchDesktopApp('mail');
  const subjectInput = document.getElementById('mailSubject');
  if (subjectInput && prefill.subject && !subjectInput.value) {
    subjectInput.value = prefill.subject;
  }
  const nameInput = document.getElementById('mailName');
  if (nameInput) nameInput.focus();
}

function closeMailApp() {
  switchDesktopApp('ide');
}

function bindContactActions() {
  const openButton = editorPane.querySelector('[data-open-mail-app="true"]');
  if (!openButton) return;
  openButton.addEventListener('click', () => {
    openMailApp({ subject: 'Contacto desde portfolio' });
  });
}

function initDesktopAppSwitcher() {
  taskbarApps.forEach(btn => {
    btn.addEventListener('click', () => {
      switchDesktopApp(btn.dataset.app === 'mail' ? 'mail' : 'ide');
    });
  });

  if (mailCloseBtn) mailCloseBtn.addEventListener('click', closeMailApp);
}

function showToast(message, type = 'info', timeoutMs = 3200) {
  if (!toastStack) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastStack.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 250);
  }, timeoutMs);
}

function setSendButtonState({ loading = false, disabled = false, label } = {}) {
  if (!mailSendBtn) return;
  const labelNode = mailSendBtn.querySelector('.send-label');
  if (labelNode && label) labelNode.textContent = label;
  mailSendBtn.classList.toggle('is-loading', loading);
  mailSendBtn.disabled = disabled;
}

function updateSendCooldownLabel() {
  if (!mailSendBtn) return;

  const msLeft = cooldownUntil - Date.now();
  if (msLeft <= 0) {
    if (!isMailSending) setSendButtonState({ disabled: false, label: 'Enviar correo' });
    return;
  }

  const secLeft = Math.ceil(msLeft / 1000);
  setSendButtonState({ disabled: true, label: `Espera ${secLeft}s` });
}

function startSendCooldown() {
  cooldownUntil = Date.now() + SEND_COOLDOWN_MS;
  updateSendCooldownLabel();

  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    const msLeft = cooldownUntil - Date.now();
    if (msLeft <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      updateSendCooldownLabel();
      return;
    }
    updateSendCooldownLabel();
  }, 250);
}

function initMailForm() {
  if (!mailForm) return;

  if (!window.emailjs) {
    showToast('No se pudo cargar EmailJS. Recarga la pagina.', 'err');
    return;
  }

  window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  updateSendCooldownLabel();

  mailForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (isMailSending) return;

    if (Date.now() < cooldownUntil) {
      const secLeft = Math.ceil((cooldownUntil - Date.now()) / 1000);
      updateSendCooldownLabel();
      showToast(`Espera ${secLeft}s antes de volver a enviar.`, 'info', 2600);
      return;
    }

    const fromName = document.getElementById('mailName')?.value.trim() || '';
    const replyTo = document.getElementById('mailReplyTo')?.value.trim() || '';
    const subject = document.getElementById('mailSubject')?.value.trim() || '';
    const message = document.getElementById('mailMessage')?.value.trim() || '';
    const timeStamp = new Date().toLocaleString('es-BO', { hour12: false });
    const timeInput = document.getElementById('mailTime');
    if (timeInput) timeInput.value = timeStamp;

    if (!fromName || !replyTo || !subject || !message) {
      showToast('Completa todos los campos antes de enviar.', 'err');
      return;
    }

    isMailSending = true;
    setSendButtonState({ loading: true, disabled: true, label: 'Enviando...' });
    showToast('Enviando correo...', 'info', 1600);

    try {
      const payload = {
        // Variables expected by your current template
        name: fromName,
        email: replyTo,
        title: subject,
        message,
        time: timeStamp,

        // Aliases kept for template flexibility
        from_name: fromName,
        reply_to: replyTo,
        from_email: replyTo,
        subject,
        content: message,
        to_name: 'Alexander Villarroel',
      };

      await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, payload);

      showToast('Correo enviado correctamente.', 'ok');
      mailForm.reset();
      startSendCooldown();
    } catch (err) {
      const rawError = (err && (err.text || err.message || err.status)) ? String(err.text || err.message || err.status) : '';
      const errorText = rawError.toLowerCase();

      if (errorText.includes('origin') || errorText.includes('domain')) {
        showToast('Error EmailJS: dominio no autorizado. Agrega tu URL en EmailJS > Allowed Origins.', 'err', 5200);
      } else if (errorText.includes('template') || errorText.includes('variable')) {
        try {
          await window.emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, mailForm);
          showToast('Correo enviado correctamente (fallback del formulario).', 'ok', 4200);
          mailForm.reset();
          if (timeInput) timeInput.value = '';
          startSendCooldown();
          return;
        } catch (fallbackErr) {
          const fallbackRaw = (fallbackErr && (fallbackErr.text || fallbackErr.message || fallbackErr.status)) ? String(fallbackErr.text || fallbackErr.message || fallbackErr.status) : '';
          const detail = fallbackRaw || rawError || 'Sin detalle';
          showToast(`Error plantilla EmailJS: ${detail}`, 'err', 6200);
        }
      } else if (errorText.includes('service')) {
        showToast('Error EmailJS: Service ID invalido o servicio desconectado.', 'err', 5200);
      } else if (rawError) {
        showToast(`Error EmailJS: ${rawError}`, 'err', 5200);
      } else {
        showToast('No se pudo enviar. Revisa tu plantilla y dominio en EmailJS.', 'err', 5200);
      }

      console.error('EmailJS send failed:', err);
    } finally {
      isMailSending = false;
      setSendButtonState({ loading: false });
      updateSendCooldownLabel();
    }
  });
}

/* ═══════════════════════════════════════════════════
   TABS
═══════════════════════════════════════════════════ */
function renderTabs() {
  tabsBar.innerHTML = openTabs.map(f => {
    const m = FILES[f];
    return `
      <div class="tab${f === activeFile ? ' active' : ''}" data-file="${f}" onclick="openFile('${f}')">
        <span class="file-icon ${m.iconClass}" style="font-size:11px">${m.icon}</span>
        <span>${m.label}</span>
        <span class="tab-close" onclick="closeTab(event,'${f}')">✕</span>
      </div>`;
  }).join('');
}

function closeTab(e, file) {
  e.stopPropagation();
  openTabs = openTabs.filter(t => t !== file);

  // Always keep at least one tab open
  if (openTabs.length === 0) {
    openTabs = ['about'];
    openFile('about');
    return;
  }

  // If closing active tab, switch to the last open one
  if (activeFile === file) {
    openFile(openTabs[openTabs.length - 1]);
  } else {
    renderTabs();
  }
}

/* ═══════════════════════════════════════════════════
   GUTTER (line numbers)
═══════════════════════════════════════════════════ */
function renderGutter(count) {
  gutter.innerHTML = Array.from({ length: count }, (_, i) => i + 1).join('<br>');
}

/* ═══════════════════════════════════════════════════
   SKILL BARS (triggered after skills.sh loads)
═══════════════════════════════════════════════════ */
function animateSkillBars() {
  // Small delay so CSS transition is visible
  setTimeout(() => {
    document.querySelectorAll('.sg-bar-fill').forEach(bar => {
      bar.style.width = (bar.dataset.w || 0) + '%';
    });
  }, 80);
}

/* ═══════════════════════════════════════════════════
   PROJECT ACCORDION (triggered after projects.json loads)
═══════════════════════════════════════════════════ */
function bindProjectToggles() {
  document.querySelectorAll('.proj-card-header').forEach(header => {
    header.addEventListener('click', () => {
      const card   = header.parentElement;
      const isOpen = card.classList.contains('open');

      // Close all
      document.querySelectorAll('.proj-card').forEach(c => c.classList.remove('open'));

      // Open clicked (toggle)
      if (!isOpen) card.classList.add('open');
    });
  });
}

/* ═══════════════════════════════════════════════════
   TERMINAL TYPEWRITER
═══════════════════════════════════════════════════ */
const TERM_SCRIPT = [
  { type: 'cmd', cmd: 'whoami' },
  { type: 'out', text: 'alexander_villarroel  —  informatica UMSA', cls: 'ok' },
  { type: 'gap' },
  { type: 'cmd', cmd: 'cat .profile' },
  { type: 'out', text: 'focus=network_security, web_pentesting, forensics', cls: 'hl' },
  { type: 'out', text: 'internship=fac.geologicas_umsa  [ACTIVE 2026]',     cls: 'ok' },
  { type: 'gap' },
  { type: 'cmd', cmd: 'nmap -sV --open localhost' },
  { type: 'out', text: 'Starting Nmap 7.94 ...',                cls: '' },
  { type: 'out', text: 'PORT     STATE  SERVICE   VERSION',      cls: '' },
  { type: 'out', text: '443/tcp  open   https     portfolio v2.0', cls: 'ok' },
  { type: 'out', text: '22/tcp   open   ssh       OpenSSH 9.x',   cls: 'ok' },
  { type: 'gap' },
  { type: 'input' },
];

function runTerminal() {
  const body = document.getElementById('terminalBody');
  let idx    = 0;

  function next() {
    if (idx >= TERM_SCRIPT.length) return;
    const line = TERM_SCRIPT[idx++];

    if (line.type === 'gap') {
      body.appendChild(document.createElement('br'));

    } else if (line.type === 'input') {
      const d = document.createElement('div');
      d.className = 'term-line';
      d.innerHTML = `<span class="term-ps1">alexander@sec</span><span class="term-ps2">:~/portfolio$&nbsp;</span><span class="term-cursor"></span>`;
      body.appendChild(d);

    } else if (line.type === 'cmd') {
      const d = document.createElement('div');
      d.className = 'term-line';
      d.innerHTML = `<span class="term-ps1">alexander@sec</span><span class="term-ps2">:~/portfolio$&nbsp;</span><span class="term-cmd">${line.cmd}</span>`;
      body.appendChild(d);

    } else {
      const d = document.createElement('div');
      d.className = 'term-line';
      d.innerHTML = `<span class="term-out ${line.cls || ''}">${line.text}</span>`;
      body.appendChild(d);
    }

    body.scrollTop = body.scrollHeight;
    const delay = line.type === 'cmd' ? 380 : line.type === 'gap' ? 90 : 70;
    setTimeout(next, delay);
  }

  setTimeout(next, 700);
}

/* ═══════════════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════════════ */
document.addEventListener('keydown', e => {
  // Ctrl+Tab — cycle forward through open tabs
  if (e.ctrlKey && !e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    const idx = openTabs.indexOf(activeFile);
    openFile(openTabs[(idx + 1) % openTabs.length]);
  }
  // Ctrl+Shift+Tab — cycle backward
  if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
    e.preventDefault();
    const idx = openTabs.indexOf(activeFile);
    openFile(openTabs[(idx - 1 + openTabs.length) % openTabs.length]);
  }
  // Ctrl+W — close active tab
  if (e.ctrlKey && e.key === 'w') {
    e.preventDefault();
    if (activeFile) closeTab({ stopPropagation: () => {} }, activeFile);
  }
});

/* ═══════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  initDesktopAppSwitcher();
  initMailForm();
  openFile('about');
  runTerminal();
});
