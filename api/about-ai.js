const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

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

function extractAnswer(payload) {
  const candidate = payload?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join(' ')
    .trim();
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
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(503).json({ error: 'Missing GEMINI_API_KEY' });
    return;
  }

  let body;
  try {
    body = await readJsonBody(req);
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const question = sanitizeQuestion(body.question);
  const recentQuestions = sanitizeRecentQuestions(body.recentQuestions);
  const recentBotAnswers = sanitizeRecentBotAnswers(body.recentBotAnswers);

  if (!question) {
    res.status(400).json({ error: 'Question is required' });
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

  try {
    const geminiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      res.status(502).json({ error: 'Gemini API request failed', details: errText.slice(0, 500) });
      return;
    }

    const payload = await geminiResponse.json();
    const answer = extractAnswer(payload);

    if (!answer) {
      res.status(502).json({ error: 'Gemini API returned empty answer' });
      return;
    }

    res.status(200).json({ answer });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: String(error?.message || error) });
  }
};
