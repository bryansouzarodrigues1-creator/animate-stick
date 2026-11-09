import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

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

const withTimeout = <T>(promise: Promise<T>, ms = 6000): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('AI request timeout')), ms)),
  ]);
};

// 1. AI Auto-Captions / Script Generator
app.post('/api/ai/generate-captions', async (req: Request, res: Response) => {
  try {
    const { scriptOrPrompt, totalDuration = 12 } = req.body;
    const ai = getAiClient();

    if (!ai) {
      // Offline fallback: Generate realistic default captions
      return res.json({
        captions: [
          { text: 'Bem-vindo ao NovaCut Studio', startTime: 0.5, duration: 2.5 },
          { text: 'Edição de vídeo fluida em tempo real', startTime: 3.5, duration: 3.0 },
          { text: 'Adicione efeitos, filtros e exporte em alta resolução', startTime: 7.0, duration: 3.5 },
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
  "colorPreset": "teal-orange", // uma de: 'teal-orange', 'vintage', 'noir', 'cyberpunk', 'warm-sunset', 'crisp-clean'
  "headline": "Título principal em destaque (max 4 palavras)",
  "subtitle": "Subtítulo explicativo curto",
  "recommendedMusic": "ambient" // ou 'beat'
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

// 3. AI Full Script to Video Production Pipeline
app.post('/api/ai/script-to-full-video', async (req: Request, res: Response) => {
  try {
    const { script, style = 'cinematic', aspectRatio = '16:9' } = req.body;
    const ai = getAiClient();

    if (!ai) {
      // Offline fallback: Generate complete cinematic multi-scene project from script
      const isStickman = style === 'stickman' || script.toLowerCase().includes('stick') || script.toLowerCase().includes('luta');
      return res.json({
        title: isStickman ? 'Batalha Lendária Stickman' : 'Produção Cinematográfica',
        style: isStickman ? 'stickman' : 'cinematic',
        aspectRatio,
        musicGenre: isStickman ? 'beat' : 'ambient',
        scenes: [
          {
            name: 'Ato 1 - O Desafio',
            visualType: isStickman ? 'stickman-combat' : 'cyber-city',
            duration: 5,
            narration: script ? script.slice(0, 100) : 'Dois guerreiros colidem em uma batalha eletrizante.',
            headline: isStickman ? 'CONFRONTO FINAL' : 'A JORNADA COMEÇA',
            subtitle: 'Velocidade, poder e determinação',
            colorPreset: isStickman ? 'cyberpunk' : 'teal-orange',
            sfx: 'whoosh',
          },
          {
            name: 'Ato 2 - O Clímax',
            visualType: isStickman ? 'stickman-combat' : 'ocean-waves',
            duration: 6,
            narration: script && script.length > 100 ? script.slice(100, 200) : 'A cada golpe desferido, a energia do combate atinge o ápice.',
            headline: 'PODER MÁXIMO',
            subtitle: 'Nenhum passo para trás',
            colorPreset: 'warm-sunset',
            sfx: 'cut',
          },
          {
            name: 'Ato 3 - O Desfecho',
            visualType: 'cosmic-aurora',
            duration: 5,
            narration: script && script.length > 200 ? script.slice(200, 320) : 'Apenas um sairá vitorioso desta dimensão.',
            headline: 'VITÓRIA SUPREMA',
            subtitle: 'Inscreva-se e acompanhe o canal',
            colorPreset: 'crisp-clean',
            sfx: 'success',
          },
        ],
      });
    }

    const response = await withTimeout(
      ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `Você é um diretor e editor de cinema e vídeo profissional.
O usuário forneceu o seguinte roteiro:
"""${script}"""
Estilo desejado: ${style}. Proporção: ${aspectRatio}.

Analise o roteiro e crie a direção completa do vídeo cena a cena.
As opções de visualType são:
- "stickman-combat": luta marcial e espadas estilo Alan Becker e Hyun's Dojo
- "cyber-city": metrópole futurista cyberpunk com pôr do sol
- "ocean-waves": ondas do mar dramáticas douradas
- "cosmic-aurora": nebulosa espacial com auroras fluindo
- "neon-abstract": formas geométricas neon 3D
- "studio-minimal": estúdio moderno para apresentação tech/corporativa

As opções de colorPreset são: 'teal-orange', 'vintage', 'noir', 'cyberpunk', 'warm-sunset', 'crisp-clean'.
As opções de sfx são: 'whoosh', 'cut', 'pop', 'success'.
As opções de musicGenre são: 'ambient', 'beat'.

Retorne APENAS um JSON válido no formato:
{
  "title": "Título Criativo do Vídeo",
  "style": "${style}",
  "musicGenre": "ambient" ou "beat",
  "scenes": [
    {
      "name": "Nome da Cena",
      "visualType": "stickman-combat" | "cyber-city" | "ocean-waves" | "cosmic-aurora" | "neon-abstract" | "studio-minimal",
      "duration": 5, // duração recomendada em segundos (entre 4 e 7)
      "narration": "Texto exato que o narrador fala nesta cena",
      "headline": "Título impactante em maiúsculas (max 4 palavras)",
      "subtitle": "Subtítulo explicativo curto",
      "colorPreset": "teal-orange",
      "sfx": "whoosh"
    }
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
    console.warn('Gemini API call failed, generating procedural storyboard fallback:', error);
    const { script = '', style = 'cinematic', aspectRatio = '16:9' } = req.body;
    const isStickman = style === 'stickman' || script.toLowerCase().includes('stick') || script.toLowerCase().includes('luta');

    return res.json({
      title: isStickman ? 'Batalha Lendária Stickman' : 'Produção Cinematográfica',
      style: isStickman ? 'stickman' : 'cinematic',
      aspectRatio,
      musicGenre: isStickman ? 'beat' : 'ambient',
      scenes: [
        {
          name: 'Ato 1 - O Confronto',
          visualType: isStickman ? 'stickman-combat' : 'cyber-city',
          duration: 5,
          narration: script ? script.slice(0, 80) : 'Dois guerreiros colidem em uma batalha eletrizante.',
          headline: isStickman ? 'CONFRONTO FINAL' : 'A JORNADA COMEÇA',
          subtitle: 'Velocidade, poder e determinação',
          colorPreset: isStickman ? 'cyberpunk' : 'teal-orange',
          sfx: 'whoosh',
        },
        {
          name: 'Ato 2 - O Clímax',
          visualType: isStickman ? 'stickman-combat' : 'ocean-waves',
          duration: 6,
          narration: script && script.length > 80 ? script.slice(80, 180) : 'A cada golpe desferido, a energia do combate atinge o ápice.',
          headline: 'PODER MÁXIMO',
          subtitle: 'Nenhum passo para trás',
          colorPreset: 'warm-sunset',
          sfx: 'cut',
        },
        {
          name: 'Ato 3 - O Desfecho',
          visualType: 'cosmic-aurora',
          duration: 5,
          narration: script && script.length > 180 ? script.slice(180, 280) : 'Apenas um sairá vitorioso desta dimensão épica.',
          headline: 'VITÓRIA SUPREMA',
          subtitle: 'Inscreva-se e acompanhe o canal',
          colorPreset: 'crisp-clean',
          sfx: 'success',
        },
      ],
    });
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
