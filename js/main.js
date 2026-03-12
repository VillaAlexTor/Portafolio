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

const THEME_KEY = 'portfolio-theme';

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
  openFile('about');
  runTerminal();
});
