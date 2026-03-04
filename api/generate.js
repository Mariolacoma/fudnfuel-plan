// /api/generate.js — Vercel Serverless Function
// Este archivo actúa como intermediario entre tu app y Google Gemini.
// Tu API key NUNCA se expone al usuario, solo vive en el servidor.

export default async function handler(req, res) {
  // Solo permitir POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key no configurada en el servidor' });
  }

  try {
    const { prompt, maxTokens = 2000 } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Se requiere un prompt' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Gemini API error:', errorData);
      return res.status(response.status).json({ error: 'Error al conectar con la IA' });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

    return res.status(200).json({ text });
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
}
