import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constantes de configuración de seguridad
const FIREBASE_PROJECT_ID = 'fintrack-gt';
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 15; // 15 solicitudes por minuto por usuario/IP

// ─── Control de Tasa (Rate Limiting en Memoria) ────────────────────────────

interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  record.count += 1;
  return false;
}

// Limpieza periódica de registros de tasa expirados
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 300_000);

// ─── Verificación de Identidad (Firebase Auth ID Token) ────────────────────

interface TokenVerificationResult {
  valid: boolean;
  uid?: string;
  error?: string;
}

async function verifyAuthToken(authHeader: string | undefined): Promise<TokenVerificationResult> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Cabecera de autenticación requerida.' };
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return { valid: false, error: 'Token de acceso ausente.' };
  }

  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    if (!res.ok) {
      return { valid: false, error: 'Token de sesión expirado o inválido.' };
    }
    const info = (await res.json()) as any;

    // Verificar audiencia con el proyecto de Firebase
    if (info.aud && info.aud !== FIREBASE_PROJECT_ID && !info.aud.includes(FIREBASE_PROJECT_ID)) {
      return { valid: false, error: 'Audiencia de token no autorizada.' };
    }

    const uid = info.user_id || info.sub;
    if (!uid) {
      return { valid: false, error: 'Token no contiene identificador de usuario válido.' };
    }

    return { valid: true, uid };
  } catch (err) {
    return { valid: false, error: 'Error comunicando con el proveedor de autenticación.' };
  }
}

// ─── Validación de Esquema y Rangos ────────────────────────────────────────

function validatePayload(body: any): { ok: boolean; error?: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'El cuerpo debe ser un objeto JSON.' };
  }

  const { weekData, monthlyContext, cardTactics } = body;
  if (!weekData || typeof weekData !== 'object') {
    return { ok: false, error: 'Estructura weekData faltante o inválida.' };
  }
  if (!monthlyContext || typeof monthlyContext !== 'object') {
    return { ok: false, error: 'Estructura monthlyContext faltante o inválida.' };
  }

  // Validaciones numéricas de semana
  if (typeof weekData.weekIndex !== 'number' || weekData.weekIndex < 1 || weekData.weekIndex > 53) {
    return { ok: false, error: 'weekData.weekIndex fuera de rango (1-53).' };
  }
  if (typeof weekData.income !== 'number' || !Number.isFinite(weekData.income) || weekData.income < 0 || weekData.income > 50_000_000) {
    return { ok: false, error: 'weekData.income fuera de rango permitido.' };
  }
  if (typeof weekData.expenses !== 'number' || !Number.isFinite(weekData.expenses) || weekData.expenses < 0 || weekData.expenses > 50_000_000) {
    return { ok: false, error: 'weekData.expenses fuera de rango permitido.' };
  }
  if (typeof weekData.burnRateVsExpectedPct !== 'number' || !Number.isFinite(weekData.burnRateVsExpectedPct) || weekData.burnRateVsExpectedPct < 0 || weekData.burnRateVsExpectedPct > 2000) {
    return { ok: false, error: 'weekData.burnRateVsExpectedPct fuera de rango.' };
  }

  // Validaciones de contexto mensual
  if (typeof monthlyContext.score !== 'number' || monthlyContext.score < 0 || monthlyContext.score > 100) {
    return { ok: false, error: 'monthlyContext.score fuera de rango (0-100).' };
  }
  if (typeof monthlyContext.savingsRatePct !== 'number' || !Number.isFinite(monthlyContext.savingsRatePct)) {
    return { ok: false, error: 'monthlyContext.savingsRatePct inválido.' };
  }
  if (typeof monthlyContext.liquidityMonths !== 'number' || !Number.isFinite(monthlyContext.liquidityMonths)) {
    return { ok: false, error: 'monthlyContext.liquidityMonths inválido.' };
  }

  // Tácticas de tarjeta si existen
  if (cardTactics !== undefined && cardTactics !== null) {
    if (typeof cardTactics !== 'object') {
      return { ok: false, error: 'cardTactics debe ser un objeto o null.' };
    }
    const allowed = ['strategy', 'window', 'due_reminder', 'warning'];
    if (cardTactics.type && !allowed.includes(cardTactics.type)) {
      return { ok: false, error: 'cardTactics.type no reconocido.' };
    }
  }

  return { ok: true };
}

// ─── Inicialización de Express ─────────────────────────────────────────────

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  // Límite estricto de tamaño de carga útil para evitar ataques por saturación
  app.use(express.json({ limit: '64kb' }));

  // API Route para Inferencia Financiera con IA
  // Recibe exclusivamente métricas numéricas agregadas (sin PII ni notas)
  app.post('/api/financial-inference', async (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

      // 1. Verificación de Autenticación
      const authHeader = req.headers.authorization;
      const authResult = await verifyAuthToken(authHeader);

      if (!authResult.valid) {
        // En entorno local de desarrollo sin conexión o token de prueba, permitir fallback controlado
        const isDev = process.env.NODE_ENV !== 'production';
        if (!isDev) {
          return res.status(401).json({
            ok: false,
            error: authResult.error || 'Acceso no autorizado.',
          });
        }
      }

      // 2. Control de Tasa (Rate Limiting)
      const rateLimitKey = authResult.uid ? `usr_${authResult.uid}` : `ip_${clientIp}`;
      if (isRateLimited(rateLimitKey)) {
        return res.status(429).json({
          ok: false,
          error: 'Límite de solicitudes de análisis alcanzado. Por favor espera un momento antes de reintentar.',
        });
      }

      // 3. Validación de Esquema y Límites de Entrada
      const validation = validatePayload(req.body);
      if (!validation.ok) {
        return res.status(400).json({
          ok: false,
          error: validation.error || 'Parámetros inválidos.',
        });
      }

      // 4. Verificación de Clave de API de Gemini en Servidor
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(503).json({
          ok: false,
          error: 'Servicio de inferencia temporalmente no disponible (clave no configurada).',
        });
      }

      const { weekData, monthlyContext, cardTactics } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Eres un asesor financiero patrimonial y analista cuantitativo para una aplicación de finanzas personales en Guatemala (moneda Quetzales, GTQ).
Se te proporcionan ÚNICAMENTE métricas agregadas, seudonimizadas y numéricas de una semana financiera del usuario (sin ningún nombre, sin identificadores de usuario, sin números de cuentas ni tarjetas).

Datos de la semana:
- Semana: ${Number(weekData.weekIndex)} (${String(weekData.startDate || '').slice(0, 10)} a ${String(weekData.endDate || '').slice(0, 10)})
- Ingresos de la semana: Q${Number(weekData.income).toFixed(2)}
- Egresos de la semana: Q${Number(weekData.expenses).toFixed(2)}
- Ritmo de gasto vs esperado semanal: ${Number(weekData.burnRateVsExpectedPct)}%
- Estado matemático preliminar: ${String(weekData.status || 'on_track')}

Contexto del mes:
- Ahorro acumulado neto: Q${Number(monthlyContext.netSavings).toFixed(2)}
- Tasa de ahorro del mes: ${Number(monthlyContext.savingsRatePct)}%
- Fondo de reserva disponible: ${Number(monthlyContext.liquidityMonths).toFixed(1)} meses
- Calificación de salud: ${Number(monthlyContext.score)}/100

Estrategia táctica de tarjetas (si aplica):
${cardTactics?.type ? `Tipo de evento: ${String(cardTactics.type)}` : 'Sin tarjetas de crédito o sin eventos críticos'}

Tu misión:
Generar un análisis inferencial dinámico, humano, motivador y sumamente inteligente:
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
      // Registrar solo el código y mensaje genérico, nunca payloads ni datos financieros
      console.error('[AI Proxy] Error procesando solicitud:', error?.code || error?.message || 'Error desconocido');
      return res.status(500).json({
        ok: false,
        error: 'Error al procesar la inferencia con IA.',
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
