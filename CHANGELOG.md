# Changelog

All notable changes to `llm-schema` are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) (pre-1.0: MINOR bumps
may include breaking changes).

## 0.3.0

### Added
- `schema.safeParsePartial(input)` — tolerates missing required fields; for streaming / in-flight data.
- `schema.parseWithRepair(input)` — strips markdown code fences, extracts JSON from prose preambles, fixes trailing commas, unquoted keys, and single/smart quotes, then validates. Returns `{ success, data, issues, repairSteps, repairedSource }`.
- `schema['~standard']` — [Standard Schema v1](https://standardschema.dev/) interface. Use with any validator-agnostic library; for Vercel AI SDK pass through `jsonSchema(schema.toJsonSchema())`.
- `<SchemaRenderer partial />` — renders animated skeleton placeholders for missing fields and empty arrays while data streams in.
- `<SchemaDiff schema prev next />` — side-by-side or inline diff, color-coded for added / removed / changed.
- `<EntityProvider entities={[…]} />` + `useEntity` / `useEntitiesOfType` / `useEntityResolver` — registry so entity fields render as labels and edit as datalist-backed typeahead. Supports dynamic registration.
- `useStreamingSchema({ schema, object, isLoading })` — wraps AI SDK's `useObject` output and returns `{ data, partial, isValid, issues }`.
- `classNames` config on every React component — theme every styleable slot (`container`, `label`, `list`, `pending`, etc.) with your own class names.
- `PartialSchemaOutput<D>`, `ParseWithRepairResult<T>`, `RendererClassNames`, `Entity`, `EntityResolver` type exports.

### Changed (breaking)

Each change is mechanical — search-and-replace works. With no adopters yet, we cleaned up rather than deprecated.

1. **`schema.validate()` removed** → use `schema.safeParse()` (they were literally aliases).
2. **`schema.getDefinition()` removed** → use `schema.definition`.
3. **`generateEditForm()` removed** → use `<SchemaEditor />` directly with `config.hiddenFields`. Note the semantic flip: `fields` was a whitelist; `hiddenFields` is a blacklist.
4. **`BaseFieldOptions.required` removed** — required is the default. Use `{ optional: true }` to opt into optional.
5. **`strict: true` is now the default on `defineSchema`** — unknown fields fail validation. Opt out explicitly with `defineSchema(def, { strict: false })`.
6. **`SchemaEditorConfig` merged into `RendererConfig`** — one config type across `<SchemaRenderer />`, `<SchemaEditor />`, and `<SchemaDiff />`.
7. **Package is now ESM-only** (`"type": "module"`). `require()` is no longer supported; use `import` or a bundler that handles ESM interop.

### Demoted (still exported)
- `toPrompt()` — kept for weaker or self-hosted models that don't support structured output. For GPT-4o / Claude 3.5+ / Gemini 1.5+, prefer `toJsonSchema()` / `toOpenAITool()` / `toAnthropicTool()` — those are enforced at the token level.

### Before / after

```ts
// validate() → safeParse()
- const result = schema.validate(input);
+ const result = schema.safeParse(input);

// getDefinition() → .definition
- const def = schema.getDefinition();
+ const def = schema.definition;

// required → optional
- text({ required: true })
+ text()
- text({ required: false })
+ text({ optional: true })
```

```tsx
// generateEditForm → <SchemaEditor />
- generateEditForm(schema, { value, onChange, fields: ['title', 'tags'] });
+ <SchemaEditor
+   schema={schema}
+   data={value}
+   onChange={onChange}
+   config={{ hiddenFields: ['summary', 'contributors'] }}
+ />
```

## 0.2.0

### Added
- Standard Schema v1 interface on every schema.
- Real nested `<SchemaEditor />` with add / remove / move-up / move-down on arrays and per-field error surfacing.
- `parseWithRepair()` helper.
- Streaming-aware partial rendering.

## 0.1.0

Initial release. `defineSchema`, field builders, `toPrompt`, `toJsonSchema`, `safeParse`, `<SchemaRenderer />`, `<SchemaEditor />`.
