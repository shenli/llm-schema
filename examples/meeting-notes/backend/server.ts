import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { streamObject, generateText, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { MeetingNotesSchema, type MeetingNotes } from '../schema';

// AI SDK 6 takes Zod or its own Schema wrapper. Wrap our JSON Schema output:
// `jsonSchema()` expects JSONSchema7; our toJsonSchema output is a compatible subset.
const aiSchema = jsonSchema<MeetingNotes>(
  MeetingNotesSchema.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.warn(
    '⚠️  OPENAI_API_KEY is not set. Requests will error until you provide a key.'
  );
}

const openai = openaiApiKey ? createOpenAI({ apiKey: openaiApiKey }) : null;

const systemPrompt = `
You are an expert meeting scribe. Produce structured meeting notes from the user's transcript.
Capture the main ideas, decisions, and action items. Use markdown (headings, bullet lists) in the
rich-text fields (summary / highlights / followUps). If information is missing, leave that field empty.
`.trim();

/**
 * Structured streaming endpoint — uses Vercel AI SDK's `streamObject` with the
 * llm-schema definition as Standard Schema v1. The model provider enforces the
 * schema at the token level, so the client can render partial fields as they arrive.
 */
app.post('/api/analyze', async (req, res) => {
  if (!openai) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    return;
  }

  const transcript: unknown = req.body?.transcript;
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    res.status(400).json({ error: 'Provide a non-empty transcript in the request body.' });
    return;
  }

  try {
    const result = streamObject({
      model: openai('gpt-4o-mini'),
      schema: aiSchema,
      system: systemPrompt,
      prompt: transcript
    });
    result.pipeTextStreamToResponse(res);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Legacy endpoint — returns raw text. No schema enforcement, on purpose.
 * The model is asked (via prompt) to emit JSON in a markdown code fence,
 * optionally with a short preamble. The client feeds the result to
 * `schema.parseWithRepair()`, which strips the fence, extracts the JSON,
 * and fixes common JSON mistakes before validating.
 *
 * This simulates working with weaker/self-hosted models that don't support
 * structured outputs or tool calling.
 */
app.post('/api/analyze-legacy', async (req, res) => {
  if (!openai) {
    res.status(500).json({ error: 'OPENAI_API_KEY is not configured on the server.' });
    return;
  }

  const transcript: unknown = req.body?.transcript;
  if (typeof transcript !== 'string' || transcript.trim().length === 0) {
    res.status(400).json({ error: 'Provide a non-empty transcript in the request body.' });
    return;
  }

  const schemaHint = MeetingNotesSchema.toPrompt({ structure: 'json' });

  try {
    const { text } = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: [
        'Produce meeting notes in JSON, wrapped in a ```json code fence. Follow this schema shape:',
        schemaHint,
        '',
        'You may include a one-line preamble before the code fence.',
        '',
        'Transcript:',
        transcript
      ].join('\n')
    });

    res.json({ raw: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Meeting Notes example API listening on http://localhost:${port}`);
});
