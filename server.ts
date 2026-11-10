import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { validateUniversalWorldPlan, UNIVERSAL_ASSET_STARTER_PACK } from './src/utils/universalSceneWorld';
import {
  buildContextualDirectorFallback,
  validateAndNormalizeDirectorResponse,
  VALID_ACTIONS,
  VALID_CAMERAS,
  VALID_DRAMATIC_INTENTS,
  VALID_EMOTIONAL_STATES,
  VALID_ENVIRONMENTS,
  VALID_EXPRESSIONS,
  VALID_FILTERS,
  VALID_ICONS,
  VALID_MANEUVERS,
  VALID_PROPS,
  VALID_SFX,
} from './src/utils/cinematicDirector';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const withTimeout = <T>(promise: Promise<T>, ms = 9000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), ms)),
  ]);
};


// Universal scene graph: model/provider-neutral validation and planning.
app.post('/api/scene-world/validate', (req: Request, res: Response) => {
  const result = validateUniversalWorldPlan(req.body?.plan ?? req.body);
  return res.status(result.valid ? 200 : 422).json(result);
});

app.post('/api/ai/scene-world-plan', async (req: Request, res: Response) => {
  const prompt = String(req.body?.prompt || '').trim();
  const duration = Math.max(2, Math.min(90, Number(req.body?.duration) || 8));
  if (!prompt) return res.status(400).json({ error: 'prompt is required' });

  const ai = getAiClient();
  if (!ai) return res.status(503).json({
    error: 'GEMINI_API_KEY is not configured',
    hint: 'Any AI provider can call /api/scene-world/validate with a UniversalWorldPlan JSON object.',
  });

  try {
    const response = await withTimeout(ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Create a renderer-neutral 3D scene graph for this request: "${prompt}".
Duration: ${duration} seconds. Output ONLY valid JSON, no markdown.
This schema is provider-neutral and must not use renderer-specific code, scripts, shaders, URLs, or arbitrary component names.
Coordinate system: meters, Y-up. Include a coherent environment, all visible set pieces, characters, props, explicit physical interactions, and cinematic shots.
Do not assume a military scene. Build the requested location from semantic assets; use assetKey strings such as kitchen.counter, street.road, school.desk, sports.hoop, nature.tree, vehicle.car.
Every entity needs unique id, kind, assetKey, label, transform {position{x,y,z},rotation{x,y,z},scale{x,y,z}}.
Kinds: character, prop, architecture, nature, vehicle, terrain, light, vfx, decoration.
Interactions use actorId, targetId, verb, start, end, contactPoint, intent. Verbs: walk_to, look_at, reach, grab, release, carry, push, pull, open, close, sit, stand, climb, jump_to, throw, hand_over, use, custom.
Shots use start, end, type, subjectIds, movement. Shot types: establishing, wide, medium, close_up, over_shoulder, tracking, low_angle, high_angle.
Return this shape:
{ "schemaVersion":"1.0", "sceneId":"...", "duration":${duration},
"environment":{"description":"...","locationType":"...","visualStyle":"stylized_3d","timeOfDay":"...","weather":"...","lightingMood":"...","ground":"..."},
"entities":[...], "interactions":[...], "shots":[...], "notes":[] }
Important: at least one character, structural/environment objects, and meaningful interactions when the story requires contact.`,
      config: { responseMimeType: 'application/json' },
    }), 25000);

    let parsed: unknown;
    try { parsed = JSON.parse(response.text || '{}'); }
    catch { return res.status(502).json({ error: 'AI returned invalid JSON', raw: response.text || '' }); }
    const result = validateUniversalWorldPlan(parsed);
    return res.status(result.valid ? 200 : 422).json(result);
  } catch (error) {
    console.error('Universal scene planning failed:', error);
    return res.status(502).json({ error: 'Scene planning failed', details: String(error) });
  }
});

// 1. AI Auto-Captions / Script Generator
app.post('/api/ai/generate-captions', async (req: Request, res: Response) => {
  try {
    const { scriptOrPrompt, totalDuration = 12 } = req.body;
    const ai = getAiClient();

    if (!ai) {
      return res.json({
        captions: [
          { text: 'Bem-vindo ao StickStory Studio', startTime: 0.5, duration: 2.5 },
          { text: 'Direção de cenas animadas em tempo real', startTime: 3.5, duration: 3.0 },
          { text: 'História, emoção e movimento sincronizados', startTime: 7.0, duration: 3.5 },
        ],
      });
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Você é um assistente de legendagem de vídeo. Gere legendas divididas em segmentos com tempos de início e duração (em segundos) que caibam em um vídeo de ${totalDuration} segundos no total.
Texto ou tema do vídeo: "${scriptOrPrompt}".
Retorne APENAS um JSON válido no formato:
{
  "captions": [
    { "text": "Frase curta e impactante", "startTime": 0.5, "duration": 2.5 }
  ]
}`,
        config: {
          responseMimeType: 'application/json',
        },
      })
    );

    const data = JSON.parse(response.text || '{}');
    return res.json(data);
  } catch (error) {
    console.error('Error generating captions:', error);
    return res.status(500).json({ error: 'Failed to generate captions' });
  }
});

// 2. AI Video Concept to Timeline Generator
app.post('/api/ai/generate-storyboard', async (req: Request, res: Response) => {
  try {
    const { ideaPrompt } = req.body;
    const ai = getAiClient();

    if (!ai) {
      return res.json({
        title: 'Vídeo Criativo',
        colorPreset: 'teal-orange',
        musicGenre: 'synthwave',
        headline: 'NOVA GERAÇÃO',
        subtitle: 'Tecnologia que transforma ideias',
      });
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Gere uma estrutura de vídeo para o tema: "${ideaPrompt}".
Retorne APENAS um JSON no formato:
{
  "title": "Nome do Projeto",
  "colorPreset": "teal-orange",
  "headline": "Título principal em destaque (max 4 palavras)",
  "subtitle": "Subtítulo explicativo curto",
  "recommendedMusic": "ambient"
}`,
        config: {
          responseMimeType: 'application/json',
        },
      })
    );

    const data = JSON.parse(response.text || '{}');
    return res.json(data);
  } catch (error) {
    console.error('Error generating storyboard:', error);
    return res.status(500).json({ error: 'Failed to generate storyboard' });
  }
});

// 3. AI Cinematic Scene Director Pipeline
app.post('/api/ai/script-to-full-video', async (req: Request, res: Response) => {
  const { script = '', aspectRatio = '16:9' } = req.body || {};
  const safeAspectRatio = aspectRatio === '9:16' ? '9:16' : '16:9';

  try {
    const ai = getAiClient();

    if (!ai) {
      const fallback = buildContextualDirectorFallback(String(script), safeAspectRatio);
      return res.json(fallback);
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Você é o Diretor Cinematográfico do StickStory Studio.
Analise a história/roteiro do usuário e dirija uma sequência de 3 a 6 cenas cinematográficas com personagens stick figure estilizados.
História/Roteiro do usuário:
"""${script}"""

REGRAS DE DIREÇÃO:
1. NUNCA escolha ações de forma genérica pelo número da cena. Toda ação, expressão, ambiente, câmera e beat deve decorrer do significado dramático e do contexto real daquela cena.
2. Mantenha continuidade visual do protagonista entre as cenas.
3. Para cada cena, defina:
   - dramaticIntent: uma de [${VALID_DRAMATIC_INTENTS.join(', ')}]
   - emotionalState: uma de [${VALID_EMOTIONAL_STATES.join(', ')}]
   - action: uma de [${VALID_ACTIONS.join(', ')}]
   - expression: uma de [${VALID_EXPRESSIONS.join(', ')}]
   - prop: uma de [${VALID_PROPS.join(', ')}]
   - environment: uma de [${VALID_ENVIRONMENTS.join(', ')}]
   - cameraEffect: uma de [${VALID_CAMERAS.join(', ')}]
   - soundEffect: uma de [${VALID_SFX.join(', ')}]
   - visualFilter: uma de [${VALID_FILTERS.join(', ')}]
   - floatingIcon: uma de [${VALID_ICONS.join(', ')}]
   - beats: 3 a 4 beats temporais por cena cobrindo opening_anticipation, development_action, climax_reaction e settle_recovery, cada um com action, expression, maneuver (uma de [${VALID_MANEUVERS.join(', ')}]), intensity (0.2 a 1.0), anticipation (0.1 a 1.0), reaction (0.1 a 1.0) e settle (0.2 a 1.0).`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    narration: { type: Type.STRING },
                    dramaticIntent: { type: Type.STRING },
                    emotionalState: { type: Type.STRING },
                    action: { type: Type.STRING },
                    expression: { type: Type.STRING },
                    prop: { type: Type.STRING },
                    environment: { type: Type.STRING },
                    cameraEffect: { type: Type.STRING },
                    soundEffect: { type: Type.STRING },
                    visualFilter: { type: Type.STRING },
                    floatingIcon: { type: Type.STRING },
                    beats: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          narrativePhase: { type: Type.STRING },
                          dramaticIntent: { type: Type.STRING },
                          spokenSegment: { type: Type.STRING },
                          action: { type: Type.STRING },
                          expression: { type: Type.STRING },
                          maneuver: { type: Type.STRING },
                          intensity: { type: Type.NUMBER },
                          anticipation: { type: Type.NUMBER },
                          reaction: { type: Type.NUMBER },
                          settle: { type: Type.NUMBER },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      })
    );

    const validated = validateAndNormalizeDirectorResponse(
      response.text || '{}',
      String(script),
      safeAspectRatio
    );
    return res.json(validated);
  } catch (error) {
    console.warn('Gemini Director call failed, using contextual deterministic fallback:', error);
    const fallback = buildContextualDirectorFallback(String(script), safeAspectRatio);
    return res.json(fallback);
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NovaCut Studio server running on http://localhost:${PORT}`);
  });
}

startServer();
