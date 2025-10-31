# llm-schema

**The ORM for LLM Content**

Define once. Use everywhere.

[Quick Start](#quick-start) • [API Reference](#api-reference) • [Design Doc](docs/llm-schema-design.md)

## Why this exists

Today, shipping an AI feature in a real product is annoying:
- You define the output structure you wish the LLM would follow
- You write a long prompt describing every field
- You JSON.parse() the model output and pray
- You write validation by hand
- You build a React component to render it
- You build an edit form so humans can fix it

Every time the shape changes, you update all of those places manually. Things drift. Bugs slip in. Stop JSON.parse() + hope.

llm-schema fixes that.

You define your schema once, and that single source of truth gives you:
- Prompt instructions / tool schemas for the LLM
- A parser with validation + helpful errors (and optional auto-repair)
- Fully typed data in TypeScript
- A ready-to-use React renderer (and editor)

You stop gluing these pieces together by hand.

### Define → prompt → parse → render

```typescript
import {
  defineSchema,
  md,
  text,
  array,
  entity,
  date,
  enumType
} from 'llm-schema';
import { SchemaRenderer, SchemaEditor } from 'llm-schema/react';

// 1. Define the schema once
const CallSummary = defineSchema({
  summary: md("High-level meeting summary in markdown"),
  actionItems: array({
    schema: {
      task: text("Specific action to take"),
      owner: entity('person', "Person responsible"),
      dueDate: date("YYYY-MM-DD deadline", { optional: true })
    }
  }),
  sentiment: enumType(['positive', 'neutral', 'negative'], "Overall tone of the meeting")
});

// 2. Give the model structure-aware instructions
const prompt = `
You are a sales assistant. Summarize the call and extract action items.
${CallSummary.toPrompt()}
`;

// 3. Parse with validation + helpful errors (or auto-repair)
const response = await llm.generate({ prompt }); // call your favorite LLM client
const parsed = CallSummary.safeParse(response);

// 4. Render (or edit) with built-in React components
export function CallSummaryView() {
  if (!parsed.success) {
    return <div>Surface parsed.issues to your team (or open SchemaEditor for manual fixes)</div>;
  }

  return <SchemaRenderer schema={CallSummary} data={parsed.data} />;
}
```

Define once. Use everywhere.

### Structured vs Markdown: you get both.

In a real app, not everything should be rigidly structured JSON.

Some fields must be strictly typed so you can automate on them:
- owner, dueDate, priority, status, sentiment, dealStage

Other fields should stay expressive and human, not squeezed into enums:
- meeting summary
- reasoning / rationale
- objection handling notes
- next-step narrative

llm-schema makes that split explicit:
- Use `text()`, `enumType()`, `date()`, `entity()`, etc. for structured data
- Use `md()` for rich markdown content

Markdown (`md()`) is treated as a first-class field type. The LLM is allowed to express itself with headers, bullet lists, bold text, etc. We render that markdown for you in React with zero extra work.

This is the core idea: you keep strict structure where the app needs control, and you keep markdown where humans need richness — without writing five different layers of glue.

### Single source of truth

With llm-schema, the schema is the source of truth.

From one schema definition, you get:
- `schema.toPrompt()` — instructions for the LLM describing each field
- `schema.toOpenAITool()` — tool / function calling schema
- `schema.safeParse()` — validation + helpful error paths
- `SchemaRenderer` / `SchemaEditor` — UI that knows how to display and edit each field type

When you change the schema, everything updates together. No more “forgot to update the prompt” bugs or “UI is missing the new field” bugs.

### What ships in v0.1

- `defineSchema(...)` – declare your content model (structured fields + markdown fields in one place)
- `toPrompt()` / `toOpenAITool()` – generate LLM-facing structure guidance and tool schemas automatically
- `safeParse()` / `parseWithRepair()` – turn raw model output into validated, typed data with helpful error messages
- `<SchemaRenderer />` – render the data (including markdown) in React with zero custom formatting
- `<SchemaEditor />` (basic version) – editable form generated from the same schema

Things like diff/merge/search, advanced entity resolution, schema versioning, etc. are part of the roadmap but not required for the first public release.

### Helpful errors (not just "invalid")

```json
[
  {
    "path": "actionItems[0].priority",
    "code": "invalid_enum_value",
    "message": "Invalid priority value. Must be one of: high, medium, low",
    "expected": ["high", "medium", "low"],
    "received": "urgent"
  }
]
```

Instead of “failed to parse,” you get actionable, field-level feedback you can show in logs or even surface in your UI.

## Features

### 🎯 Schema-driven everything

One schema powers prompt instructions, tool schemas, TypeScript types, parsing, and UI. Change the schema and the rest updates automatically.

### 📝 First-class markdown

`md()` keeps rich formatting alongside structured fields. The React renderer outputs headers, lists, emphasis, and callouts without extra work.

### ✅ Validation + repair

`schema.safeParse()` returns typed data or structured issues you can act on. `schema.parseWithRepair()` (opt-in) can fix common JSON hiccups before validation runs.

### ⚛️ React components included

Drop-in `<SchemaRenderer />` and `<SchemaEditor />` know how to display and edit every field type. Compose or override per field when you need custom behavior.

### 🔌 Works with your LLM stack

Export prompts, OpenAI tool definitions, Anthropic tool schemas, or vanilla JSON Schema. The ORM for LLM content plays nicely with any client or orchestrator.

## Quick Start

### 1. Define your schema

```typescript
import {
  defineSchema,
  md,
  text,
  array,
  entity,
  date,
  enumType,
  type InferSchema
} from 'llm-schema';

const CallSummary = defineSchema({
  summary: md("High-level meeting summary in markdown"),
  actionItems: array({
    schema: {
      task: text("Specific action to take"),
      owner: entity('person', "Person responsible"),
      dueDate: date("YYYY-MM-DD deadline", { optional: true })
    }
  }),
  sentiment: enumType(['positive', 'neutral', 'negative'], "Overall tone of the meeting")
});

type CallSummaryData = InferSchema<typeof CallSummary>;
```

### The descriptions become prompt instructions

Every string you pass into helpers like `text("Specific action to take")` or `md("High-level meeting summary in markdown")` is reused inside the generated prompt/tool schema. You describe the field once, and llm-schema turns it into guidance the model actually sees.

```text
Field: actionItems[].task
- Specific action to take

Field: actionItems[].owner
- Person responsible
```

Notes (`{ note: "max 100 chars" }`) and other metadata show up too, so the LLM is reminded about constraints like length, formatting, or optionality without you wiring any extra prose by hand.

### 2. Build your prompt

```typescript
const structure = CallSummary.toPrompt({ structure: 'typescript' });

const prompt = `
You are a sales assistant. Extract actionable follow-up details.

Return data that matches this schema:
${structure}
`;
```

Prefer JSON placeholders? Pass `{ structure: 'json' }`.

### 3. Call your LLM

```typescript
import OpenAI from 'openai';

const client = new OpenAI();

async function analyzeTranscript(transcript: string) {
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: transcript }
    ],
    response_format: { type: 'json_object' }
  });

  return completion.choices[0].message?.content ?? '{}';
}
```

### 4. Parse (with safety) and render

```typescript
import { SchemaRenderer } from 'llm-schema/react';

const raw = await analyzeTranscript(transcript);

// Choose strict or forgiving parsing
const parsed = CallSummary.safeParse(raw);
// const parsed = CallSummary.parseWithRepair(raw);

if (!parsed.success) {
  parsed.issues.forEach(issue => {
    console.warn(issue.path.join('.'), issue.message);
  });
  throw new Error('Call summary is invalid');
}

<SchemaRenderer schema={CallSummary} data={parsed.data} />;
```

### Markdown rendering (built-in)

`md()` fields automatically render through [`react-markdown`](https://github.com/remarkjs/react-markdown) with GitHub-flavored markdown support. No extra setup or peer dependencies required — it ships inside `llm-schema`.

```tsx
<SchemaRenderer schema={CallSummary} data={parsed.data} />
```

Need different styling? Override the renderer:

```tsx
<SchemaRenderer
  schema={CallSummary}
  data={parsed.data}
  markdownRenderer={(md) => <MyMarkdown content={md} />}
/>;
```

The default renderer escapes raw HTML, supports tables, lists, and checklists, and applies a `.llm-schema-markdown` wrapper you can style however you like.

### 5. Let humans fix what the model missed

```tsx
import { SchemaEditor } from 'llm-schema/react';

function CallSummaryEditor({
  value,
  onChange
}: {
  value: CallSummaryData;
  onChange: (next: CallSummaryData) => void;
}) {
  const validation = CallSummary.safeParse(value);

  return (
    <SchemaEditor
      schema={CallSummary}
      data={value}
      onChange={onChange}
      validationIssues={validation.success ? [] : validation.issues}
    />
  );
}
```

## Examples

👉 Try the end-to-end sample app in `examples/meeting-notes` to see this in action (LLM call + validation + React UI).

### Customer Feedback Analysis

```typescript
const FeedbackSchema = defineSchema({
  customerName: entity('person', "Customer name or handle"),
  feedbackText: md("Original feedback with quotes"),
  sentiment: enumType(['positive', 'neutral', 'negative'] as const, "Overall sentiment"),
  categories: array({
    schema: {
      category: enumType(['feature-request', 'bug', 'praise', 'complaint'] as const),
      priority: enumType(['low', 'medium', 'high'] as const)
    }
  }),
  actionRequired: text({ optional: true, description: 'Call out follow-up if needed' }),
  suggestedResponse: md("Optional suggested reply in markdown", { optional: true })
});
```

### Research Paper Extraction

```typescript
const ResearchPaperSchema = defineSchema({
  title: text("Paper title"),
  authors: array({ schema: { name: entity('person', "Author name") } }),
  abstract: md("Concise markdown abstract", { maxLength: 500 }),
  keyFindings: array({
    schema: {
      finding: text("Short statement of the finding"),
      supportingEvidence: md("Evidence in markdown"),
      confidence: enumType(['low', 'medium', 'high'] as const, "Confidence level")
    }
  }),
  citations: array({
    schema: {
      title: text("Citation title"),
      authors: text("Citation authors"),
      year: text("Publication year")
    }
  }),
  methodology: md("Methodology summary in markdown")
});
```

### Sales Call Summary

```typescript
const SalesCallSchema = defineSchema({
  callDate: date("ISO date of the call"),
  participants: array({
    schema: {
      name: entity('person', "Participant name"),
      role: enumType(['prospect', 'customer', 'team-member'] as const, "Relationship to us")
    }
  }),
  summary: md("Highlights and discussion points in markdown"),
  painPoints: array({
    schema: {
      issue: text("Pain point"),
      severity: enumType(['minor', 'moderate', 'critical'] as const),
      discussed: text("How it was handled")
    }
  }),
  nextSteps: array({
    schema: {
      action: text("Follow-up action"),
      owner: entity('person', "Owner"),
      deadline: date("Optional due date", { optional: true })
    }
  }),
  dealProbability: text("Optional probability note", { optional: true })
});
```

## API Reference

### Schema definition

```typescript
defineSchema<T>(fields: T, options?: SchemaOptions): Schema<T>
```

**Field types**
- `text(options?)`
- `md(options?)`
- `number(options?)`
- `boolean(options?)`
- `date(options?)`
- `enumType(values, options?)`
- `entity(type, options?)`
- `array(options)`
- `object(fields)`

### Schema methods

```typescript
schema.toPrompt(options?)        // Generate LLM instructions
schema.toOpenAITool(options?)    // OpenAI function/tool definition
schema.toAnthropicTool(options?) // Anthropic tool definition
schema.toJsonSchema()            // Standard JSON Schema

schema.parse(input)              // Parse and throw on validation failure
schema.safeParse(input)          // Return { success, data?, issues? }
schema.parseWithRepair(input)    // Attempt repair, then validate
```

### React components

```tsx
import {
  SchemaRenderer,
  SchemaEditor,
  SchemaField,
  useSchemaData,
  useSchemaValidation
} from 'llm-schema/react';
```

## Documentation

- 📖 [Design Document](docs/llm-schema-design.md)
- 🎥 Live demos and walkthroughs (coming soon)
- 🧠 Patterns for prompt + schema design (coming soon)

## Development

```bash
git clone https://github.com/shenli/llm-schema.git
cd llm-schema
npm install

npm run build
npm test
npm run lint
```

Project layout:

```
llm-schema/
├── src/          # Core schema + React bindings
├── tests/        # Vitest suites
├── docs/         # Design documentation
└── examples/     # Usage scenarios
```

## Contributing

We welcome pull requests! Please open an issue if you're unsure whether a feature fits the roadmap. Run `npm test` before submitting.

## Roadmap / Coming Soon

- Diff/merge helpers for human-in-the-loop review
- Advanced entity resolution + linking
- Schema versioning + migrations
- Streaming-friendly rendering
- Search across markdown fields
- Design tokens + theming for UI components

## Support

- Discussions: https://github.com/shenli/llm-schema/discussions
- Issues: https://github.com/shenli/llm-schema/issues

## Versioning & Stability

llm-schema is currently pre-1.0 (`0.x.y`).

During this phase:
- New MINOR versions (`0.4.0 → 0.5.0`) may include breaking changes.
- PATCH versions (`0.4.1 → 0.4.2`) are for fixes and safe improvements.

Once core APIs are stable (`defineSchema`, `toPrompt`, parsing, `<SchemaRenderer />`), we'll release `1.0.0` and follow strict SemVer:
- PATCH = bug fix
- MINOR = new backwards-compatible feature
- MAJOR = breaking change

We use Changesets to manage versions, changelogs, and publishing to npm.
