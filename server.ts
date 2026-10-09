import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // API Route for AI Financial Inference
  // Strictly receives anonymous aggregated metrics (no PII, no account numbers, no bank names)
  app.post('/api/financial-inference', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          ok: false,
          error: 'GEMINI_API_KEY no configurada en el entorno.',
        });
      }

      const { weekData, monthlyContext, cardTactics } = req.body || {};

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Eres un asesor financiero patrimonial y analista cuantitativo para una aplicación de finanzas personales en Guatemala (moneda Quetzales, GTQ).
Se te proporcionan ÚNICAMENTE métricas agregadas, anónimas y numéricas de una semana financiera del usuario (sin ningún nombre, sin identificadores de usuario, sin números de cuentas ni tarjetas).

Datos de la semana:
- Semana: ${weekData?.weekIndex ?? 1} (${weekData?.startDate ?? ''} a ${weekData?.endDate ?? ''})
- Ingresos de la semana: Q${Number(weekData?.income ?? 0).toFixed(2)}
- Egresos de la semana: Q${Number(weekData?.expenses ?? 0).toFixed(2)}
- Ritmo de gasto vs esperado semanal: ${weekData?.burnRateVsExpectedPct ?? 100}%
- Estado matemático preliminar: ${weekData?.status ?? 'on_track'}
- Observación base: ${weekData?.highlight ?? 'N/A'}

Contexto del mes:
- Ahorro acumulado neto: Q${Number(monthlyContext?.netSavings ?? 0).toFixed(2)}
- Tasa de ahorro del mes: ${monthlyContext?.savingsRatePct ?? 0}%
- Fondo de reserva disponible: ${monthlyContext?.liquidityMonths ?? 0} meses
- Calificación de salud: ${monthlyContext?.score ?? 0}/100

Estrategia táctica de tarjetas (si aplica):
${cardTactics ? JSON.stringify(cardTactics) : 'Sin tarjetas de crédito o sin eventos críticos'}

Tu misión:
Generar un análisis inferencial dinámico, humano, motivador y sumamente inteligente. No uses respuestas prefabricadas, clichés ni plantillas repetitivas. Infiere tendencias a partir de los patrones numéricos:
1. "patterns": Describe en 1 o 2 oraciones qué patrón conductual o de ritmo de gasto se infiere de estos datos.
2. "actionableAdvice": Redacta un consejo táctico y fresco aplicable a los próximos días (máximo 2 oraciones concretas, amables y accionables).
3. "tone": Una sola palabra de tono ('positive' | 'caution' | 'optimistic' | 'urgent').

Responde ÚNICAMENTE en JSON válido con este formato exacto:
{
  "patterns": "...",
  "actionableAdvice": "...",
  "tone": "positive"
}`;

      let response;
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
      } catch (err: any) {
        console.warn('Primary model gemini-3.8-flash unavailable, trying gemini-3.1-flash-lite:', err?.message);
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        });
      }

      const raw = response.text || '{}';
      let parsed: { patterns?: string; actionableAdvice?: string; tone?: 'positive' | 'caution' | 'optimistic' | 'urgent' } = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = {
          patterns: 'El ritmo de gasto se mantiene balanceado respecto al flujo del período.',
          actionableAdvice: 'Continúa registrando tus compras diarias para preservar el margen de ahorro al cierre de mes.',
          tone: 'positive',
        };
      }

      return res.json({
        ok: true,
        data: {
          patterns: parsed.patterns || 'Ritmo financiero estable detectado durante la semana.',
          actionableAdvice: parsed.actionableAdvice || 'Monitorea egresos flexibles para consolidar la meta mensual de ahorro.',
          tone: parsed.tone || 'positive',
        },
      });
    } catch (error: any) {
      console.error('Error in /api/financial-inference:', error);
      return res.status(500).json({
        ok: false,
        error: error?.message || 'Error al procesar la inferencia con IA.',
      });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
