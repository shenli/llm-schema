# Using llm-schema with Vercel AI SDK

Pass any `llm-schema` schema to Vercel AI SDK via a one-line `jsonSchema()` wrap. The type parameter keeps end-to-end typing intact. (Schemas also implement [Standard Schema v1](https://standardschema.dev/) — useful for validator-agnostic libraries; AI SDK 6's `FlexibleSchema` currently requires the `jsonSchema()` or `standardSchemaValidator()` adapter.)

This directory is snippet-only — copy the patterns below into your own app. A fully runnable example lives in `../meeting-notes`.

## 1. Shared schema

```ts
// schema.ts
import {
  defineSchema,
  text,
  md,
  array,
  entity,
  enumType,
  type InferSchema
} from 'llm-schema';

export const CallSummary = defineSchema({
  summary: md('Concise meeting summary in markdown'),
  actionItems: array({
    schema: {
      task: text('Specific follow-up'),
      owner: entity('person', 'Owner email or handle'),
      priority: enumType(['high', 'medium', 'low'] as const, { optional: true })
    }
  }),
  sentiment: enumType(['positive', 'neutral', 'negative'])
});

export type CallSummary = InferSchema<typeof CallSummary>;
```

## 2. Server route — `generateObject`

```ts
// app/api/analyze/route.ts  (Next.js, AI SDK 6)
import { generateObject, jsonSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CallSummary, type CallSummary as CallSummaryType } from '../../../schema';

const aiSchema = jsonSchema<CallSummaryType>(
  CallSummary.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

export async function POST(req: Request) {
  const { transcript } = await req.json();

  const { object } = await generateObject({
    model: openai('gpt-4o'),
    schema: aiSchema,
    prompt: `Summarize this meeting transcript:\n\n${transcript}`
  });

  return Response.json(object);
}
```

## 3. Server route — `streamObject` (for streaming)

```ts
// app/api/analyze-stream/route.ts
import { streamObject, jsonSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CallSummary, type CallSummary as CallSummaryType } from '../../../schema';

const aiSchema = jsonSchema<CallSummaryType>(
  CallSummary.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

export async function POST(req: Request) {
  const { transcript } = await req.json();
  const result = streamObject({
    model: openai('gpt-4o'),
    schema: aiSchema,
    prompt: transcript
  });
  return result.toTextStreamResponse();
}
```

## 4. Client — streaming with `<SchemaRenderer partial />`

```tsx
// app/notes/page.tsx
'use client';

import { experimental_useObject as useObject } from '@ai-sdk/react';
import { jsonSchema } from 'ai';
import {
  SchemaRenderer,
  SchemaEditor,
  SchemaDiff,
  EntityProvider,
  useStreamingSchema
} from 'llm-schema';
import { CallSummary, type CallSummary as CallSummaryType } from '../../schema';
import { useState } from 'react';

const aiSchema = jsonSchema<CallSummaryType>(
  CallSummary.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

const knownPeople = [
  { type: 'person' as const, id: 'alice@acme.com', label: 'Alice Archer' },
  { type: 'person' as const, id: 'bob@acme.com', label: 'Bob Builder' }
];

export default function NotesPage() {
  const [edited, setEdited] = useState<CallSummary | null>(null);
  const { object, submit, isLoading } = useObject({
    api: '/api/analyze-stream',
    schema: aiSchema
  });

  const { data, partial } = useStreamingSchema({
    schema: CallSummary,
    object,
    isLoading
  });

  return (
    <EntityProvider entities={knownPeople}>
      <button onClick={() => submit({ transcript: '...' })}>Analyze</button>

      {data && (
        <>
          <SchemaRenderer schema={CallSummary} data={data} partial={partial} />

          {!partial && !edited && (
            <button onClick={() => setEdited(data as CallSummary)}>Edit</button>
          )}

          {edited && (
            <>
              <SchemaEditor schema={CallSummary} data={edited} onChange={setEdited} />
              <SchemaDiff schema={CallSummary} prev={data as CallSummary} next={edited} />
            </>
          )}
        </>
      )}
    </EntityProvider>
  );
}
```

## Why this pattern matters

- **Single source of truth.** The same `CallSummary` drives token-level schema enforcement on the server, type safety in the handler, partial-data rendering during the stream, human edits in the editor, and diff visualization of those edits. Rename a field once, everything updates.
- **No JSON-parsing code.** AI SDK returns a typed object; `useStreamingSchema` hands you a partial version while streaming and the strict version at the end.
- **Entity labels for free.** `<EntityProvider>` turns opaque ids into readable labels across renderer and editor without per-field overrides.

## Dependencies you'd need

```jsonc
{
  "dependencies": {
    "llm-schema": "^0.3.0",
    "ai": "^6.0.0",
    "@ai-sdk/openai": "^2.0.0",
    "@ai-sdk/react": "^2.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

## Fallback: repair raw LLM output

If you're using a model that returns messy JSON (code fences, prose, trailing commas), `parseWithRepair` handles it:

```ts
import { CallSummary } from './schema';

const raw = await rawModelCall(prompt); // string, possibly with ```json ``` fences
const repaired = CallSummary.parseWithRepair(raw);

if (!repaired.success) {
  console.error('Could not parse even with repair', repaired.issues);
} else {
  console.log('Repair steps:', repaired.repairSteps);
  console.log('Valid:', repaired.data);
}
```
