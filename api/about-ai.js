/**
 * Portfolio AI Assistant API
 * Production-ready endpoint with circuit breaker, retry logic, and structured logging
 * @version 1.0.0
 */

// Validar env vars críticas
if (!process.env.GEMINI_API_KEY) {
  console.error('CRITICAL: Missing GEMINI_API_KEY environment variable');
  process.exit(1);
}

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_REQUESTS = 16;
const RATE_BLOCK_MS = 2 * 60 * 1000;
const MAX_CONTEXT_CHARS = 1800;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const API_VERSION = '1.0.0';
const CACHE_TTL_MS = 3600 * 1000; // 1 hora
const BOT_PATTERNS = /bot|crawler|spider|scraper|curl|wget|python|java(?!script)|go-http|axios/i;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

const rateBuckets = new Map();
const responseCache = new Map();

// Circuit breaker para Gemini API
const circuitBreaker = {
  failures: 0,
  maxFailures: 5,
  isOpen: false,
  openUntil: 0,
  resetTimeout: 60 * 1000 // 1 minuto
};

// Simple hash function para caching
function hashQuestion(question) {
  let hash = 0;
  for (let i = 0; i < question.length; i++) {
    const char = question.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Generate simple request ID
/**
 * @returns {string} ID único para request
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Logging estructurado en JSON
/**
 * @param {object} data - Datos a loguear
 */
function structuredLog(data) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    ...data
  }));
}

// Bot detection
/**
 * @param {string} userAgent - User-Agent header
 * @returns {boolean} True si es bot
 */
function isBot(userAgent = '') {
  return BOT_PATTERNS.test(userAgent);
}

function sanitizeQuestion(text) {
  return String(text || '').trim().slice(0, 320);
}

function sanitizeRecentQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeQuestion(item))
    .filter(Boolean)
    .slice(-3);
}

function sanitizeRecentBotAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim().slice(0, 420))
    .filter(Boolean)
    .slice(-2);
}

function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff[0]) return String(xff[0]).trim();
  return String(req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown');
}

function consumeRateLimit(ip) {
  const now = Date.now();
  const key = ip || 'unknown';
  const bucket = rateBuckets.get(key) || { hits: [], blockedUntil: 0 };

  if (bucket.blockedUntil > now) {
    const retryAfter = Math.max(1, Math.ceil((bucket.blockedUntil - now) / 1000));
    return { allowed: false, retryAfter };
  }

  bucket.hits = bucket.hits.filter((ts) => now - ts < RATE_WINDOW_MS);
  bucket.hits.push(now);

  if (bucket.hits.length > RATE_MAX_REQUESTS) {
    bucket.blockedUntil = now + RATE_BLOCK_MS;
    rateBuckets.set(key, bucket);
    return { allowed: false, retryAfter: Math.ceil(RATE_BLOCK_MS / 1000) };
  }

  rateBuckets.set(key, bucket);

  // Soft cleanup to keep memory bounded.
  if (rateBuckets.size > 2000) {
    for (const [bucketKey, value] of rateBuckets.entries()) {
      const activeHits = value.hits.filter((ts) => now - ts < RATE_WINDOW_MS);
      const stillBlocked = value.blockedUntil > now;
      if (!activeHits.length && !stillBlocked) rateBuckets.delete(bucketKey);
    }
  }

  return { allowed: true, retryAfter: 0 };
}

function extractAnswer(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join(' ')
    .trim();
}

// Retry wrapper para fetch
/**
 * @param {string} url - URL a fetchear
 * @param {object} options - Opciones de fetch
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}, maxRetries = MAX_RETRIES) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      
      // No reintentar si es 401, 403, 400
      if ([400, 401, 403].includes(response.status)) throw response;
      
      lastError = response;
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }
    }
  }
  
  throw lastError;
}

async function readJsonBody(req) {
  // In serverless runtimes (like Vercel), body may be pre-parsed.
  if (req && typeof req.body === 'object' && req.body !== null) {
    return req.body;
  }

  if (typeof req.body === 'string') {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (raw) {
    return JSON.parse(raw);
  }

  return {};
}

module.exports = async function handler(req, res) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const userAgent = req.headers['user-agent'] || '';
  
  // CORS Headers (dinámico)
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS, GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-ID, X-API-Key');
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-API-Version', API_VERSION);
  res.setHeader('Content-Encoding', 'gzip'); // Señal de compresión (ya manejado por runtime)
  
  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Bot detection
  if (isBot(userAgent)) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'bot_rejected',
      userAgent: userAgent.slice(0, 100)
    });
    res.status(403).json({ error: 'Bot access denied', requestId });
    return;
  }

  // Healthcheck endpoint
  if (req.method === 'GET' && (req.url === '/health' || req.url === '/api/about-ai/health')) {
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      model: DEFAULT_MODEL,
      version: API_VERSION,
      circuitBreaker: circuitBreaker.isOpen ? 'OPEN' : 'CLOSED'
    });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'method_not_allowed',
      method: req.method
    });
    res.status(405).json({ error: 'Method not allowed', requestId });
    return;
  }

  // Content-Type validation
  const contentType = req.headers['content-type'];
  if (!contentType || !contentType.includes('application/json')) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'invalid_content_type',
      contentType
    });
    res.status(400).json({ error: 'Content-Type must be application/json', requestId });
    return;
  }

  // API Key authorization (opcional)
  const requestApiKey = req.headers['x-api-key'];
  const allowedApiKey = process.env.ALLOWED_API_KEY;
  if (allowedApiKey && requestApiKey && requestApiKey !== allowedApiKey) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'invalid_api_key'
    });
    res.status(401).json({ error: 'Invalid API key', requestId });
    return;
  }

  const ip = getClientIp(req);
  
  // Validar que IP sea válida (rechazar 'unknown')
  if (ip === 'unknown') {
    structuredLog({
      requestId,
      level: 'ERROR',
      event: 'cannot_determine_ip'
    });
    res.status(400).json({ error: 'Cannot determine client IP', requestId });
    return;
  }

  // Circuit breaker check
  const now = Date.now();
  if (circuitBreaker.isOpen && now < circuitBreaker.openUntil) {
    structuredLog({
      requestId,
      level: 'ERROR',
      event: 'circuit_breaker_open',
      openUntil: new Date(circuitBreaker.openUntil).toISOString()
    });
    res.status(503).json({ error: 'Service temporarily unavailable', requestId });
    return;
  }
  
  // Reset circuit breaker si pasó el timeout
  if (circuitBreaker.isOpen && now >= circuitBreaker.openUntil) {
    circuitBreaker.isOpen = false;
    circuitBreaker.failures = 0;
    structuredLog({
      requestId,
      level: 'INFO',
      event: 'circuit_breaker_reset'
    });
  }

  const rate = consumeRateLimit(ip);
  if (!rate.allowed) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'rate_limit_exceeded',
      ip,
      retryAfter: rate.retryAfter
    });
    res.setHeader('Retry-After', String(rate.retryAfter));
    res.status(429).json({ error: 'Too many requests', retryAfter: rate.retryAfter, requestId });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    structuredLog({
      requestId,
      level: 'ERROR',
      event: 'missing_gemini_api_key'
    });
    res.status(503).json({ error: 'Missing GEMINI_API_KEY', requestId });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'json_parse_error',
      error: error.message
    });
    res.status(400).json({ error: 'Invalid JSON body', details: error.message, requestId });
    return;
  }

  const question = sanitizeQuestion(body.question);
  const recentQuestions = sanitizeRecentQuestions(body.recentQuestions);
  const recentBotAnswers = sanitizeRecentBotAnswers(body.recentBotAnswers);

  if (!question) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'empty_question',
      ip
    });
    res.status(400).json({ error: 'Question is required', requestId });
    return;
  }

  if (question.length < 3) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'question_too_short',
      ip,
      length: question.length
    });
    res.status(400).json({ error: 'Question must be at least 3 characters', requestId });
    return;
  }

  // Cache check
  const cacheKey = hashQuestion(question);
  const cached = responseCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    structuredLog({
      requestId,
      level: 'INFO',
      event: 'cache_hit',
      ip,
      question: question.slice(0, 60),
      responseTime: Date.now() - startTime
    });
    res.status(200).json({ answer: cached.answer, fromCache: true, requestId });
    return;
  }

  const contextSize = recentQuestions.join(' ').length + recentBotAnswers.join(' ').length;
  if (contextSize > MAX_CONTEXT_CHARS) {
    structuredLog({
      requestId,
      level: 'WARN',
      event: 'context_too_long',
      ip,
      contextSize
    });
    res.status(400).json({ error: 'Context too long', requestId });
    return;
  }

  const isEnglishQuestion = /\b(what|how|where|when|why|who|your|experience|project|skills|contact|hello|hi)\b/i.test(question);

  const systemPrompt = [
    'Eres el asistente personal de Alexander Villarroel Torrico.',
    'Responde SOLO sobre su perfil profesional, estudios, skills, experiencia, proyectos y contacto.',
    'No inventes datos. Si no tienes un dato, dilo de forma breve.',
    isEnglishQuestion
      ? 'Responde en ingles claro, profesional y conciso (maximo 6 lineas).'
      : 'Responde en espanol claro, profesional y conciso (maximo 6 lineas).',
    'Si la pregunta es amplia, prioriza: 1) dato concreto, 2) contexto breve, 3) cierre util.',
    'No uses relleno ni respuestas vagas.'
  ].join(' ');

  const profileContext = [
    'Nombre: Alexander Jonathan Villarroel Torrico.',
    'Ubicacion: La Paz, Bolivia.',
    'Estudios: Carrera de Informatica en UMSA.',
    'Enfoque: ciberseguridad, redes y forensia digital.',
    'Entorno: Windows y Linux.',
    'Idiomas: espanol nativo, ingles B1.',
    'Experiencia: practica profesional IT y Redes en Facultad de Ciencias Geologicas UMSA (inventario hardware, mapeo de red, servidor Linux, informe tecnico).',
    'Proyectos: Biblioteca Juridica (Supabase, OAuth hardening, RLS), PassGen con Web Crypto API, script .bat de inventario de red.',
    'Objetivo: pentesting web o seguridad de redes en equipos que protejan infraestructura critica.'
  ].join(' ');

  const recentContext = recentQuestions.length
    ? recentQuestions.map((item, idx) => `${idx + 1}) ${item}`).join('\n')
    : 'Sin historial reciente.';

  const recentBotContext = recentBotAnswers.length
    ? recentBotAnswers.map((item, idx) => `${idx + 1}) ${item}`).join('\n')
    : 'Sin respuestas previas del asistente.';

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`;

  structuredLog({
    requestId,
    level: 'INFO',
    event: 'gemini_request_start',
    ip,
    question: question.slice(0, 60),
    contextQuestionsCount: recentQuestions.length
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const geminiResponse = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\nContexto del perfil:\n${profileContext}\n\nHistorial reciente del chat (ultimas 3 preguntas):\n${recentContext}\n\nUltimas 2 respuestas del asistente:\n${recentBotContext}\n\nPregunta actual del visitante: ${question}` }
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 220,
          topP: 0.85,
        },
      }),
    });

    clearTimeout(timeout);

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      circuitBreaker.failures++;
      
      structuredLog({
        requestId,
        level: 'ERROR',
        event: 'gemini_api_error',
        status: geminiResponse.status,
        cbFailures: circuitBreaker.failures,
        error: errText.slice(0, 200)
      });
      
      // Abrir circuit breaker si alcanzó max failures
      if (circuitBreaker.failures >= circuitBreaker.maxFailures) {
        circuitBreaker.isOpen = true;
        circuitBreaker.openUntil = Date.now() + circuitBreaker.resetTimeout;
        structuredLog({
          requestId,
          level: 'CRITICAL',
          event: 'circuit_breaker_opened'
        });
      }
      
      if (geminiResponse.status === 401) {
        res.status(503).json({ error: 'Invalid API key', requestId });
      } else if (geminiResponse.status === 429) {
        res.status(502).json({ error: 'Gemini API rate limited', requestId });
      } else {
        res.status(502).json({ error: 'Gemini API request failed', details: errText.slice(0, 200), requestId });
      }
      return;
    }

    // Reset circuit breaker en éxito
    circuitBreaker.failures = 0;

    let payload;
    try {
      payload = await geminiResponse.json();
    } catch (parseError) {
      structuredLog({
        requestId,
        level: 'ERROR',
        event: 'gemini_json_parse_error',
        error: parseError.message
      });
      res.status(502).json({ error: 'Invalid Gemini API response', requestId });
      return;
    }

    const answer = extractAnswer(payload);

    if (!answer) {
      circuitBreaker.failures++;
      structuredLog({
        requestId,
        level: 'ERROR',
        event: 'gemini_empty_answer',
        cbFailures: circuitBreaker.failures,
        question: question.slice(0, 50)
      });
      res.status(502).json({ error: 'Gemini API returned empty answer', requestId });
      return;
    }

    // Guardar en cache
    responseCache.set(cacheKey, {
      answer,
      timestamp: Date.now()
    });

    // Limpiar cache si crece demasiado
    if (responseCache.size > 500) {
      const now = Date.now();
      for (const [key, val] of responseCache.entries()) {
        if (now - val.timestamp > CACHE_TTL_MS) {
          responseCache.delete(key);
        }
      }
    }

    const responseTime = Date.now() - startTime;
    structuredLog({
      requestId,
      level: 'INFO',
      event: 'success',
      ip,
      question: question.slice(0, 60),
      answerLength: answer.length,
      responseTime,
      cacheSize: responseCache.size
    });
    
    res.status(200).json({ answer, fromCache: false, requestId });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    if (error.name === 'AbortError') {
      circuitBreaker.failures++;
      structuredLog({
        requestId,
        level: 'ERROR',
        event: 'gemini_timeout',
        ip,
        cbFailures: circuitBreaker.failures,
        responseTime
      });
      res.status(504).json({ error: 'Gemini API timeout (30s)', details: 'Please try again', requestId });
    } else {
      circuitBreaker.failures++;
      structuredLog({
        requestId,
        level: 'ERROR',
        event: 'internal_error',
        cbFailures: circuitBreaker.failures,
        error: error?.message || error,
        responseTime
      });
      res.status(500).json({ error: 'Internal server error', details: String(error?.message || error), requestId });
    }
  }
};
