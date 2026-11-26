import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

interface AuditSubscriptionInput {
  id: string;
  name: string;
  category: string;
  price: number;
  yourShare: number;
  cycle: string;
  status: string;
  nextBillingDate: string;
  splitCount: number;
  notes?: string;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  const resolveGeminiApiKey = (req: express.Request): string => {
    const headerKey = req.header('x-gemini-api-key')?.trim();
    if (headerKey && headerKey !== 'MY_GEMINI_API_KEY') {
      return headerKey;
    }
    const envKey = process.env.GEMINI_API_KEY?.trim();
    if (envKey && envKey !== 'MY_GEMINI_API_KEY') {
      return envKey;
    }
    return '';
  };

  app.post('/api/ai/verify', async (req, res) => {
    const apiKey = resolveGeminiApiKey(req);
    if (!apiKey) {
      res.status(400).json({
        ok: false,
        error: 'Enter a Gemini API key to verify.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
      await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: 'Reply with OK',
      });
      res.json({ ok: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to verify Gemini API key.';
      res.status(401).json({ ok: false, error: message });
    }
  });

  app.post('/api/audit', async (req, res) => {
    const apiKey = resolveGeminiApiKey(req);
    if (!apiKey) {
      res.status(400).json({
        error: 'No Gemini API key configured. Enable optional AI features and enter your own key in Settings.',
      });
      return;
    }

    const { subscriptions, monthlyBudgetCap, currency } = req.body as {
      subscriptions?: AuditSubscriptionInput[];
      monthlyBudgetCap?: number;
      currency?: string;
    };

    if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
      res.status(400).json({
        error: 'Provide at least one subscription to audit.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const compactList = subscriptions.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        totalPrice: s.price,
        yourMonthlyShare: s.yourShare,
        cycle: s.cycle,
        status: s.status,
        nextBillingDate: s.nextBillingDate,
        splitCount: s.splitCount,
        notes: s.notes ?? '',
      }));

      const prompt = [
        `You are a concise personal finance subscription auditor for SubPulse.`,
        `Currency: ${currency || 'USD'}. Monthly budget cap: ${monthlyBudgetCap ?? 250}.`,
        `Today's reference date: 2026-11-26.`,
        `Analyze these subscriptions and identify concrete opportunities to save money:`,
        `- Trials ending soon that should be reviewed or cancelled before renewal`,
        `- Overlapping or duplicate services (e.g., multiple cloud storage plans, multiple AI tools, multiple music/video services)`,
        `- High-cost plans that could be downgraded, paused, or split across household members`,
        `Subscriptions JSON:`,
        JSON.stringify(compactList),
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction:
            'Return actionable, realistic subscription audit recommendations grounded strictly in the provided list. Keep reasons under 18 words.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: {
                type: Type.STRING,
                description: 'One concise sentence summarizing total potential monthly savings and top priority.',
              },
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subscriptionId: { type: Type.STRING },
                    subscriptionName: { type: Type.STRING },
                    actionType: {
                      type: Type.STRING,
                      description: 'One of: cancel, consolidate, downgrade, review',
                    },
                    headline: { type: Type.STRING },
                    reason: { type: Type.STRING },
                    monthlySavings: { type: Type.NUMBER },
                  },
                  required: [
                    'subscriptionId',
                    'subscriptionName',
                    'actionType',
                    'headline',
                    'reason',
                    'monthlySavings',
                  ],
                },
              },
            },
            required: ['summary', 'recommendations'],
          },
        },
      });

      const text = (response.text ?? '{}').trim();
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to run Gemini subscription audit.';
      res.status(502).json({ error: message });
    }
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SubPulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
