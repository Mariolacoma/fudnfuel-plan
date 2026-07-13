// /api/generate.js — Vercel Serverless Function
// Intermediario entre tu app y OpenRouter. Tu API key vive solo en el servidor.
// Prueba varios modelos gratis en fila: si uno falla o se satura, usa el siguiente.

export const config = { maxDuration: 60 };

// Se intentan en orden hasta que uno responda bien.
const MODELS = [
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "openai/gpt-oss-120b:free",
  "google/gemma-4-31b-it:free",
  "deepseek/deepseek-chat-v3-0324:free",
];

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const API_KEY = process.env.OPENROUTER_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "API key no configurada en el servidor" });
  }

  const { prompt, maxTokens = 2000 } = req.body || {};
  if (!prompt) {
    return res.status(400).json({ error: "Se requiere un prompt" });
  }

  let lastDetail = "";
  for (const model of MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`,
          "HTTP-Referer": "https://fudnfuel-plan.vercel.app",
          "X-Title": "FudnFuel Plan",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!response.ok) {
        lastDetail = `${model} -> HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`;
        continue;
      }

      const data = await response.json();
      const text = data.choices?.[0]?.message?.content || "";
      if (text) {
        return res.status(200).json({ text, model });
      }
      lastDetail = `${model} -> respuesta vacía`;
    } catch (e) {
      lastDetail = `${model} -> ${(e && e.message) || "error"}`;
    }
  }

  console.error("OpenRouter falló en todos los modelos:", lastDetail);
  return res.status(502).json({ error: "La IA está saturada en este momento. Espera unos segundos e intenta de nuevo." });
}
