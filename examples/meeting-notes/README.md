# Meeting Notes Example App

This sample shows the full llm-schema workflow end to end:

1. Define the schema once (`schema.ts`).
2. Generate prompt/tool instructions from that schema on the server.
3. Call OpenAI (`gpt-5-mini`) with your meeting transcript.
4. Validate and parse the response with `safeParse()`.
5. Render the structured data in React with a polished UI + a collapsible `<SchemaRenderer />` view.

## Getting started

```bash
cd examples/meeting-notes
cp .env.example .env        # add your OPENAI_API_KEY
npm install                 # links llm-schema from the repo root
npm run dev                 # runs API (Express) + Vite dev server
```

Open http://localhost:5173 to try it out. The Express API runs on http://localhost:8787 and is proxied by Vite.

> ℹ️ Make sure the library is built (`npm run build` from the repo root) so the example resolves the local `llm-schema` package.

## What it demonstrates

- **Single source of truth**: `MeetingNotesSchema` powers the prompt instructions, the OpenAI call, parsing, and the React renderer.
- **Markdown + structured fields**: action items use strictly typed fields, while narrative sections use `md()` so the LLM can respond with rich formatting.
- **Helpful validation**: if the LLM drifts, you’ll see field-level issues on the left panel. The schema descriptions automatically show up in the prompt inspector panel.
- **Instant UI + product polish**: a bespoke meeting-notes layout renders markdown, badges, and action-item cards, and a collapsible `<SchemaRenderer />` panel shows what the auto-generated view looks like.

## Project structure

```
examples/meeting-notes/
├── backend/
│   └── server.ts        # Express API; calls OpenAI and validates with llm-schema
├── schema.ts            # Shared schema + TypeScript types
├── src/
│   ├── App.tsx          # React UI that calls /api/analyze and renders the polished view + SchemaRenderer preview
│   └── main.tsx         # Vite entry point
├── .env.example         # Environment variables template
├── package.json         # Local dependencies; `llm-schema` is linked via file:../..
└── vite.config.ts       # Vite + proxy config
```

## Production notes

- Swap `gpt-5-mini` for any OpenAI model (or wire `toOpenAITool()` and the Responses API) without changing the rest of the app.
- Add persistence by storing the validated `MeetingNotes` payload; the types stay correct because they come from `InferSchema`.
- Enable human-in-the-loop editing by dropping `<SchemaEditor />` next to the renderer.

Define once. Use everywhere.
