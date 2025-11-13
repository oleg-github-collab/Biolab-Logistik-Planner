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

  // Force German language for better accuracy
  if (language === 'de' || language === 'auto') {
    formData.set('language', 'de');
  } else if (language && language !== 'auto') {
    formData.set('language', language);
  }

  // Add prompt to guide Whisper for lab/logistics terminology
  formData.set('prompt', 'Labor, Logistik, Entsorgung, Probe, Reagenz, Chemikalien, Sicherheit');

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
  const systemPrompt = `Du bist ein professioneller Knowledge-Base-Autor für Labor- und Logistikteams.

DEINE AUFGABE:
1. Transkribiere und korrigiere die Nutzereingabe (Rechtschreibung, Grammatik, Fachbegriffe)
2. Formuliere ALLES auf Deutsch in einem klaren, lehrreichen, aber leicht verständlichen Stil
3. Strukturiere den Inhalt in logische Schritte
4. Verwende korrekte Fachterminologie für Labor- und Logistikarbeit
5. Schreibe so, als würdest du einen neuen Mitarbeiter einarbeiten

STIL:
- Freundlich und professionell
- Präzise und konkret
- Leicht verständlich, aber fachlich korrekt
- Mit praktischen Beispielen wo sinnvoll

WICHTIG:
- Korrigiere ALLE Rechtschreibfehler
- Vervollständige unvollständige Sätze
- Formatiere Fachbegriffe korrekt (z.B. "pH-Wert", "PPE", "SOP")`;

  const userPrompt = `Transkription (kann Fehler enthalten):
${transcript}

Erstelle daraus einen strukturierten Wissensbasis-Artikel auf DEUTSCH.

Antworte ausschließlich mit gültigem JSON:
{
  "title": "Prägnanter Titel (max 80 Zeichen)",
  "summary": "Kurze Zusammenfassung (2-3 Sätze, was der Leser lernt)",
  "steps": ["Schritt 1: Beschreibung", "Schritt 2: Beschreibung", ...],
  "details": "Zusätzliche Details, Hinweise, Sicherheitsaspekte, Best Practices"
}

ALLE Texte müssen auf Deutsch sein, korrekt geschrieben und leicht verständlich.`;

  const response = await fetchFn(`${OPENAI_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.3,
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
