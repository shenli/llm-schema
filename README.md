# llm-schema

> **One schema definition for the prompt, the parser, and the UI.**
> Stop re-describing the same shape in five different layers of your LLM feature.

[![npm](https://img.shields.io/npm/v/llm-schema.svg)](https://www.npmjs.com/package/llm-schema)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![types: TypeScript](https://img.shields.io/badge/types-TypeScript-3178c6.svg)](https://www.typescriptlang.org/)

[Install](#install) · [Quick start](#quick-start) · [With Vercel AI SDK](#with-vercel-ai-sdk) · [Streaming](#streaming) · [Editing & diffs](#editing-and-diffs) · [API](#api) · [Examples](#examples)

---

## The problem it solves

Every LLM feature you ship repeats the same six jobs — each one wants the same shape of data, none of them share it:

1. Describe the expected output in the prompt
2. Emit a JSON or tool schema for the provider
3. Parse and validate the response
4. Get a TypeScript type for downstream code
5. Render the structured result in React
6. Let humans edit or correct it

Rename a field once and you updated five places. `llm-schema` collapses them behind a single `defineSchema(...)` and ships the missing UI layer (renderer, editor, diff, entity registry) that nobody else bundles.

## Install

```bash
npm install llm-schema
# peer dependencies for the React layer:
npm install react react-dom
```

- TypeScript-native, zero runtime dependencies beyond `react-markdown` + `remark-gfm` (used by the `md()` renderer).
- ESM-only. Any modern bundler or Node ≥ 18 with ESM works.

## Quick start

```tsx
import {
  defineSchema,
  text, md, array, entity, date, enumType,
  type InferSchema
} from 'llm-schema';
import { SchemaRenderer } from 'llm-schema';

// 1. Define the schema — once.
const CallSummary = defineSchema({
  summary: md('Concise meeting summary in markdown'),
  actionItems: array({
    schema: {
      task:    text('Specific follow-up'),
      owner:   entity('person', 'Person responsible'),
      dueDate: date('Deadline', { optional: true })
    }
  }),
  sentiment: enumType(['positive', 'neutral', 'negative'])
});

type CallSummary = InferSchema<typeof CallSummary>;

// 2. Parse the model's output — validated, typed, repairable.
const parsed = CallSummary.safeParse(rawLlmOutput);
// or CallSummary.parseWithRepair(rawLlmOutput) — strips code fences, fixes JSON

if (!parsed.success) {
  console.error(parsed.issues); // structured per-field errors
  return;
}

// 3. Render it in React — no extra glue.
<SchemaRenderer schema={CallSummary} data={parsed.data} />;
```

That's the full loop. `md()` fields render as markdown, `enumType()` renders as the selected value, `array()` renders as an ordered list with nested sub-fields. Drop in your custom components for any field kind when you want to.

## Features

- **Field builders**: `text`, `md`, `number`, `boolean`, `date`, `enumType`, `entity`, `array`, `object`. Markdown is a first-class leaf type, not a flag on a string.
- **Parse / validate**: `parse` (throws), `safeParse` (typed result), `safeParsePartial` (streaming-tolerant), `parseWithRepair` (strips code fences, extracts JSON from prose, fixes common mistakes).
- **Schema export**: `toJsonSchema()`, `toOpenAITool()`, `toAnthropicTool()`, `toPrompt()` (TS or JSON shape hint).
- **Standard Schema v1**: `schema['~standard']` for validator-agnostic libraries.
- **React**: `<SchemaRenderer />`, `<SchemaEditor />`, `<SchemaDiff />`, `<EntityProvider />`, `<MarkdownField />`.
- **Streaming-aware**: `<SchemaRenderer partial />` + `useStreamingSchema()` render in-flight data as it arrives.
- **Theming**: `classNames` prop on every component — drop in your design system while keeping inline defaults.
- **Data helpers**: `diff`, `merge`, `search`, `getEntities`, `getMarkdownFields`.

## With Vercel AI SDK

Pass your schema through AI SDK's `jsonSchema()` wrap. The type parameter keeps everything end-to-end typed:

```ts
import { generateObject, jsonSchema } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CallSummary, type CallSummary as CallSummaryData } from './schema';

const aiSchema = jsonSchema<CallSummaryData>(
  CallSummary.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: aiSchema,
  prompt: transcript
});
// object is CallSummaryData — provider-enforced at the token level
```

> **Why the wrap?** AI SDK 6's `FlexibleSchema` takes Zod or its own `Schema`. The one-line `jsonSchema(schema.toJsonSchema())` wrap converts. AI SDK also ships `standardSchemaValidator()` in `@ai-sdk/provider-utils` if you'd rather route through Standard Schema v1.

### Without AI SDK

```ts
import OpenAI from 'openai';

const client = new OpenAI();
const tool = CallSummary.toOpenAITool({ name: 'record_summary' });

const completion = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: transcript }],
  tools: [tool],
  tool_choice: { type: 'function', function: { name: tool.function.name } }
});

const raw = completion.choices[0]?.message?.tool_calls?.[0]?.function.arguments ?? '{}';
const parsed = CallSummary.safeParse(raw);
```

### Weak or self-hosted models

For models without structured-output support, pair `toPrompt()` with `parseWithRepair()`:

```ts
const prompt = `${instructions}\n\nReturn JSON:\n${CallSummary.toPrompt()}`;
const raw = await callYourModel(prompt);
const repaired = CallSummary.parseWithRepair(raw);
// repaired.repairSteps tells you what had to be fixed
```

## Streaming

Use AI SDK's `useObject` (or any partial-data stream) with `useStreamingSchema` and `<SchemaRenderer partial />`:

```tsx
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { jsonSchema } from 'ai';
import { SchemaRenderer, useStreamingSchema } from 'llm-schema';
import { CallSummary, type CallSummary as CallSummaryData } from './schema';

const aiSchema = jsonSchema<CallSummaryData>(
  CallSummary.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

export function LiveNotes() {
  const { object, isLoading, submit } = useObject({ api: '/api/notes', schema: aiSchema });
  const { data, partial } = useStreamingSchema({
    schema: CallSummary,
    object,
    isLoading
  });

  return (
    <>
      <button onClick={() => submit({ transcript: '...' })}>Generate</button>
      {data && <SchemaRenderer schema={CallSummary} data={data} partial={partial} />}
    </>
  );
}
```

`partial={true}` tells the renderer to show animated skeleton placeholders for fields that haven't streamed in yet.

## Editing and diffs

### `<SchemaEditor />`

Recursive form generated from the schema. Arrays have add / remove / move-up / move-down. Nested objects render nested editors (no JSON-textarea fallback). Per-field errors surface next to the input.

```tsx
import { SchemaEditor } from 'llm-schema';

<SchemaEditor
  schema={CallSummary}
  data={draft}
  onChange={setDraft}
  validationIssues={CallSummary.safeParse(draft).issues}
/>;
```

### `<SchemaDiff />`

```tsx
import { SchemaDiff } from 'llm-schema';

<SchemaDiff schema={CallSummary} prev={original} next={draft} layout="side-by-side" />;
```

### `<EntityProvider />`

Register known entities once; every `entity()` field across renderer and editor becomes label-resolving and typeahead-backed.

```tsx
import { EntityProvider } from 'llm-schema';

<EntityProvider
  entities={[
    { type: 'person', id: 'alice@acme.com', label: 'Alice Archer' },
    { type: 'person', id: 'bob@acme.com',   label: 'Bob Builder' }
  ]}
>
  <SchemaRenderer schema={CallSummary} data={data} />
  <SchemaEditor schema={CallSummary} data={draft} onChange={setDraft} />
</EntityProvider>;
```

New entries can be added at runtime via `useEntityResolver().register(...)`.

## Theming

Every React component accepts `config.classNames` that maps to every styleable slot. Inline styles stay as the default — override only what you need:

```tsx
<SchemaRenderer
  schema={CallSummary}
  data={data}
  config={{
    classNames: {
      container: 'card bg-white rounded-2xl',
      label:     'text-sm font-semibold text-slate-700',
      listItem:  'border-b border-slate-100',
      pending:   'animate-pulse bg-slate-200 rounded h-4'
    }
  }}
/>;
```

Full slot list lives on the `RendererStyles` / `RendererClassNames` types.

## API

### Schema

```ts
defineSchema(def, options?) → Schema

// Parsing
schema.parse(input)               // → data | throws SchemaError
schema.safeParse(input)           // → { success, data?, issues? }
schema.safeParsePartial(input)    // streaming-tolerant
schema.parseWithRepair(input)     // { success, data, issues, repairSteps, repairedSource }

// Export
schema.toPrompt(options?)         // TypeScript or JSON-shape prompt hint
schema.toJsonSchema()             // JSON Schema draft-07
schema.toOpenAITool(options?)     // { type: 'function', function: { name, parameters } }
schema.toAnthropicTool(options?)  // { name, input_schema }
schema['~standard']               // Standard Schema v1 interface

// Data helpers
schema.diff(prev, next)
schema.merge(base, updates, options?)
schema.search(data, query, options?)
schema.getEntities(data, type?)
schema.getMarkdownFields(data)
```

### Fields

```ts
text(description | options?)
md(description | options?)
number(options?)       // min, max, precision
boolean(options?)
date(options?)         // format: 'date' | 'date-time'
enumType(values, options?)
entity(type, options?) // type is a string tag, e.g. 'person'
array({ schema, minItems?, maxItems?, uniqueBy?, optional? })
object({ schema, optional? })
```

All field options include `description`, `note`, `optional`, and `default`. Pass a string as the first argument and it becomes the `description`: `text('Title of the task')`.

### React

```ts
// Components
SchemaRenderer, SchemaField, SchemaEditor, SchemaDiff, MarkdownField, EntityProvider

// Hooks
useSchemaData, useSchemaValidation, useStreamingSchema,
useEntity, useEntitiesOfType, useEntityResolver

// Theming
stylePresets, mergeRendererStyles

// Types
SchemaRendererProps, SchemaEditorProps, SchemaDiffProps,
RendererConfig, RendererStyles, RendererClassNames,
Entity, EntityResolver, EntityProviderProps,
UseStreamingSchemaOptions, UseStreamingSchemaResult
```

## Examples

| Example | Runnable | What it shows |
| --- | --- | --- |
| [`examples/meeting-notes`](./examples/meeting-notes) | ✅ Vite + Express | Full app: streaming, zero-code vs. polished render, nested editor, diff, entity registry, `parseWithRepair` with a second "legacy" pipeline, schema inspector tab |
| [`examples/ai-sdk`](./examples/ai-sdk) | Snippets only | Minimal patterns for `generateObject` / `streamObject` / `useObject` + React |

### Running the end-to-end example

```bash
git clone https://github.com/shenli/llm-schema.git
cd llm-schema
npm install
npm run build                           # library must be built for examples to resolve it

cd examples/meeting-notes
cp .env.example .env                    # add OPENAI_API_KEY
npm install
npm run dev                             # Vite (5173) + Express (8787)
```

If you're iterating on the library itself, run `npx tsc --watch` in the repo root so `dist/` rebuilds on save.

## Documentation

- [Design doc](./docs/llm-schema-design.md) — architecture, concepts, and design rationale
- [Changelog](./CHANGELOG.md) — release notes and migration guides

## Contributing

Issues and PRs welcome at [github.com/shenli/llm-schema](https://github.com/shenli/llm-schema). Run `npm test` before submitting. We use [Changesets](https://github.com/changesets/changesets) for versioning.

## Stability

`llm-schema` is pre-1.0 (`0.x.y`). MINOR versions may include breaking changes, documented in [CHANGELOG.md](./CHANGELOG.md). Once `defineSchema`, parsing, and the core React components stabilize, we'll ship 1.0 and follow strict SemVer.

## License

[MIT](./LICENSE).
