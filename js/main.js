/* ═══════════════════════════════════════════════════
   main.js — Alexander Villarroel Torrico Portfolio IDE
   Handles: file switching, tabs, gutter, terminal
═══════════════════════════════════════════════════ */

/* ── File registry ──────────────────────────────── */
const FILES = {
  about:      { labels: { es: 'sobre_mi.md',     en: 'about_me.md'    }, lang: 'Markdown',  icon: 'M',  iconClass: 'icon-md',   lines: 30 },
  projects:   { labels: { es: 'proyectos.json',  en: 'projects.json'  }, lang: 'JSON',      icon: '{}', iconClass: 'icon-json', lines: 18 },
  skills:     { labels: { es: 'habilidades.sh',  en: 'skills.sh'      }, lang: 'Shell',     icon: '$',  iconClass: 'icon-sh',   lines: 38 },
  experience: { labels: { es: 'experiencia.log', en: 'experience.log' }, lang: 'Log',       icon: '!',  iconClass: 'icon-log',  lines: 44 },
  contact:    { labels: { es: 'contacto.txt',    en: 'contact.txt'    }, lang: 'Plaintext', icon: '≡',  iconClass: 'icon-txt',  lines: 26 },
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
const langToggle  = document.getElementById('langToggle');
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
const MIN_FORM_FILL_MS = 5000;
const MAX_LINKS_IN_MESSAGE = 3;
const ABOUT_AI_API_ENDPOINT = '/api/about-ai';
const ABOUT_AI_TIMEOUT_MS = 12000;
const ABOUT_AI_CONTEXT_WINDOW = 3;
const ABOUT_AI_BOT_CONTEXT_WINDOW = 2;
const ABOUT_AI_SESSION_KEY = 'about-ai-session-v1';
const ABOUT_AI_MAX_MESSAGES = 30;

/* ── Language system ────────────────────────────── */
const LANG_KEY = 'portfolio-lang';
let currentLang = 'es';

const I18N = {
  es: {
    loading: 'Cargando...',
    'err-loading': f => `// Error cargando ${f}`,
    'menu-file': 'Archivo', 'menu-edit': 'Editar', 'menu-select': 'Seleccionar',
    'menu-view': 'Ver', 'menu-go': 'Ir', 'menu-run': 'Iniciar',
    'menu-terminal': 'Terminal', 'menu-help': 'Ayuda',
    'sidebar-header': 'Explorar',
    'file-about': 'sobre_mi.md', 'file-projects': 'proyectos.json',
    'file-skills': 'habilidades.sh', 'file-experience': 'experiencia.log',
    'file-contact': 'contacto.txt',
    'mail-label-name': 'Nombre', 'mail-label-email': 'Correo',
    'mail-label-subject': 'Asunto', 'mail-label-message': 'Mensaje',
    'mail-ph-name': 'Tu nombre',
    'mail-ph-subject': 'Quiero contactarte para...',
    'mail-ph-message': 'Escribe tu mensaje...',
    'mail-send': 'Enviar correo',
    'mail-compose-title': 'Redactar correo',
    'mail-close-aria': 'Cerrar app de correo',
    'mail-open-subject': 'Contacto desde portfolio',
    'mail-tip': 'Tip: puedes volver al IDE con el boton X o desde la barra de tareas.',
    'taskbar-mail': 'Correo',
    'theme-dark': 'Modo oscuro', 'theme-light': 'Modo claro',
    'ai-empty': 'Escribe una pregunta para poder ayudarte.',
    'ai-thinking-btn': 'Pensando...',
    'ai-thinking-msg': 'Analizando tu pregunta...',
    'ai-error-msg': 'No pude responder ahora mismo. Intenta nuevamente en unos segundos.',
    'ai-fallback': 'Buena pregunta. Puedo responder sobre estudios, experiencia, proyectos, habilidades, idiomas, objetivo profesional y formas de contacto.',
    'ai-status-ready': 'Estado: listo',
    'ai-status-api': 'Estado: conectado a Gemini',
    'ai-status-fallback': 'Estado: modo local (fallback)',
    'ai-cleared': 'Conversacion limpiada.',
    'mail-sending': 'Enviando correo...',
    'mail-sent': 'Correo enviado correctamente.',
    'mail-sent-fallback': 'Correo enviado correctamente (fallback del formulario).',
    'mail-fill-all': 'Completa todos los campos antes de enviar.',
    'mail-wait': 'Espera unos segundos antes de enviar.',
    'mail-spam': 'Mensaje bloqueado por posible spam (demasiados enlaces).',
    'mail-spam-gen': 'No se pudo procesar el envio. Intenta nuevamente.',
    'mail-cooldown': s => `Espera ${s}s`,
    'mail-cooldown-toast': s => `Espera ${s}s antes de volver a enviar.`,
    'mail-no-emailjs': 'No se pudo cargar EmailJS. Recarga la pagina.',
    'mail-err-domain': 'Error EmailJS: dominio no autorizado. Agrega tu URL en EmailJS > Allowed Origins.',
    'mail-err-template': s => `Error plantilla EmailJS: ${s}`,
    'mail-err-service': 'Error EmailJS: Service ID invalido o servicio desconectado.',
    'mail-err-raw': s => `Error EmailJS: ${s}`,
    'mail-err-generic': 'No se pudo enviar. Revisa tu plantilla y dominio en EmailJS.',
  },
  en: {
    loading: 'Loading...',
    'err-loading': f => `// Error loading ${f}`,
    'menu-file': 'File', 'menu-edit': 'Edit', 'menu-select': 'Select',
    'menu-view': 'View', 'menu-go': 'Go', 'menu-run': 'Run',
    'menu-terminal': 'Terminal', 'menu-help': 'Help',
    'sidebar-header': 'Explorer',
    'file-about': 'about_me.md', 'file-projects': 'projects.json',
    'file-skills': 'skills.sh', 'file-experience': 'experience.log',
    'file-contact': 'contact.txt',
    'mail-label-name': 'Name', 'mail-label-email': 'Email',
    'mail-label-subject': 'Subject', 'mail-label-message': 'Message',
    'mail-ph-name': 'Your name',
    'mail-ph-subject': "I'd like to contact you about...",
    'mail-ph-message': 'Write your message...',
    'mail-send': 'Send email',
    'mail-compose-title': 'Mail Compose',
    'mail-close-aria': 'Close mail app',
    'mail-open-subject': 'Contact from portfolio',
    'mail-tip': 'Tip: you can return to the IDE using the X button or from the taskbar.',
    'taskbar-mail': 'Mail',
    'theme-dark': 'Dark mode', 'theme-light': 'Light mode',
    'ai-empty': 'Write a question so I can help you.',
    'ai-thinking-btn': 'Thinking...',
    'ai-thinking-msg': 'Analyzing your question...',
    'ai-error-msg': "Couldn't respond right now. Please try again in a few seconds.",
    'ai-fallback': 'Good question. I can answer about studies, experience, projects, skills, languages, professional goals and contact methods.',
    'ai-status-ready': 'Status: ready',
    'ai-status-api': 'Status: connected to Gemini',
    'ai-status-fallback': 'Status: local mode (fallback)',
    'ai-cleared': 'Conversation cleared.',
    'mail-sending': 'Sending email...',
    'mail-sent': 'Email sent successfully.',
    'mail-sent-fallback': 'Email sent successfully (form fallback).',
    'mail-fill-all': 'Fill in all fields before sending.',
    'mail-wait': 'Wait a few seconds before sending.',
    'mail-spam': 'Message blocked for possible spam (too many links).',
    'mail-spam-gen': 'Could not process the submission. Please try again.',
    'mail-cooldown': s => `Wait ${s}s`,
    'mail-cooldown-toast': s => `Wait ${s}s before sending again.`,
    'mail-no-emailjs': 'Could not load EmailJS. Reload the page.',
    'mail-err-domain': 'EmailJS error: domain not authorized. Add your URL in EmailJS > Allowed Origins.',
    'mail-err-template': s => `EmailJS template error: ${s}`,
    'mail-err-service': 'EmailJS error: invalid Service ID or disconnected service.',
    'mail-err-raw': s => `EmailJS error: ${s}`,
    'mail-err-generic': "Couldn't send. Check your template and domain in EmailJS.",
  },
};

let isMailSending = false;
let cooldownUntil = 0;
let cooldownTimer = null;
let mailFormOpenedAt = Date.now();

const ABOUT_AI_RESPONSES = [
  {
    patterns: ['estudias', 'estudio', 'universidad', 'umsa', 'informatica', 'computer science', 'education'],
    answers: {
      es: 'Estoy estudiando Informatica en la UMSA. Mi enfoque academico actual combina ciberseguridad, redes y analisis forense digital.',
      en: 'I am studying Computer Science at UMSA. My current academic focus combines cybersecurity, networking, and digital forensics.',
    },
  },
  {
    patterns: ['enfoque', 'ciberseguridad', 'seguridad', 'pentesting', 'web', 'owasp', 'security', 'focus'],
    answers: {
      es: 'Mi enfoque principal es la ciberseguridad aplicada: evaluacion de vulnerabilidades web, hardening de autenticacion y seguridad de redes con enfoque practico.',
      en: 'My main focus is applied cybersecurity: web vulnerability assessment, authentication hardening, and practical network security.',
    },
  },
  {
    patterns: ['experiencia', 'practica', 'internship', 'geologicas', 'redes', 'it', 'laboratorio', 'server'],
    answers: {
      es: 'Realice practica profesional en IT y Redes en la Facultad de Ciencias Geologicas (UMSA): inventario de hardware, mapeo de topologia de red e implementacion de servidor Linux.',
      en: 'I completed a professional internship in IT and Networks at the Faculty of Geological Sciences (UMSA): hardware inventory, network topology mapping, and Linux server implementation.',
    },
  },
  {
    patterns: ['proyectos', 'proyecto', 'biblioteca juridica', 'passgen', 'inventario', 'projects', 'portfolio'],
    answers: {
      es: 'Proyectos destacados: Biblioteca Juridica (Supabase + OAuth hardening + RLS), PassGen (Web Crypto API) y un script .bat de inventario de red para infraestructura Windows.',
      en: 'Highlighted projects: Legal Library (Supabase + OAuth hardening + RLS), PassGen (Web Crypto API), and a .bat network inventory script for Windows infrastructure.',
    },
  },
  {
    patterns: ['habilidades', 'skills', 'stack', 'herramientas', 'tools', 'tecnologias', 'tech'],
    answers: {
      es: 'Trabajo con JavaScript, Python, PHP, SQL, Linux/Kali, Git/GitHub, Supabase y fundamentos de auditoria de seguridad web (CSP, sanitizacion XSS, hashing, RLS).',
      en: 'I work with JavaScript, Python, PHP, SQL, Linux/Kali, Git/GitHub, Supabase, and web security auditing fundamentals (CSP, XSS sanitization, hashing, RLS).',
    },
  },
  {
    patterns: ['destacas', 'destacar', 'fortaleza', 'fortalezas', 'fuerte', 'strength', 'strengths', 'best at'],
    answers: {
      es: 'Me destaco en analisis de seguridad web y en enfoque tecnico-practico: identificar vulnerabilidades, documentarlas claramente y proponer mitigaciones concretas.',
      en: 'I stand out in web security analysis and a practical technical approach: identifying vulnerabilities, documenting them clearly, and proposing concrete mitigations.',
    },
  },
  {
    patterns: ['eso lo aplicaste', 'aplicaste', 'aplicas', 'proyectos reales', 'real projects', 'applied in projects'],
    answers: {
      es: 'Si. Lo aplique en proyectos reales como Biblioteca Juridica (hardening OAuth, RLS y auditoria) y PassGen (Web Crypto API). Tambien en practica profesional con inventario y mapeo de red.',
      en: 'Yes. I applied it in real projects such as Legal Library (OAuth hardening, RLS, and auditing) and PassGen (Web Crypto API), and also during my internship with inventory and network mapping.',
    },
  },
  {
    patterns: ['donde fue tu practica', 'donde hiciste tu practica', 'where was your internship', 'where did you do your internship'],
    answers: {
      es: 'Mi practica profesional fue en IT y Redes de la Facultad de Ciencias Geologicas de la UMSA, en La Paz.',
      en: 'My professional internship was in IT and Networks at the Faculty of Geological Sciences at UMSA, in La Paz.',
    },
  },
  {
    patterns: ['idioma', 'idiomas', 'ingles', 'espanol', 'english', 'spanish', 'language', 'languages'],
    answers: {
      es: 'Hablo espanol nativo e ingles nivel B1.',
      en: 'I speak native Spanish and English at B1 level.',
    },
  },
  {
    patterns: ['objetivo', 'meta', 'futuro', 'carrera', 'goal', 'future', 'career'],
    answers: {
      es: 'Mi objetivo es crecer hacia roles de pentesting web o seguridad de redes, aportando en equipos que protejan infraestructura critica.',
      en: 'My goal is to grow into web pentesting or network security roles, contributing to teams that protect critical infrastructure.',
    },
  },
  {
    patterns: ['contacto', 'contactarte', 'email', 'linkedin', 'github', 'contact', 'reach'],
    answers: {
      es: 'Puedes contactarme por email, LinkedIn o GitHub desde la seccion de contacto del portfolio.',
      en: 'You can contact me via email, LinkedIn, or GitHub from the portfolio contact section.',
    },
  },
];

function countLinks(text) {
  const matches = text.match(/(https?:\/\/|www\.)/gi);
  return matches ? matches.length : 0;
}

function updateThemeToggle(theme) {
  if (!themeToggle) return;
  themeToggle.textContent = theme === 'light' ? I18N[currentLang]['theme-dark'] : I18N[currentLang]['theme-light'];
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

/* ── Language toggle ────────────────────────────── */
function updateLangToggle() {
  if (!langToggle) return;
  langToggle.textContent = currentLang === 'es' ? 'EN' : 'ES';
  langToggle.setAttribute('aria-label', currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español');
}

function applyTranslations() {
  const tk = I18N[currentLang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (typeof tk[key] === 'string') el.textContent = tk[key];
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const key = el.dataset.i18nPh;
    if (typeof tk[key] === 'string') el.placeholder = tk[key];
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => {
    const key = el.dataset.i18nAria;
    if (typeof tk[key] === 'string') el.setAttribute('aria-label', tk[key]);
  });
  document.documentElement.lang = currentLang;
  updateThemeToggle(document.body.dataset.theme);
  renderTabs();
  if (activeFile && FILES[activeFile]) {
    bcFile.textContent = FILES[activeFile].labels[currentLang];
  }
  if (!isMailSending && !(cooldownUntil > Date.now())) {
    const labelNode = mailSendBtn?.querySelector('.send-label');
    if (labelNode) labelNode.textContent = tk['mail-send'];
  }
}

function setLang(lang) {
  currentLang = I18N[lang] ? lang : 'es';
  localStorage.setItem(LANG_KEY, currentLang);
  updateLangToggle();
  applyTranslations();
  for (const key in cache) delete cache[key];
  if (activeFile) loadPage(activeFile);
}

function toggleLang() {
  setLang(currentLang === 'es' ? 'en' : 'es');
}

function initLang() {
  const storedLang = localStorage.getItem(LANG_KEY);
  currentLang = I18N[storedLang] ? storedLang : 'es';
  updateLangToggle();
  applyTranslations();
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
  bcFile.textContent = FILES[file].labels[currentLang];
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
  editorPane.innerHTML = `<div class="pane-loading">${I18N[currentLang].loading}</div>`;

  const langSuffix = currentLang === 'en' ? '-en' : '';
  const cacheKey   = `${file}${langSuffix}`;

  try {
    if (cache[cacheKey]) {
      renderPage(cache[cacheKey], file);
      return;
    }

    let res = await fetch(`pages/${file}${langSuffix}.html`);
    if (!res.ok && langSuffix) res = await fetch(`pages/${file}.html`);
    if (!res.ok) throw new Error(`${res.status}`);
    const html = await res.text();

    cache[cacheKey] = html;
    renderPage(html, file);

  } catch (err) {
    editorPane.innerHTML = `
      <div class="code-block">
        <span class="cmt">${I18N[currentLang]['err-loading'](`pages/${file}.html`)}</span>
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
  if (file === 'about')      bindAboutAiAssistant();
  if (file === 'skills')     animateSkillBars();
  if (file === 'projects')   bindProjectToggles();
  if (file === 'contact')    bindContactActions();
}

function normalizeQuestion(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreIntentMatch(normalizedQuestion, patterns) {
  let score = 0;
  for (const pattern of patterns) {
    if (!pattern) continue;
    if (normalizedQuestion.includes(pattern)) score += pattern.length > 5 ? 2 : 1;
  }
  return score;
}

function isGreeting(normalizedQuestion) {
  return /^(hola|hello|hi|buenas|buenos dias|good morning|good afternoon|hey)\b/.test(normalizedQuestion);
}

function getAboutAiAnswer(question, recentQuestions = [], recentBotAnswers = []) {
  const normalized = normalizeQuestion(question);
  if (!normalized) return I18N[currentLang]['ai-empty'];

  if (isGreeting(normalized)) {
    return currentLang === 'es'
      ? 'Hola. Puedo contarte sobre estudios, experiencia, proyectos, stack, objetivo profesional o contacto. Que te gustaria saber primero?'
      : 'Hi. I can tell you about studies, experience, projects, stack, career goals, or contact info. What would you like to know first?';
  }

  let bestItem = null;
  let bestScore = 0;
  const recentContext = normalizeQuestion([
    ...(recentQuestions || []),
    ...(recentBotAnswers || []),
  ].join(' '));

  for (const item of ABOUT_AI_RESPONSES) {
    const scoreCurrent = scoreIntentMatch(normalized, item.patterns);
    const scoreContext = recentContext ? scoreIntentMatch(recentContext, item.patterns) : 0;
    const score = (scoreCurrent * 3) + Math.min(scoreContext, 2);
    if (score > bestScore) {
      bestScore = score;
      bestItem = item;
    }
  }

  if (bestItem && bestScore > 0) {
    return bestItem.answers[currentLang] || bestItem.answers.es;
  }

  return I18N[currentLang]['ai-fallback'];
}

async function fetchAboutAiFromApi(question, recentQuestions = [], recentBotAnswers = []) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABOUT_AI_TIMEOUT_MS);

  const contextQuestions = Array.isArray(recentQuestions)
    ? recentQuestions.slice(-ABOUT_AI_CONTEXT_WINDOW)
    : [];
  const contextBotAnswers = Array.isArray(recentBotAnswers)
    ? recentBotAnswers.slice(-ABOUT_AI_BOT_CONTEXT_WINDOW)
    : [];

  try {
    const response = await fetch(ABOUT_AI_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question,
        recentQuestions: contextQuestions,
        recentBotAnswers: contextBotAnswers,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API status ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || typeof payload.answer !== 'string' || !payload.answer.trim()) {
      throw new Error('Invalid API payload');
    }

    return payload.answer.trim();
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getAboutAiAnswerSmart(question, recentQuestions = [], recentBotAnswers = []) {
  try {
    const answer = await fetchAboutAiFromApi(question, recentQuestions, recentBotAnswers);
    return { answer, source: 'api' };
  } catch (error) {
    console.warn('About AI API unavailable, using local fallback:', error);
    return {
      answer: getAboutAiAnswer(question, recentQuestions, recentBotAnswers),
      source: 'fallback',
    };
  }
}

function appendAboutAiMessage(chat, text, role = 'bot') {
  const msg = document.createElement('div');
  msg.className = `about-ai-msg about-ai-msg-${role}`;
  msg.textContent = text;
  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
  return msg;
}

function loadAboutAiSession() {
  try {
    const raw = sessionStorage.getItem(ABOUT_AI_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (_) {
    return null;
  }
}

function saveAboutAiSession(messages, recentQuestions, recentBotAnswers) {
  try {
    const safeMessages = Array.isArray(messages)
      ? messages
          .filter((item) => item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'bot'))
          .slice(-ABOUT_AI_MAX_MESSAGES)
      : [];
    const safeQuestions = Array.isArray(recentQuestions)
      ? recentQuestions.filter(Boolean).slice(-ABOUT_AI_CONTEXT_WINDOW)
      : [];
    const safeBotAnswers = Array.isArray(recentBotAnswers)
      ? recentBotAnswers.filter(Boolean).slice(-ABOUT_AI_BOT_CONTEXT_WINDOW)
      : [];

    sessionStorage.setItem(
      ABOUT_AI_SESSION_KEY,
      JSON.stringify({
        messages: safeMessages,
        recentQuestions: safeQuestions,
        recentBotAnswers: safeBotAnswers,
      })
    );
  } catch (_) {
    // Ignore storage issues (private mode/quota), chat still works in-memory.
  }
}

function setAboutAiStatus(statusEl, mode = 'ready') {
  if (!statusEl) return;

  statusEl.classList.remove('is-api', 'is-fallback');

  if (mode === 'api') {
    statusEl.textContent = I18N[currentLang]['ai-status-api'];
    statusEl.classList.add('is-api');
    return;
  }

  if (mode === 'fallback') {
    statusEl.textContent = I18N[currentLang]['ai-status-fallback'];
    statusEl.classList.add('is-fallback');
    return;
  }

  statusEl.textContent = I18N[currentLang]['ai-status-ready'];
}

function bindAboutAiAssistant() {
  const form = editorPane.querySelector('#aboutAiForm');
  const input = editorPane.querySelector('#aboutAiInput');
  const submitBtn = editorPane.querySelector('.about-ai-btn');
  const chat = editorPane.querySelector('#aboutAiChat');
  const clearBtn = editorPane.querySelector('#aboutAiClearBtn');
  const statusEl = editorPane.querySelector('#aboutAiStatus');
  const suggestBtns = editorPane.querySelectorAll('.about-ai-suggest');
  if (!form || !input || !submitBtn || !chat) return;
  const defaultButtonLabel = submitBtn.textContent;
  const initialBotText = chat.querySelector('.about-ai-msg-bot')?.textContent?.trim() || '';
  const session = loadAboutAiSession();
  const recentQuestions = Array.isArray(session?.recentQuestions) ? session.recentQuestions.slice(-ABOUT_AI_CONTEXT_WINDOW) : [];
  const recentBotAnswers = Array.isArray(session?.recentBotAnswers) ? session.recentBotAnswers.slice(-ABOUT_AI_BOT_CONTEXT_WINDOW) : [];
  const messageLog = Array.isArray(session?.messages) && session.messages.length
    ? session.messages
        .filter((item) => item && typeof item.text === 'string' && (item.role === 'user' || item.role === 'bot'))
        .slice(-ABOUT_AI_MAX_MESSAGES)
    : (initialBotText ? [{ role: 'bot', text: initialBotText }] : []);

  chat.innerHTML = '';
  for (const msg of messageLog) {
    appendAboutAiMessage(chat, msg.text, msg.role);
  }

  setAboutAiStatus(statusEl, 'ready');

  const persistSession = () => saveAboutAiSession(messageLog, recentQuestions, recentBotAnswers);
  persistSession();

  suggestBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const suggestion = btn.dataset.question;
      if (!suggestion) return;
      input.value = suggestion;
      if (typeof form.requestSubmit === 'function') {
        form.requestSubmit();
      } else {
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
    });
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      messageLog.length = 0;
      recentQuestions.length = 0;
      recentBotAnswers.length = 0;

      chat.innerHTML = '';
      if (initialBotText) {
        appendAboutAiMessage(chat, initialBotText, 'bot');
        messageLog.push({ role: 'bot', text: initialBotText });
      }

      setAboutAiStatus(statusEl, 'ready');
      persistSession();
      showToast(I18N[currentLang]['ai-cleared'], 'info', 2000);
      input.focus();
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) {
      appendAboutAiMessage(chat, I18N[currentLang]['ai-empty'], 'bot');
      messageLog.push({ role: 'bot', text: I18N[currentLang]['ai-empty'] });
      if (messageLog.length > ABOUT_AI_MAX_MESSAGES) messageLog.splice(0, messageLog.length - ABOUT_AI_MAX_MESSAGES);
      persistSession();
      return;
    }

    appendAboutAiMessage(chat, question, 'user');
    messageLog.push({ role: 'user', text: question });
    if (messageLog.length > ABOUT_AI_MAX_MESSAGES) messageLog.splice(0, messageLog.length - ABOUT_AI_MAX_MESSAGES);
    recentQuestions.push(question);
    if (recentQuestions.length > ABOUT_AI_CONTEXT_WINDOW) {
      recentQuestions.splice(0, recentQuestions.length - ABOUT_AI_CONTEXT_WINDOW);
    }
    persistSession();
    input.value = '';

    submitBtn.disabled = true;
    submitBtn.textContent = I18N[currentLang]['ai-thinking-btn'];
    const thinkingMsg = appendAboutAiMessage(chat, I18N[currentLang]['ai-thinking-msg'], 'thinking');

    try {
      const result = await getAboutAiAnswerSmart(question, recentQuestions, recentBotAnswers);
      thinkingMsg.remove();
      appendAboutAiMessage(chat, result.answer, 'bot');
      messageLog.push({ role: 'bot', text: result.answer });
      if (messageLog.length > ABOUT_AI_MAX_MESSAGES) messageLog.splice(0, messageLog.length - ABOUT_AI_MAX_MESSAGES);
      recentBotAnswers.push(result.answer);
      if (recentBotAnswers.length > ABOUT_AI_BOT_CONTEXT_WINDOW) {
        recentBotAnswers.splice(0, recentBotAnswers.length - ABOUT_AI_BOT_CONTEXT_WINDOW);
      }
      setAboutAiStatus(statusEl, result.source === 'api' ? 'api' : 'fallback');
      persistSession();
    } catch (error) {
      thinkingMsg.remove();
      appendAboutAiMessage(chat, I18N[currentLang]['ai-error-msg'], 'bot');
      messageLog.push({ role: 'bot', text: I18N[currentLang]['ai-error-msg'] });
      if (messageLog.length > ABOUT_AI_MAX_MESSAGES) messageLog.splice(0, messageLog.length - ABOUT_AI_MAX_MESSAGES);
      setAboutAiStatus(statusEl, 'fallback');
      persistSession();
      console.error('About AI failed:', error);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = defaultButtonLabel;
      input.focus();
    }
  });
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
  mailFormOpenedAt = Date.now();
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
    openMailApp({ subject: I18N[currentLang]['mail-open-subject'] });
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
    if (!isMailSending) setSendButtonState({ disabled: false, label: I18N[currentLang]['mail-send'] });
    return;
  }

  const secLeft = Math.ceil(msLeft / 1000);
  setSendButtonState({ disabled: true, label: I18N[currentLang]['mail-cooldown'](secLeft) });
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
    showToast(I18N[currentLang]['mail-no-emailjs'], 'err');
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
      showToast(I18N[currentLang]['mail-cooldown-toast'](secLeft), 'info', 2600);
      return;
    }

    const fromName = document.getElementById('mailName')?.value.trim() || '';
    const honeypot = document.getElementById('mailWebsite')?.value.trim() || '';
    const replyTo = document.getElementById('mailReplyTo')?.value.trim() || '';
    const subject = document.getElementById('mailSubject')?.value.trim() || '';
    const message = document.getElementById('mailMessage')?.value.trim() || '';
    const timeStamp = new Date().toLocaleString('es-BO', { hour12: false });
    const timeInput = document.getElementById('mailTime');
    if (timeInput) timeInput.value = timeStamp;

    if (!fromName || !replyTo || !subject || !message) {
      showToast(I18N[currentLang]['mail-fill-all'], 'err');
      return;
    }

    if (honeypot) {
      showToast(I18N[currentLang]['mail-spam-gen'], 'err');
      return;
    }

    if ((Date.now() - mailFormOpenedAt) < MIN_FORM_FILL_MS) {
      showToast(I18N[currentLang]['mail-wait'], 'err');
      return;
    }

    if (countLinks(message) > MAX_LINKS_IN_MESSAGE) {
      showToast(I18N[currentLang]['mail-spam'], 'err', 4200);
      return;
    }

    isMailSending = true;
    setSendButtonState({ loading: true, disabled: true, label: I18N[currentLang]['mail-sending'] });
    showToast(I18N[currentLang]['mail-sending'], 'info', 1600);

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

      showToast(I18N[currentLang]['mail-sent'], 'ok');
      mailForm.reset();
      mailFormOpenedAt = Date.now();
      startSendCooldown();
    } catch (err) {
      const rawError = (err && (err.text || err.message || err.status)) ? String(err.text || err.message || err.status) : '';
      const errorText = rawError.toLowerCase();

      if (errorText.includes('origin') || errorText.includes('domain')) {
        showToast(I18N[currentLang]['mail-err-domain'], 'err', 5200);
      } else if (errorText.includes('template') || errorText.includes('variable')) {
        try {
          await window.emailjs.sendForm(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, mailForm);
          showToast(I18N[currentLang]['mail-sent-fallback'], 'ok', 4200);
          mailForm.reset();
          mailFormOpenedAt = Date.now();
          if (timeInput) timeInput.value = '';
          startSendCooldown();
          return;
        } catch (fallbackErr) {
          const fallbackRaw = (fallbackErr && (fallbackErr.text || fallbackErr.message || fallbackErr.status)) ? String(fallbackErr.text || fallbackErr.message || fallbackErr.status) : '';
          const detail = fallbackRaw || rawError || 'Sin detalle';
          showToast(I18N[currentLang]['mail-err-template'](detail), 'err', 6200);
        }
      } else if (errorText.includes('service')) {
        showToast(I18N[currentLang]['mail-err-service'], 'err', 5200);
      } else if (rawError) {
        showToast(I18N[currentLang]['mail-err-raw'](rawError), 'err', 5200);
      } else {
        showToast(I18N[currentLang]['mail-err-generic'], 'err', 5200);
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
        <span>${m.labels[currentLang]}</span>
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
  initLang();
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
  if (langToggle)  langToggle.addEventListener('click', toggleLang);
  initDesktopAppSwitcher();
  initMailForm();
  openFile('about');
  runTerminal();
});
