# llm-schema — Design Document

**The UI-aware schema for LLM output.**

One schema definition drives the prompt, the validator, the React renderer, the editor, the diff view, and a Standard Schema v1 interface compatible with the Vercel AI SDK.

---

## 1. Why this library exists

Shipping an LLM feature in a real product involves six jobs that each want the same shape of data but never share it:

1. Write prompt instructions describing the output shape
2. Emit a JSON Schema / tool schema for the provider
3. Parse + validate the model response, with useful errors
4. Get a TypeScript type for downstream code
5. Render the result in a UI — including markdown and nested structures
6. Offer a human-in-the-loop editor to fix or refine the output

Each one drifts from the others. A field gets renamed in the prompt but not the UI. An enum grows a fourth option that the form doesn't accept. The parser gets bypassed because a developer "just needs the JSON." The editor breaks on nested arrays so someone hand-rolls a form component.

`llm-schema` collapses these six jobs behind **one schema definition**.

### What makes it distinctive

- **Markdown is a first-class leaf type**, not a flag on a string. `md()` fields parse, render, and edit differently from `text()` everywhere in the stack — the LLM is told "write markdown here," the renderer pipes through `react-markdown`, the editor uses a multi-line textarea.
- **The UI knows the schema.** `<SchemaRenderer />`, `<SchemaEditor />`, and `<SchemaDiff />` are driven by the definition; they handle nested arrays, entity labels, missing fields, and streaming partials without custom code per schema.
- **Standard Schema v1 compatible.** Pass any `Schema` straight to Vercel AI SDK's `generateObject` / `streamObject`. No adapter, no wrapper.
- **Real repair.** `parseWithRepair()` strips code fences, extracts JSON from prose, fixes trailing commas, converts single quotes, and quotes bare keys before validating. A weak model's output is no longer a lost request.

---

## 2. Architecture

```
 ┌────────────────────────────────────────────────────────────────┐
 │  defineSchema({ ... })                                         │
 └─────────────────────────────┬──────────────────────────────────┘
                               │
    ┌──────────────────────────┼────────────────────────────────┐
    │                          │                                │
    ▼                          ▼                                ▼
 toPrompt()                parse / safeParse              SchemaRenderer
 toOpenAITool()            safeParsePartial               SchemaEditor
 toAnthropicTool()         parseWithRepair                SchemaDiff
 toJsonSchema()            ~standard (Std. Schema v1)     EntityProvider
```

Three layers:

1. **Schema definition** — field builders (`text`, `md`, `number`, `boolean`, `date`, `enumType`, `entity`, `array`, `object`) produce a typed `SchemaDefinition`. `defineSchema` wraps it with methods.
2. **Interop surface** — prompt rendering, tool/JSON schema export, parsing (strict, partial, repair), and Standard Schema v1 conformance.
3. **React layer** — renderer, editor, diff, and entity registry components + hooks. Zero-config defaults; replaceable per-field; themeable via `classNames`.

---

## 3. Core concepts

### 3.1 Schema definition

```typescript
import { defineSchema, text, md, array, entity, date, enumType } from 'llm-schema';

const CallSummary = defineSchema({
  summary: md('High-level meeting summary in markdown'),
  actionItems: array({
    schema: {
      task: text('Specific action to take'),
      owner: entity('person', 'Person responsible'),
      dueDate: date('YYYY-MM-DD deadline', { optional: true })
    }
  }),
  sentiment: enumType(['positive', 'neutral', 'negative'])
});
```

Field options are uniform: every field accepts `description`, `note`, `optional`, and a field-specific tail (`minLength`, `pattern`, `format`, `min`, `max`, `minItems`, etc.).

Optionality rules:
- `optional: true` → field is optional.
- A `default` value → field is effectively optional (it's populated if missing).
- Otherwise → required.

There is no `required: true`. Required is the default.

### 3.2 Strict by default

`defineSchema(...)` defaults to `strict: true`. Unknown fields in the input produce a validation issue. Opt out with `defineSchema(def, { strict: false })` when you want the schema to ignore extras.

### 3.3 Output types

```typescript
import { type InferSchema, type PartialSchemaOutput } from 'llm-schema';

type CallSummaryData = InferSchema<typeof CallSummary>;
type CallSummaryPartial = PartialSchemaOutput<typeof CallSummary.definition>;
```

`InferSchema` gives the strict, fully-populated output. `PartialSchemaOutput` gives a deep-partial version for streaming / in-flight rendering.

---

## 4. Parsing

```typescript
// Throws SchemaError on failure
const data = CallSummary.parse(raw);

// Never throws — { success, data, issues }
const result = CallSummary.safeParse(raw);

// Tolerates missing required fields and partial arrays (streaming)
const partial = CallSummary.safeParsePartial(raw);

// Strips code fences, extracts JSON from prose, fixes common JSON mistakes
const repaired = CallSummary.parseWithRepair(rawText);
// → { success, data, issues, repairSteps, repairedSource }
```

`parseWithRepair()` currently handles:
- Markdown code fences (`\`\`\`json ... \`\`\``)
- Smart quotes (` " " ' ' `)
- Leading/trailing prose around the JSON block
- Trailing commas
- Unquoted object keys
- Single-quoted strings

Each step taken is returned in `repairSteps` so you can log / surface repair actions in dev tools.

---

## 5. Prompting and tool schemas

Different models, different answer:

| Model capability | Recommended | Why |
|---|---|---|
| Tool calling with strict JSON Schema (GPT-4o, Claude 3.5+, Gemini 1.5+) | `toOpenAITool()` / `toAnthropicTool()` / `toJsonSchema()` | Provider enforces schema at token level; validation rarely fails. |
| JSON mode only (`response_format: json_object`) | `toJsonSchema()` in the system prompt + `safeParse` on result | Model gets the rules; you enforce them. |
| No structured-output support | `toPrompt()` | Best-effort prompt hint; always pair with `parseWithRepair()`. |

`toPrompt()` produces a TypeScript-like structure by default (easier for LLMs to follow than raw JSON Schema) or a JSON placeholder structure with `{ structure: 'json' }`.

### Why not always use `toPrompt()`?

In 2026, every frontier provider has token-level structured output. Prompt-based shape hints are a fallback for weaker models — don't lead with them.

---

## 6. Standard Schema v1

Every `Schema` exposes a `['~standard']` property implementing [Standard Schema v1](https://standardschema.dev/), so you can drop it into any Standard Schema-compatible validator consumer:

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';

const { object } = await generateObject({
  model: openai('gpt-4o'),
  schema: CallSummary, // ← works directly
  prompt
});
```

This is the default integration path for 2026. `toOpenAITool()` is still available if you're calling the provider SDK by hand, but you rarely need it.

---

## 7. React layer

### 7.1 `<SchemaRenderer />`

Renders validated data.

- Walks the schema definition, renders markdown fields through `react-markdown`, entity fields through the entity registry (see §7.5), arrays as ordered lists with item headers, nested objects as grouped sub-fields.
- `partial={true}` — tolerates undefined values in required fields, showing animated skeleton placeholders. Pair with `safeParsePartial` or `useStreamingSchema` for live streaming.
- `components` — replace any leaf kind renderer (text, markdown, number, boolean, date, enum, entity).
- `config.classNames` — theme every slot (container, label, list, listItem, etc.) with your own class names; inline styles remain as defaults.
- `config.stylePreset` — `'card'` (default) or `'plain'`.

### 7.2 `<SchemaEditor />`

Full nested editor:

- Primitive inputs with type-appropriate widgets (text, textarea for markdown, number, checkbox, date/datetime-local, select for enum, datalist-backed for entity).
- **Arrays**: add, remove, move-up, move-down. No JSON-textarea fallback.
- **Nested objects**: recursive UI.
- Field-level errors from `validationIssues` are surfaced next to the input that caused them.
- `hiddenFields` + `labelFormatter` for fine-grained control.

### 7.3 `<SchemaDiff />`

Renders `schema.diff(prev, next)` — added / removed / changed rows with path markers. `layout="side-by-side"` or `"inline"`. Color-coded; themeable via `classNames`.

### 7.4 `useStreamingSchema()`

```typescript
const { data, partial, issues, isValid } = useStreamingSchema({
  schema: CallSummary,
  object, // raw object from AI SDK's useObject hook
  isLoading
});
```

Returns a partially-validated object while streaming, then strict data once the stream finishes. Feed `data` + `partial` directly to `<SchemaRenderer />`.

### 7.5 Entity registry

`entity('person')` fields are just typed strings until you wrap the tree with `<EntityProvider>`:

```tsx
<EntityProvider
  entities={[
    { type: 'person', id: 'alice@acme.com', label: 'Alice Archer' },
    { type: 'person', id: 'bob@acme.com', label: 'Bob Builder' }
  ]}
>
  <SchemaRenderer schema={CallSummary} data={data} />
  <SchemaEditor schema={CallSummary} data={data} onChange={setData} />
</EntityProvider>
```

With a provider in context, the renderer shows labels and the editor becomes a datalist-backed autocomplete.

### 7.6 Theming

```tsx
<SchemaRenderer
  schema={CallSummary}
  data={data}
  config={{
    classNames: {
      container: 'card bg-white rounded-2xl',
      label: 'text-sm font-semibold text-slate-700',
      listItem: 'border-b border-slate-100',
      pending: 'animate-pulse bg-slate-200 rounded h-4'
    }
  }}
/>
```

Every `RendererStyles` key has a matching `classNames` slot.

---

## 8. Transformation helpers

```typescript
schema.diff(prev, next);             // { added, removed, changed }
schema.merge(base, updates, options); // deep merge with strategies
schema.search(data, query, options);  // full-text search across text + markdown fields
schema.getEntities(data, type?);     // extract entity references by type
schema.getMarkdownFields(data);      // collect markdown content for indexing
```

Standalone function equivalents (`diffSchemaData`, `mergeSchemaData`, etc.) are also exported for when you don't have the schema in scope.

---

## 9. API reference

### Schema

```typescript
defineSchema<T>(fields: T, options?: SchemaOptions): Schema<T>

// Parsing
schema.parse(input)              // throw on invalid
schema.safeParse(input)          // { success, data?, issues? }
schema.safeParsePartial(input)   // tolerate missing fields
schema.parseWithRepair(input)    // { success, data, issues, repairSteps, repairedSource }

// Export
schema.toPrompt(options?)
schema.toJsonSchema()
schema.toOpenAITool(options?)
schema.toAnthropicTool(options?)

// Standard Schema v1
schema['~standard']              // { version: 1, vendor, validate }

// Data helpers
schema.diff(prev, next)
schema.merge(base, updates, options?)
schema.search(data, query, options?)
schema.getEntities(data, type?)
schema.getMarkdownFields(data)
```

### Fields

```typescript
text(options?)
md(options?)
number(options?)
boolean(options?)
date(options?)
enumType(values, options?)
entity(type, options?)
array({ schema, minItems?, maxItems?, uniqueBy?, optional? })
object({ schema, optional? })
```

### React

```typescript
import {
  SchemaRenderer,
  SchemaField,
  SchemaEditor,
  SchemaDiff,
  MarkdownField,
  EntityProvider,
  useEntity,
  useEntitiesOfType,
  useEntityResolver,
  useSchemaData,
  useSchemaValidation,
  useStreamingSchema,
  stylePresets,
  mergeRendererStyles
} from 'llm-schema';
```

---

## 10. Design choices

### Why not just re-use Zod?

Zod owns validation. It doesn't know about markdown as a distinct leaf, it doesn't carry enough metadata for prompt generation, and it has no UI story. `llm-schema` is narrower and taller: less breadth than Zod on validation features, but it knows what to do with `md()` and it brings a renderer/editor/diff trio driven by the same definition.

For apps that already use Zod, keep Zod for inputs and use `llm-schema` for the LLM-output side; you'll still get AI SDK compatibility via Standard Schema v1 on both.

### Why bundle a React layer?

Because the renderer / editor / diff is where real schema drift happens. Prompts and parsers are cheap to keep in sync. Five components in five files — renamed fields, missing errors, forgotten enum options — that's where days of glue code live. Bundling the UI driven by the schema means you can't forget.

The React layer is in the `llm-schema/react` subpath, so non-React consumers pay nothing.

### Why not a generative-UI story (RSC-style)?

Generative UI (Vercel `streamUI`, CopilotKit) is about the LLM choosing components to call — a different axis from "render this structured output." `llm-schema` stays in the structured-output lane. You can wire them together (LLM chooses a schema; renderer displays its result), but generative UI is out of scope.

### Why `entity()` as a string, not a richer type?

Entity values serialize cleanly as ids. The richness — label, metadata, lookup — lives in the registry at render/edit time. This keeps the JSON payload portable across services that don't have the registry.

---

## 11. Stability

Pre-1.0 (0.x):
- `MINOR` bumps may include breaking changes.
- `PATCH` bumps are fixes and safe additions.

Once the API is stable, 1.0.0 ships under strict SemVer.

Changesets is used for versioning and changelogs.
