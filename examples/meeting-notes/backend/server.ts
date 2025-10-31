import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';
import { MeetingNotesSchema } from '../schema';

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn(
    '⚠️  OPENAI_API_KEY is not set. Requests to /api/analyze will return an error until you provide a key.'
  );
}

const client = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

const systemPrompt = `
You are an expert meeting scribe. Produce structured meeting notes that follow the provided schema exactly.
Capture the main ideas, decisions, and action items. Use markdown (headings, bullet lists) in the rich text fields.
If information is missing, leave the field empty or omit optional items.
`.trim();

const schemaPrompt = MeetingNotesSchema.toPrompt({ structure: 'json' });

app.post('/api/analyze', async (req, res) => {
  if (!client) {
    res.status(500).json({
      success: false,
      issues: [
        {
          path: ['apiKey'],
          code: 'missing_api_key',
          message: 'OPENAI_API_KEY is not configured on the server.'
        }
      ]
    });
    return;
  }

  const transcript: unknown = req.body?.transcript;

  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    res.status(400).json({
      success: false,
      issues: [
        {
          path: ['transcript'],
          code: 'invalid_input',
          message: 'Provide a non-empty transcript in the request body.'
        }
      ]
    });
    return;
  }

  try {
    const userPrompt = [
      'Here is the schema you must follow:',
      schemaPrompt,
      '',
      'Meeting transcript:',
      transcript
    ].join('\n');

    const completion = await client.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 5000
    });

    const raw = completion.choices[0]?.message?.content ?? '{}';
    const parsedJson = JSON.parse(raw);
    const result = MeetingNotesSchema.safeParse(parsedJson);

    if (!result.success) {
      res.status(422).json({
        success: false,
        issues: result.issues,
        raw
      });
      return;
    }

    res.json({
      success: true,
      data: result.data,
      prompt: schemaPrompt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      issues: [
        {
          path: ['openai'],
          code: 'llm_error',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      ]
    });
  }
});

app.get('/api/prompt', (_req, res) => {
  res.json({
    prompt: schemaPrompt
  });
});

app.listen(port, () => {
  console.log(`🚀 Meeting Notes example API listening on http://localhost:${port}`);
});
