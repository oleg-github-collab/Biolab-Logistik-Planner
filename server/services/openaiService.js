const fs = require('fs');
const logger = require('../utils/logger');

const OPENAI_API_BASE = 'https://api.openai.com/v1';

const fetchFn = globalThis.fetch;
const FormDataImpl = globalThis.FormData;

if (!fetchFn || !FormDataImpl) {
  throw new Error('Node runtime must expose fetch and FormData (Node 18+ has built-in support)');
}

const getOpenAIKey = () => {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return key;
};

const buildHeaders = (contentType = 'application/json') => {
  return {
    Authorization: `Bearer ${getOpenAIKey()}`,
    'Content-Type': contentType
  };
};

const transcribeAudio = async (filePath, language = 'auto') => {
const formData = new FormDataImpl();
  formData.set('model', 'whisper-1');
  formData.set('file', fs.createReadStream(filePath));
  if (language && language !== 'auto') {
    formData.set('language', language);
  }

  const response = await fetchFn(`${OPENAI_API_BASE}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`
    },
    body: formData
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI transcription failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  return payload.text;
};

const createInstructionDraft = async (transcript) => {
  const systemPrompt = `Du bist ein deutscher Knowledge-Base-Autor für Labor- und Logistikteams. Aus einer Nutzereingabe formulierst du klare, strukturierte Schritt-für-Schritt-Anleitungen, Vorschläge für Titel und kurze Zusammenfassungen.`;
  const userPrompt = `Transkription:\n${transcript}\n\nAntworte ausschließlich mit gültigem JSON im folgenden Format:\n{\n  "title": "...",\n  "summary": "...",\n  "steps": ["Schritt 1", "Schritt 2"],\n  "details": "..."\n}`;

  const response = await fetchFn(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI completion failed: ${response.status} ${body}`);
  }

  const payload = await response.json();
  const message = payload.choices?.[0]?.message?.content || '';
  const jsonStart = message.indexOf('{');
  const jsonEnd = message.lastIndexOf('}');
  let parsed = null;

  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const jsonMatch = message.substring(jsonStart, jsonEnd + 1);
    try {
      parsed = JSON.parse(jsonMatch);
    } catch (error) {
      logger.warn('OpenAI instruction output could not be parsed as JSON, falling back to raw text');
    }
  } else {
    logger.warn('OpenAI instruction output did not contain JSON, falling back to raw text');
  }

  const draft = {
    title: (parsed?.title || '').trim() || 'Neue Wissensbasis-Anleitung',
    summary: (parsed?.summary || parsed?.details || '').trim() || transcript.trim().slice(0, 200),
    steps: Array.isArray(parsed?.steps) ? parsed.steps.filter(Boolean) : [],
    details: (parsed?.details || '').trim(),
    transcript: transcript.trim()
  };

  const stepsText = draft.steps.map((step, index) => `${index + 1}. ${step}`).join('\n');
  draft.content = [draft.summary, stepsText, draft.details].filter(Boolean).join('\n\n');

  return draft;
};

module.exports = {
  transcribeAudio,
  createInstructionDraft
};
