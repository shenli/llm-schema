# Meeting Notes Example App (llm-schema 0.3)

This app is the fully-runnable showcase for `llm-schema`. It demonstrates every job a real production LLM app has to do, all driven by a single `MeetingNotesSchema` definition.

## What it demonstrates

| Feature | Where to see it |
|---|---|
| **Structured streaming** via Vercel AI SDK | Pipeline picker → *Structured streaming* · watch fields fill in live |
| **`parseWithRepair()`** for weak / non-structured models | Pipeline picker → *Legacy + repair* · the repair panel shows every step |
| **Zero-code rendering** via `<SchemaRenderer />` | Result tab → *Generated (zero custom code)* |
| **Custom UI alongside the same schema** | Result tab → *Polished* (~300 lines of bespoke JSX rendering the same data) |
| **`<SchemaEditor />` with real nested editing** | Result tab → *Edit* · arrays have add / remove / reorder |
| **`<SchemaDiff />` after edits** | Result tab → *Edit* · side-by-side diff vs. original |
| **`<EntityProvider />` + dynamic registration** | Edit tab — unknown owner ids surface a "Register as…" panel |
| **Schema Inspector** — the same schema as prompt / JSON Schema / OpenAI tool / Anthropic tool | Collapsible panel at the bottom of the page |
| **Invalid-output simulation** | Edit tab → *Simulate invalid output* button strips a required field |

## Why two pipelines?

- **Structured streaming** is the default production path: the provider enforces the schema at the token level, validation almost never fails, the UI streams partial fields.
- **Legacy + repair** simulates weaker models that return raw JSON with code fences and prose preambles. `schema.parseWithRepair()` strips fences, extracts JSON from prose, fixes trailing commas, and reports every repair step. This is the fallback your app wants when someone swaps in a self-hosted or older model.

## Why the "Polished vs Generated" split?

The *Generated* tab renders the same data with three lines: `<SchemaRenderer schema={...} data={...} />`. The *Polished* tab renders it with ~300 lines of handcrafted JSX. Switch between them — the baseline is free; the polish is opt-in. That's the actual value proposition.

## Getting started

```bash
cd examples/meeting-notes
cp .env.example .env        # add OPENAI_API_KEY
npm install                 # installs AI SDK + links llm-schema from the repo root
npm run dev                 # runs API (Express) + Vite dev server
```

Open <http://localhost:5173>. The Express API runs on <http://localhost:8787>; Vite proxies it.

> Make sure the library is built (`npm run build` from the repo root) so the example resolves the local `llm-schema` package. If you're iterating on the library, run `npx tsc --watch` in the root.

## Files

```
examples/meeting-notes/
├── backend/server.ts          # /api/analyze (streamObject) and /api/analyze-legacy (generateText)
├── schema.ts                  # shared MeetingNotesSchema (single source of truth)
├── src/
│   ├── App.tsx                # orchestration: pipeline picker, tabs, repair/edit/diff panels
│   ├── PolishedView.tsx       # handcrafted custom UI (the "polish" opt-in)
│   ├── SchemaInspector.tsx    # live view of toPrompt / toJsonSchema / toOpenAITool outputs
│   └── main.tsx
├── package.json
└── vite.config.ts
```

## Key files to read for the library pitch

1. **`schema.ts`** — the single source of truth. Six fields; everything else flows from this.
2. **`backend/server.ts`** — the schema is passed directly to `streamObject`. Ten lines.
3. **`src/SchemaInspector.tsx`** — same schema, five consumers. Edit `schema.ts` and every tab updates.
4. **`src/App.tsx`** → `GeneratedView` — renders the entire meeting-notes UI in one line of JSX.

## Production notes

- Swap `openai('gpt-4o-mini')` for any AI SDK provider without touching the schema.
- Add persistence by storing `edited` server-side; the type stays correct via `InferSchema`.
- The entity registry can be backed by your real user directory — `<EntityProvider>` accepts a live list or a controlled `{ entities, onChange }`.

Define once. Use everywhere.
