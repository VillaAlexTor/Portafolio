/* =====================================================
   PORTFOLIO — script.js
   - GSAP + ScrollTrigger animations
   - Chart.js radar + bar charts
   - Canvas background (hex grid)
   - Typewriter effect
   - Nav scroll behavior
===================================================== */

gsap.registerPlugin(ScrollTrigger);

/* ─── 1. HERO ENTRANCE ANIMATIONS ─────────────────── */
const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

heroTl
  .to('#heroEyebrow', { opacity: 1, y: 0, duration: 0.7, delay: 0.3 })
  .to('.name-first',  { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  .to('.name-last',   { opacity: 1, y: 0, duration: 0.6 }, '-=0.4')
  .to('#heroRole',    { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  .to('#heroDesc',    { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  .to('#heroActions', { opacity: 1, y: 0, duration: 0.6 }, '-=0.3')
  .to('#heroPanel',   { opacity: 1, x: 0, duration: 0.8, ease: 'power2.out' }, '-=0.5');

// set initial states
gsap.set(['#heroEyebrow','#heroRole','#heroDesc','#heroActions'], { opacity: 0, y: 30 });
gsap.set('.name-first, .name-last', { opacity: 0, y: 40 });
gsap.set('#heroPanel', { opacity: 0, x: 40 });

/* ─── 2. TYPEWRITER EFFECT ──────────────────────────── */
const phrases = [
  'Estudiante de Ciberseguridad',
  'Network Security Enthusiast',
  'Web Pentesting',
  'Digital Forensics',
  'Informática — UMSA'
];
let pi = 0, ci = 0, deleting = false;
const typedEl = document.getElementById('typedText');

function typeLoop() {
  const phrase = phrases[pi];
  typedEl.textContent = deleting
    ? phrase.substring(0, ci - 1)
    : phrase.substring(0, ci + 1);

  if (!deleting) {
    ci++;
    if (ci === phrase.length + 1) { deleting = true; setTimeout(typeLoop, 1800); return; }
  } else {
    ci--;
    if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
  }
  setTimeout(typeLoop, deleting ? 38 : 75);
}
setTimeout(typeLoop, 1200);

/* ─── 3. NAV SCROLL BEHAVIOR ────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 40);
});

/* ─── 4. MOBILE NAV ─────────────────────────────────── */
const navMenu   = document.getElementById('navMenu');
const mobileNav = document.getElementById('mobileNav');

navMenu.addEventListener('click', () => {
  mobileNav.classList.toggle('open');
});

function closeMobile() { mobileNav.classList.remove('open'); }

/* ─── 5. CANVAS HEX BACKGROUND ──────────────────────── */
const canvas = document.getElementById('bgCanvas');
const ctx    = canvas.getContext('2d');
let   W, H, hexes = [];

function resizeCanvas() {
  W = canvas.width  = canvas.offsetWidth;
  H = canvas.height = canvas.offsetHeight;
  buildHexGrid();
}

function buildHexGrid() {
  hexes = [];
  const size = 36;
  const cols = Math.ceil(W / (size * 1.732)) + 2;
  const rows = Math.ceil(H / (size * 1.5))   + 2;

  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = c * size * 1.732 + (r % 2 === 0 ? 0 : size * 0.866);
      const y = r * size * 1.5;
      hexes.push({
        x, y, size,
        alpha:   Math.random() * 0.4 + 0.05,
        pulse:   Math.random() * Math.PI * 2,
        speed:   0.004 + Math.random() * 0.006
      });
    }
  }
}

function drawHex(x, y, size, alpha) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const px = x + size * Math.cos(angle);
    const py = y + size * Math.sin(angle);
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = `rgba(0,229,170,${alpha})`;
  ctx.lineWidth   = 0.5;
  ctx.stroke();
}

function animateCanvas() {
  ctx.clearRect(0, 0, W, H);
  const t = performance.now() * 0.001;
  hexes.forEach(h => {
    h.pulse += h.speed;
    const a = h.alpha * (0.5 + 0.5 * Math.sin(h.pulse + t));
    drawHex(h.x, h.y, h.size, a);
  });
  requestAnimationFrame(animateCanvas);
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();
animateCanvas();

/* ─── 6. SCROLL ANIMATIONS (GSAP + ScrollTrigger) ──── */

// Helper: fade-up a set of elements
function scrollFadeUp(targets, options = {}) {
  gsap.utils.toArray(targets).forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, y: 50 },
      {
        opacity: 1, y: 0,
        duration: options.duration || 0.7,
        delay: (options.staggerDelay || 0.1) * i,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          start: options.start || 'top 85%',
          toggleActions: 'play none none none'
        }
      }
    );
  });
}

// Helper: fade from left
function scrollFadeLeft(targets) {
  gsap.utils.toArray(targets).forEach((el, i) => {
    gsap.fromTo(el,
      { opacity: 0, x: -40 },
      {
        opacity: 1, x: 0,
        duration: 0.7,
        delay: i * 0.12,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' }
      }
    );
  });
}

// ABOUT section
scrollFadeUp('.about-left', { staggerDelay: 0 });
scrollFadeUp('.about-right', { staggerDelay: 0 });
scrollFadeLeft('.badge');

// SECTION TITLES + TAGS
scrollFadeUp('.section-tag', { duration: 0.5 });
scrollFadeUp('.section-title', { duration: 0.6 });

// PROJECT CARDS — staggered with slight skew
gsap.utils.toArray('.project-card').forEach((card, i) => {
  gsap.fromTo(card,
    { opacity: 0, y: 60, skewY: 1.5 },
    {
      opacity: 1, y: 0, skewY: 0,
      duration: 0.8,
      delay: i * 0.12,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 88%',
        toggleActions: 'play none none none'
      }
    }
  );
});

// DASHBOARD CARDS
gsap.utils.toArray('.dash-card').forEach((card, i) => {
  gsap.fromTo(card,
    { opacity: 0, y: 40 },
    {
      opacity: 1, y: 0,
      duration: 0.6,
      delay: i * 0.1,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: card,
        start: 'top 85%',
        toggleActions: 'play none none none',
        onEnter: () => {
          // trigger chart init and learning bars on enter
          if (i === 0) initRadarChart();
          if (i === 1) initBarChart();
          if (i === 3) animateLearningBars();
        }
      }
    }
  );
});

// INTERNSHIP
scrollFadeUp('.int-header');
gsap.utils.toArray('.int-meta-item').forEach((el, i) => {
  gsap.fromTo(el,
    { opacity: 0, x: -20 },
    {
      opacity: 1, x: 0,
      duration: 0.5, delay: i * 0.1, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
    }
  );
});
gsap.utils.toArray('.int-task-item').forEach((el, i) => {
  gsap.fromTo(el,
    { opacity: 0, x: 20 },
    {
      opacity: 1, x: 0,
      duration: 0.5, delay: i * 0.1, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
    }
  );
});

// CONTACT
scrollFadeUp('.contact-left');
gsap.utils.toArray('.clink').forEach((el, i) => {
  gsap.fromTo(el,
    { opacity: 0, x: 30 },
    {
      opacity: 1, x: 0,
      duration: 0.5, delay: i * 0.12, ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 90%', toggleActions: 'play none none none' }
    }
  );
});

/* ─── 7. LEARNING PROGRESS BARS ──────────────────────── */
let barsAnimated = false;
function animateLearningBars() {
  if (barsAnimated) return;
  barsAnimated = true;
  document.querySelectorAll('.learn-fill').forEach(bar => {
    bar.style.width = bar.dataset.w + '%';
  });
}

/* ─── 8. CHART.JS — RADAR ────────────────────────────── */
let radarInited = false;
function initRadarChart() {
  if (radarInited) return;
  radarInited = true;

  const ctx = document.getElementById('radarChart').getContext('2d');
  new Chart(ctx, {
    type: 'radar',
    data: {
      labels: ['Redes', 'Pentesting Web', 'Forensia', 'Linux / Servidores', 'Desarrollo', 'Seguridad Ofensiva'],
      datasets: [{
        label: 'Nivel actual',
        data: [72, 55, 50, 65, 60, 45],
        backgroundColor: 'rgba(0,229,170,0.12)',
        borderColor: '#00e5aa',
        borderWidth: 2,
        pointBackgroundColor: '#00e5aa',
        pointBorderColor: '#00e5aa',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1200, easing: 'easeInOutQuart' },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: {
            stepSize: 25,
            display: false
          },
          grid:        { color: 'rgba(26,34,50,0.8)' },
          angleLines:  { color: 'rgba(26,34,50,0.8)' },
          pointLabels: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 10 }
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c1018',
          borderColor: '#1a2232',
          borderWidth: 1,
          titleColor: '#00e5aa',
          bodyColor: '#94a3b8',
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont:  { family: "'JetBrains Mono', monospace", size: 11 },
          callbacks: { label: ctx => ` ${ctx.raw} / 100` }
        }
      }
    }
  });
}

/* ─── 9. CHART.JS — BAR ──────────────────────────────── */
let barInited = false;
function initBarChart() {
  if (barInited) return;
  barInited = true;

  const ctx = document.getElementById('barChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Nmap', 'Wireshark', 'Kali', 'VMware', 'Cisco PT', 'GNS3', 'Hashcat', 'Autopsy'],
      datasets: [{
        label: 'Dominio (%)',
        data: [80, 65, 60, 75, 70, 60, 50, 55],
        backgroundColor: (ctx) => {
          const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 200);
          g.addColorStop(0, 'rgba(0,229,170,0.9)');
          g.addColorStop(1, 'rgba(14,165,233,0.4)');
          return g;
        },
        borderColor: 'rgba(0,229,170,0.3)',
        borderWidth: 1,
        borderRadius: 2,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1100, easing: 'easeOutQuart' },
      indexAxis: 'y',
      scales: {
        x: {
          min: 0, max: 100,
          grid:  { color: 'rgba(26,34,50,0.6)' },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 10 },
            callback: v => v + '%'
          },
          border: { color: 'rgba(26,34,50,0.8)' }
        },
        y: {
          grid:  { display: false },
          ticks: {
            color: '#94a3b8',
            font: { family: "'JetBrains Mono', monospace", size: 10 }
          },
          border: { color: 'rgba(26,34,50,0.8)' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0c1018',
          borderColor: '#1a2232',
          borderWidth: 1,
          titleColor: '#00e5aa',
          bodyColor: '#94a3b8',
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont:  { family: "'JetBrains Mono', monospace", size: 11 },
          callbacks: { label: ctx => ` ${ctx.raw}% de dominio` }
        }
      }
    }
  });
}

/* ─── 10. ACTIVE NAV HIGHLIGHT ───────────────────────── */
const sections = document.querySelectorAll('section[id]');
const navLinks  = document.querySelectorAll('.nav-links a');

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(a => {
        const active = a.getAttribute('href') === '#' + e.target.id;
        a.style.color = active ? 'var(--accent)' : '';
      });
    }
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => navObserver.observe(s));
