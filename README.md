# llm-schema

**The ORM for LLM Content**

Define once. Generate prompts. Parse responses. Render beautifully.

[Documentation](#documentation) • [Quick Start](#quick-start) • [Examples](#examples) • [Contributing](#contributing)

```
Your App Flow:
┌──────────────────────────────────────────────────────────────────┐
│  1. You write domain logic        "Analyze this meeting..."      │
│  2. llm-schema adds structure     + schema.toPrompt()            │
│  3. Send to LLM                   → OpenAI / Anthropic / etc.    │
│  4. llm-schema parses response    schema.parse(response)         │
│  5. Render with components        <SchemaRenderer data={...} />  │
└──────────────────────────────────────────────────────────────────┘

        ┌─────────────────────────────────────────┐
        │         llm-schema provides:            │
        ├─────────────────────────────────────────┤
        │  • Schema → Response Format             │
        │  • Parsing & Validation                 │
        │  • TypeScript Types                     │
        │  • React Components                     │
        └─────────────────────────────────────────┘
```

---

## Why llm-schema?

Building with LLMs means wrestling with inconsistent outputs, writing custom parsers, and recreating UI components for every schema. **llm-schema** eliminates this friction by treating your data structure as the single source of truth.

```typescript
// 1. Define your schema once
const schema = defineSchema({ title: text(), summary: md(), ... });

// 2. Generate response structure instructions
const responseFormat = schema.toPrompt();

// 3. Build your complete prompt (domain logic + response structure)
const prompt = `
You are an expert meeting analyst. Analyze the transcript and extract:
- Key discussion points
- Action items with clear owners
- Overall meeting sentiment

${responseFormat}
`;

// 4. Parse and validate LLM responses
const data = schema.parse(llmResponse);

// 5. Render with zero custom code
<SchemaRenderer schema={schema} data={data} />
```

Just as **Prisma** and **Drizzle** abstract away database complexity, **llm-schema** abstracts away LLM integration complexity.

---

## Features

### 🎯 Schema-Driven Everything
One definition powers prompts, validation, TypeScript types, React components, and data utilities.

### 📝 First-Class Markdown
`md()` fields retain rich formatting while staying type-safe. No more guessing how to render content.

### 🔒 Enum Guardrails
Constrain LLM outputs to specific values. The model sees the options in prompts, validation enforces them.

### ⚛️ React Components Included
Drop-in `<SchemaRenderer>` and `<SchemaEditor>` components with hooks for instant UI.

### 🔄 Transformation Pipeline
Built-in diff, merge, search, and entity extraction for building workflows and audit trails.

### 🤝 Multi-Provider Support
Export to OpenAI tools, Anthropic tools, or JSON Schema. Works with any LLM.

---

## Installation

```bash
npm install llm-schema
# or
pnpm add llm-schema
# or
yarn add llm-schema
```

---

## Quick Start

### 1. Define Your Schema

```typescript
import {
  defineSchema,
  text,
  md,
  array,
  entity,
  enumType,
  date,
  number,
  type InferSchema
} from 'llm-schema';

const MeetingNotesSchema = defineSchema(
  {
    title: text({ 
      description: 'Concise meeting title' 
    }),
    
    summary: md({
      description: 'High-level recap with **markdown** support',
      optional: true,
      maxLength: 2000
    }),
    
    actionItems: array({
      description: 'Concrete actions with owners',
      schema: {
        task: text({ description: 'What needs to happen' }),
        owner: entity('person', { description: 'Person responsible' }),
        status: enumType(['todo', 'in-progress', 'done'] as const, {
          description: 'Current status',
          default: 'todo'
        }),
        dueDate: date({ optional: true, format: 'date' })
      }
    }),
    
    sentiment: enumType(['positive', 'neutral', 'negative'] as const, {
      description: 'Overall meeting sentiment'
    }),
    
    confidence: number({ 
      description: 'Confidence score (0-1)', 
      min: 0, 
      max: 1, 
      optional: true 
    })
  },
  {
    name: 'MeetingNotes',
    description: 'Structured meeting summary with markdown and action tracking',
    strict: true
  }
);

// Get fully typed interface
type MeetingNotes = InferSchema<typeof MeetingNotesSchema>;
```

### 2. Build Your Complete Prompt

```typescript
// Generate the response structure part
const responseFormat = MeetingNotesSchema.toPrompt({
  format: 'detailed',
  includeExamples: true
});

// Build your complete prompt: domain instructions + response structure
const fullPrompt = `You are an expert meeting analyst. Extract key information from meeting transcripts.

Focus on:
- Concrete action items with clear owners
- Overall sentiment and key discussion points
- Use markdown formatting in the summary (headers, bold text, lists)

${responseFormat}

Analyze the meeting transcript and return valid JSON.`;
```

**Concrete example of generated response format:**

```
RESPONSE FORMAT:

Return a JSON object with the following structure:

{
  "title": string (required)
    Description: Concise meeting title

  "summary": markdown string (optional, max 2000 characters)  
    Description: High-level recap with **markdown** support
    Note: Use markdown formatting - headers (##), bold (**text**), lists, etc.

  "actionItems": array (required)
    Description: Concrete actions with owners
    Items: [{
      "task": string (required) - What needs to happen
      "owner": person entity (required) - Person responsible (email, name, or ID)
      "status": enum (required) - Must be one of: "todo", "in-progress", "done" (default: "todo")
      "dueDate": ISO date string (optional) - Format: YYYY-MM-DD
    }]

  "sentiment": enum (required)
    Description: Overall meeting sentiment
    Must be exactly one of: "positive", "neutral", "negative"

  "confidence": number (optional, range: 0-1)
    Description: Confidence score (0-1)
}

CRITICAL ENUM VALUES:
- sentiment: Only use "positive", "neutral", or "negative"
- status: Only use "todo", "in-progress", or "done"

EXAMPLE:
{
  "title": "Q4 Planning",
  "sentiment": "positive",
  "actionItems": [{
    "task": "Draft budget proposal",
    "owner": "sarah@company.com",
    "status": "todo",
    "dueDate": "2025-11-15"
  }]
}
```

The response format is **generated automatically** from your schema definition. You write your domain-specific instructions, and llm-schema handles the structure specification.

**Or use as a tool for function calling:**

```typescript
const openaiTool = MeetingNotesSchema.toOpenAITool();
const anthropicTool = MeetingNotesSchema.toAnthropicTool();
const jsonSchema = MeetingNotesSchema.toJsonSchema();
```

### 3. Use with Your LLM

```typescript
import OpenAI from 'openai';

const openai = new OpenAI();

async function analyzeMeeting(transcript: string) {
  const responseFormat = MeetingNotesSchema.toPrompt({ format: 'detailed' });
  
  // Your complete prompt = domain instructions + response format
  const systemPrompt = `You are an expert meeting analyst. Extract structured information from meeting transcripts.

Focus on:
- Action items with clear ownership and deadlines
- Overall meeting tone and key outcomes
- Use markdown in the summary for better readability

${responseFormat}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyze this meeting:\n\n${transcript}` }
    ],
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0].message?.content ?? '{}';
  
  // Parse with validation and detailed error messages
  const result = MeetingNotesSchema.safeParse(raw);

  if (!result.success) {
    result.issues.forEach(issue => {
      console.warn(`${issue.path.join('.')}: ${issue.message}`);
    });
    return null;
  }

  return result.data; // Fully typed MeetingNotes!
}
```

### 4. Render Beautiful UI

The LLM response might look like this:

```json
{
  "title": "Q4 Product Planning",
  "summary": "## Key Decisions\n\nWe finalized the **Q4 roadmap** with three major initiatives:\n\n1. **Mobile app redesign** - New UI/UX launching in November\n2. **API v2 release** - Breaking changes, migration guide ready\n3. **Enterprise features** - SSO and advanced analytics\n\n### Timeline\n\n- Nov 1: Design review\n- Nov 15: Beta release\n- Dec 1: General availability\n\n**Next meeting:** Progress check-in on Nov 8th",
  "actionItems": [
    {
      "task": "Complete mobile app mockups",
      "owner": "sarah@company.com",
      "status": "in-progress",
      "dueDate": "2025-11-01"
    },
    {
      "task": "Write API v2 migration guide",
      "owner": "james@company.com", 
      "status": "todo",
      "dueDate": "2025-11-10"
    }
  ],
  "sentiment": "positive",
  "confidence": 0.92
}
```

**Render with zero custom code:**

```tsx
import { SchemaRenderer } from 'llm-schema/react';

function MeetingNotesView({ data }: { data: MeetingNotes }) {
  return (
    <SchemaRenderer
      schema={MeetingNotesSchema}
      data={data}
      config={{ 
        layout: 'stack',
        showOptionalFields: true 
      }}
    />
  );
}
```

**The rendered output looks like this:**

---

**Title:** Q4 Product Planning

**Summary:**

## Key Decisions

We finalized the **Q4 roadmap** with three major initiatives:

1. **Mobile app redesign** - New UI/UX launching in November
2. **API v2 release** - Breaking changes, migration guide ready
3. **Enterprise features** - SSO and advanced analytics

### Timeline

- Nov 1: Design review
- Nov 15: Beta release
- Dec 1: General availability

**Next meeting:** Progress check-in on Nov 8th

**Action Items:**

- ✅ Complete mobile app mockups
  - Owner: sarah@company.com
  - Status: in-progress
  - Due: 2025-11-01

- ⬜ Write API v2 migration guide
  - Owner: james@company.com
  - Status: todo
  - Due: 2025-11-10

**Sentiment:** 🟢 positive

**Confidence:** 92%

---

**The magic:** The markdown field is automatically rendered with proper formatting. No custom parsing, no manual HTML generation. Just define `md()` in your schema and it works.

**Or create an editable form:**

```tsx
import { SchemaEditor } from 'llm-schema/react';

function MeetingNotesEditor({ 
  value, 
  onChange 
}: { 
  value: MeetingNotes; 
  onChange: (data: MeetingNotes) => void 
}) {
  const validation = MeetingNotesSchema.safeParse(value);
  
  return (
    <SchemaEditor
      schema={MeetingNotesSchema}
      data={value}
      onChange={onChange}
      validationIssues={validation.success ? [] : validation.issues}
    />
  );
}
```

### 5. Transform and Analyze

```typescript
// Diff two versions for audit trails
const diff = MeetingNotesSchema.diff(before, after);

// Merge updates (e.g., human-in-the-loop editing)
const merged = MeetingNotesSchema.merge(original, updates);

// Search across all text and markdown fields
const results = MeetingNotesSchema.search(data, 'budget proposal');

// Extract all entities of a specific type
const people = MeetingNotesSchema.getEntities(data, 'person');

// Get all markdown content for processing
const markdown = MeetingNotesSchema.getMarkdownFields(data);
```

---

## Examples

### Customer Feedback Analysis

```typescript
const FeedbackSchema = defineSchema({
  customerName: entity('person'),
  feedbackText: md({ description: 'Original feedback with quotes' }),
  sentiment: enumType(['positive', 'neutral', 'negative'] as const),
  categories: array({
    schema: {
      category: enumType(['feature-request', 'bug', 'praise', 'complaint'] as const),
      priority: enumType(['low', 'medium', 'high'] as const)
    }
  }),
  actionRequired: boolean({ description: 'Does this need follow-up?' }),
  suggestedResponse: md({ optional: true })
});
```

### Research Paper Extraction

```typescript
const ResearchPaperSchema = defineSchema({
  title: text(),
  authors: array({ schema: { name: entity('person') } }),
  abstract: md({ maxLength: 500 }),
  keyFindings: array({
    schema: {
      finding: text(),
      supportingEvidence: md(),
      confidence: enumType(['low', 'medium', 'high'] as const)
    }
  }),
  citations: array({
    schema: {
      title: text(),
      authors: text(),
      year: number({ min: 1900, max: 2030 })
    }
  }),
  methodology: md()
});
```

### Sales Call Summary

```typescript
const SalesCallSchema = defineSchema({
  callDate: date(),
  participants: array({
    schema: {
      name: entity('person'),
      role: enumType(['prospect', 'customer', 'team-member'] as const)
    }
  }),
  summary: md({ description: 'Call highlights and discussion points' }),
  painPoints: array({
    schema: {
      issue: text(),
      severity: enumType(['minor', 'moderate', 'critical'] as const),
      discussed: boolean()
    }
  }),
  nextSteps: array({
    schema: {
      action: text(),
      owner: entity('person'),
      deadline: date({ optional: true })
    }
  }),
  dealProbability: number({ min: 0, max: 100, description: 'Win probability %' })
});
```

---

## API Reference

### Schema Definition

```typescript
defineSchema<T>(fields: T, options?: SchemaOptions): Schema<T>
```

**Field Types:**
- `text(options?)` - Plain text strings
- `md(options?)` - Markdown-formatted content
- `number(options?)` - Numeric values with optional min/max
- `boolean(options?)` - True/false values
- `date(options?)` - ISO date strings
- `enumType(values, options?)` - Constrained choice from list
- `entity(type, options?)` - Named entities (person, company, etc.)
- `array(options)` - Lists of items
- `object(fields)` - Nested structures

**Common Options:**
- `description` - Instructions for the LLM
- `optional` - Whether field can be omitted
- `default` - Default value if not provided
- `examples` - Example values for LLM guidance

### Schema Methods

```typescript
schema.toPrompt(options?)          // Generate LLM instructions
schema.toOpenAITool(options?)      // OpenAI function calling format
schema.toAnthropicTool(options?)   // Anthropic tool format
schema.toJsonSchema()              // Standard JSON Schema

schema.parse(input)                // Parse and validate (throws on error)
schema.safeParse(input)            // Parse with error details

schema.diff(v1, v2)                // Compare two versions
schema.merge(base, updates)        // Merge changes
schema.search(data, query)         // Full-text search
schema.getEntities(data, type?)    // Extract entities
schema.getMarkdownFields(data)     // Get all markdown content
```

### React Components

```tsx
import { 
  SchemaRenderer, 
  SchemaEditor,
  SchemaField,
  useSchemaData,
  useSchemaValidation
} from 'llm-schema/react';
```

---

## How It Compares

### vs. OpenAI Structured Outputs

**OpenAI Structured Outputs** ensures responses match a JSON Schema (100% reliability for GPT-4o).

**llm-schema** builds on top:
- ✅ Uses Structured Outputs when available
- ✅ Adds markdown support for rich content
- ✅ Works with any LLM provider
- ✅ Includes React UI components
- ✅ Provides transformation utilities
- ✅ Generates better prompts with examples

### vs. Zod

**Zod** is a fantastic TypeScript validation library focused on runtime safety.

**llm-schema** is a separate implementation inspired by Zod’s developer experience, but tuned for LLM content flows:
- ✅ Purpose-built for LLM prompts, tool schemas, and validation
- ✅ Includes Markdown and entity-aware field types
- ✅ Ships React rendering/editing components out of the box
- ✅ Bundles diff/search/entity utilities alongside your schema

### vs. LangChain

**LangChain** is for building LLM applications (chains, agents, memory).

**llm-schema** focuses on data structure:
- ✅ Works alongside LangChain
- ✅ Solves the "structure LLM output" problem
- ✅ ORM-like abstraction for content
- ✅ Type-safe throughout

---

## Documentation

### Core Concepts

📖 [Design Document](docs/llm-schema-design.md) - Complete architecture and rationale

🎯 **Single Source of Truth** - Define your schema once, use it everywhere

🔄 **Full Lifecycle Coverage** - From prompt generation to UI rendering

🎨 **Markdown Native** - First-class support for rich content

### Advanced Topics

- **Multi-Provider Support** - Works with OpenAI, Anthropic, Google, and more
- **Error Recovery** - Automatic fixing of common LLM output errors
- **Custom Components** - Override default React renderers
- **Schema Composition** - Reuse schemas across your application

---

## Development

### Setup

```bash
git clone https://github.com/shenli/llm-schema.git
cd llm-schema
npm install
```

### Commands

```bash
npm run build       # Compile TypeScript
npm test            # Run test suite
npm run test:watch  # Watch mode
npm run lint        # Check code style
```

### Project Structure

```
llm-schema/
├── src/
│   ├── schema/       # Core schema system
│   ├── react/        # React components
│   └── index.ts      # Public API
├── tests/            # Test suites
├── examples/         # Example applications
└── docs/             # Documentation
```

---

## Roadmap

- [ ] **Parsing Recovery** - LLM feedback loops for auto-correction
- [ ] **Additional Providers** - Native support for more LLM APIs
- [ ] **Component Themes** - Design tokens and theme system
- [ ] **Schema Migrations** - Version and migrate schemas safely
- [ ] **Streaming Support** - Handle streaming LLM responses
- [ ] **Field Validation** - Custom validation functions per field

---

## Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and add tests
4. **Run the test suite**: `npm test`
5. **Submit a pull request**

Please read our [Contributing Guide](CONTRIBUTING.md) for details.

---

## License

MIT © Li Shen

---

## Support

- 📖 [Documentation](docs/llm-schema-design.md)
- 💬 [Discussions](https://github.com/shenli/llm-schema/discussions)
- 🐛 [Issue Tracker](https://github.com/shenli/llm-schema/issues)

---

**Built with ❤️ for developers shipping AI features**

*Define your schema once. Point your LLM at it. Ship polished experiences.*

[Get Started](#quick-start) • [View Examples](#examples) • [Read Docs](docs/llm-schema-design.md)
