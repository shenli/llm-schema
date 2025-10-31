# llm-schema - Design Document

**The ORM for LLM Content**

## Executive Summary

**llm-schema** is a TypeScript library that provides a complete lifecycle solution for working with semi-structured content from Large Language Models (LLMs). 

### Real problem this solves

Building AI features today is fragile and repetitive.

For every new LLM-powered feature (meeting notes, call analysis, customer feedback digests, etc.) teams repeat the same steps:

- Manually describe the expected JSON structure in the prompt
- Hope the model follows it
- JSON.parse() and write custom validation logic
- Write React components to display the result
- Write React forms to edit/correct the result

Every time the shape changes, you touch the prompt, the parser, the validator, the UI, and the edit form. They drift and break.

llm-schema makes the schema the source of truth.
You declare the shape once, and get:

- LLM response instructions / tool schema
- Parser + validator with helpful errors and optional repair
- Typed data in TypeScript
- React renderer + editor that understands both structured fields and markdown

Also: real-world AI output is not purely structured. Some data should stay flexible, human, richly formatted. That's why markdown is a first-class field type (`md()`), not an afterthought. The library treats markdown as "LLM writes this for humans to read," and treats `text()`, `enumType()`, `date()`, etc. as "data we want to automate on."

This becomes the emotional anchor for the entire design doc.

### Official Branding

```
Package:     llm-schema
Domain:      llmschema.dev
Tagline:     "The ORM for LLM content"
Repository:  github.com/shenli/llm-schema
```

### Positioning: "The ORM for LLM"

Just as **ORMs (like Prisma, Drizzle) bridge the gap between your application code and databases**, llm-schema bridges the gap between your application and LLMs:

| Traditional Database Layer | LLM Content Layer |
|----------------------------|-------------------|
| **ORM** (Prisma, Drizzle) | **llm-schema** |
| Schema → Database tables | Schema → LLM prompts |
| Type-safe queries | Type-safe parsing |
| CRUD operations | Generate/Parse/Transform/Display |
| Migrations | Schema evolution |
| Query builder | Prompt builder |
| Views/formatters | Markdown rendering |

**The library addresses a fundamental challenge in AI-native applications**: balancing the need for structured data (for programmatic manipulation) with the need for rich, human-readable content (for which LLMs excel).

**Problem Statement**: Current approaches force developers to choose between:
- Pure JSON (structured but rigid, hard to edit, unnatural for LLMs)
- Pure Markdown (flexible but unstructured, hard to extract data, no guarantees)

**Solution**: A hybrid approach where:
1. A single schema definition drives the entire content lifecycle
2. JSON provides structure for metadata, arrays, and relationships
3. **Markdown provides rich content formatting AND easy rendering** (the biggest benefit!)
4. Type safety is maintained end-to-end with TypeScript
5. Works like an ORM - define once, use everywhere
6. Built-in display layer - from schema to beautiful UI automatically

**Key Use Cases**:
- Meeting notes with extractable action items and participants
- Research reports with structured findings and citations
- Customer feedback with sentiment tags and feature requests
- Sales call analysis with objections, next steps, and quotes
- Document summaries with key points and metadata

**Why Markdown is the Key**: All these use cases need rich, formatted content that looks good when displayed. Pure JSON gives you structure but ugly display. Pure markdown gives you pretty display but no structure. llm-schema gives you both - structured data that displays beautifully.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Core Concepts](#2-core-concepts)
3. [Schema Definition System](#3-schema-definition-system)
4. [LLM Integration Layer](#4-llm-integration-layer)
5. [Parsing & Validation Engine](#5-parsing--validation-engine)
6. [Type System](#6-type-system)
7. [React Components (Optional)](#7-react-components-optional)
8. [Transformation Pipeline](#8-transformation-pipeline)
9. [API Reference](#9-api-reference)
10. [Implementation Phases](#10-implementation-phases)
11. [Technical Specifications](#11-technical-specifications)

---

## 1. Architecture Overview

### 1.0 The ORM Analogy

To understand this library, think of it as an **ORM for LLMs**:

#### Traditional Database Development
```typescript
// 1. Define schema
const UserSchema = {
  id: uuid(),
  name: varchar(255),
  email: varchar(255),
  createdAt: timestamp()
}

// 2. Generate migration
db.createTable(UserSchema)

// 3. Type-safe operations
const user = await db.users.findOne({ id: '123' })  // Fully typed!
await db.users.create({ name: 'John', email: 'john@example.com' })

// 4. Query and transform
const activeUsers = await db.users.where({ active: true }).select(['name', 'email'])
```

#### LLM Content Development (with this library)
```typescript
// 1. Define schema
const MeetingNotesSchema = defineSchema({
  id: text({ optional: true }),
  summary: md({ description: "Meeting summary" }),
  actionItems: array({ schema: { ... } }),
  participants: array({ schema: { ... } })
})

// 2. Generate LLM prompt
const prompt = MeetingNotesSchema.toPrompt()  // Send to LLM

// 3. Type-safe operations
const notes = MeetingNotesSchema.parse(llmResponse)  // Fully typed!
await db.insert(notes)

// 4. Extract and transform
const todos = MeetingNotesSchema.extract(notes, 'actionItems', { 
  filter: item => item.status === 'todo' 
})
```

#### Key Parallels

| ORM Concept | LLM Library Equivalent | Purpose |
|-------------|------------------------|---------|
| Schema definition | `defineSchema()` | Single source of truth |
| Migration SQL | `toPrompt()` / `toOpenAITool()` | Instructions for system |
| Type inference | `z.infer<typeof Schema>` | TypeScript types from schema |
| Queries | `extract()` / `search()` | Get specific data |
| CRUD operations | `parse()` / `validate()` | Read/validate data |
| Relations | `array()` / `object()` | Nested structures |
| Indexes | Markdown fields | Searchable content |
| Transactions | Validation & repair | Ensure data consistency |

#### Why This Matters

Just as you wouldn't write raw SQL for every database operation, you shouldn't write custom parsing logic for every LLM response. The library provides:

✅ **Type safety** - Catch errors at compile time, not runtime  
✅ **Consistency** - Same patterns across all LLM interactions  
✅ **Maintainability** - Change schema in one place, updates everywhere  
✅ **Developer experience** - Autocomplete, validation, helpful errors  
✅ **Best practices** - Built-in handling of common LLM quirks  



### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│  (Next.js, React, Node.js - any TypeScript application)     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                 Structured LLM Library                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           1. Schema Definition Layer                  │  │
│  │  • Type definitions (markdown, entity, enum, etc.)    │  │
│  │  • Schema builder & validator                         │  │
│  │  • Schema introspection utilities                     │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐  │
│  │         2. LLM Integration Layer                      │  │
│  │  • Prompt generation (text format)                    │  │
│  │  • Tool schema generation (OpenAI, Anthropic)         │  │
│  │  • JSON Schema export                                 │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐  │
│  │       3. Parsing & Validation Engine                  │  │
│  │  • JSON parser with error recovery                    │  │
│  │  • Schema validation                                  │  │
│  │  • Auto-repair for common LLM errors                  │  │
│  │  • Detailed error messages with paths                 │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐  │
│  │            4. Type System                             │  │
│  │  • TypeScript type inference from schema              │  │
│  │  • Runtime type checking                              │  │
│  │  • Type guards and assertions                         │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────┴───────────────────────────────────────┐  │
│  │       5. Transformation Pipeline                      │  │
│  │  • Field extraction by path                           │  │
│  │  • Format conversion (markdown, CSV, JSON)            │  │
│  │  • Search across markdown fields                      │  │
│  │  • Diff and merge utilities                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      6. React Integration (Optional Package)          │  │
│  │  • SchemaRenderer component                           │  │
│  │  • SchemaEditor component                             │  │
│  │  • Field-level components                             │  │
│  │  • Hooks for data management                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow

```
Schema Definition
       ↓
   [Convert]
       ↓
┌──────┴────────┐
│               │
LLM Prompt    Tool Schema
       ↓
   [Send to LLM]
       ↓
  LLM Response (text/JSON)
       ↓
   [Parse & Validate]
       ↓
  Typed Data Object
       ↓
┌──────┴──────┐
│             │
Render UI   Transform/Extract
```

### 1.3 Package Structure

```
llm-schema/
├── packages/
│   ├── llm-schema/              # Core library (no UI dependencies)
│   │   ├── src/
│   │   │   ├── schema/         # Schema definition and builders
│   │   │   ├── llm/            # LLM integration (prompts, tools)
│   │   │   ├── parser/         # Parsing and validation
│   │   │   ├── types/          # Type definitions and inference
│   │   │   ├── transform/      # Transformation utilities
│   │   │   └── index.ts        # Main exports
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── llm-schema-react/        # React components (optional)
│       ├── src/
│       │   ├── components/     # React components
│       │   ├── hooks/          # React hooks
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── examples/                    # Example schemas and usage
├── docs/                        # Documentation
└── tests/                       # Test suites
```

---

## 2. Core Concepts

### 2.1 Content Roles

Every field in the schema has a **role** that determines how it should be treated:

| Role | Description | Example | Storage | UI Treatment |
|------|-------------|---------|---------|--------------|
| `markdown` | Rich text content with formatting **optimized for display** | Meeting summary, document body | TEXT | **Rendered markdown** (biggest benefit!) |
| `text` | Plain text without formatting | Name, title, label | VARCHAR | Plain text |
| `entity` | Named entity (person, company, etc.) | Participant name, company | VARCHAR | Linkable chip |
| `enum` | Fixed set of values | Status, priority, category | VARCHAR | Select/badge |
| `date` | Date or datetime | Due date, meeting time | DATE/TIMESTAMP | Date picker |
| `number` | Numeric value | Score, count, amount | INTEGER/DECIMAL | Number input |
| `boolean` | True/false value | Completed, approved | BOOLEAN | Checkbox/toggle |
| `array` | Collection of items | Action items, participants | One-to-many relation | List/table |
| `object` | Nested structure | Address, metadata | JSON or nested tables | Nested form |

**Key Insight**: Markdown fields are special because they serve **dual purposes**:
1. **Content format** - LLMs naturally generate markdown
2. **Display format** - Markdown renders beautifully to HTML with zero effort

This is why markdown is at the heart of llm-schema's value proposition.

### 2.2 Semi-Structured Data Model

**Philosophy**: Structure where you need it, flexibility where you want it.

```typescript
// Example: Meeting Notes
{
  // Structure for metadata
  id: "uuid-123",
  meetingDate: "2025-11-01T10:00:00Z",
  duration: 60,
  
  // Markdown for rich content
  summary: "## Key Discussion Points\n\nWe covered **Q4 planning**...",
  
  // Structured arrays with markdown fields
  actionItems: [
    {
      task: "Review the **pricing model** and prepare 3 options",
      assignee: "Sarah Chen",
      dueDate: "2025-11-15",
      priority: "high"
    }
  ],
  
  // Entities that can be linked
  participants: [
    { name: "Sarah Chen", role: "Product Lead" },
    { name: "John Doe", role: "Engineering Manager" }
  ]
}
```

### 2.3 Design Principles

1. **Single Source of Truth**: One schema definition drives everything
2. **Type Safety**: Full TypeScript inference from schema to data
3. **LLM-First**: Optimized for LLM generation and parsing
4. **Display-Ready**: Markdown fields render beautifully out of the box (zero effort UI)
5. **Framework Agnostic**: Core library works anywhere TypeScript runs
6. **Progressive Enhancement**: Start simple, add features as needed
7. **Error Tolerance**: Handle LLM inconsistencies gracefully
8. **Developer Experience**: Intuitive API, helpful error messages

---

## 3. Schema Definition System

### 3.1 Schema Builder API

```typescript
import { defineSchema, md, text, entity, enumType, date, array, object, number, boolean } from 'llm-schema'

const MeetingNotesSchema = defineSchema({
  // Metadata
  id: text({ 
    description: "Unique identifier",
    optional: true // Generated if not provided
  }),
  
  meetingDate: date({ 
    description: "When the meeting took place",
    required: true
  }),
  
  duration: number({ 
    description: "Meeting duration in minutes",
    min: 0,
    max: 480,
    optional: true
  }),
  
  // Rich content
  summary: md({
    description: "High-level overview of the meeting",
    maxLength: 1000,
    placeholder: "A comprehensive summary covering key topics discussed..."
  }),
  
  // Structured arrays
  actionItems: array({
    description: "List of concrete action items with owners and deadlines",
    minItems: 0,
    schema: {
      id: text({ optional: true }),
      
      task: md({ 
        description: "What needs to be done",
        required: true,
        maxLength: 500
      }),
      
      assignee: entity('person', { 
        description: "Person responsible for this task",
        required: true
      }),
      
      dueDate: date({ 
        description: "When this task should be completed",
        optional: true
      }),
      
      priority: enumType(['high', 'medium', 'low'], {
        description: "Task priority level",
        default: 'medium'
      }),
      
      status: enumType(['todo', 'in-progress', 'done'], { 
        description: "Current status of the task",
        default: 'todo'
      })
    }
  }),
  
  participants: array({
    description: "People who attended the meeting",
    minItems: 1,
    schema: {
      name: entity('person', { 
        description: "Person's full name",
        required: true
      }),
      
      role: text({ 
        description: "Their job title or role",
        optional: true
      }),
      
      contributions: md({ 
        description: "Key points or insights they shared",
        optional: true,
        maxLength: 500
      })
    }
  }),
  
  decisions: array({
    description: "Important decisions made during the meeting",
    minItems: 0,
    schema: {
      decision: md({ 
        description: "What was decided",
        required: true
      }),
      
      rationale: md({ 
        description: "Why this decision was made",
        optional: true
      }),
      
      impact: enumType(['high', 'medium', 'low'], {
        description: "Expected impact of this decision"
      }),
      
      concerns: md({ 
        description: "Any concerns or risks raised",
        optional: true
      })
    }
  }),
  
  nextSteps: md({
    description: "Overall next steps and follow-up actions",
    maxLength: 1000,
    optional: true
  }),
  
  // Nested objects
  metadata: object({
    description: "Additional meeting metadata",
    optional: true,
    schema: {
      location: text({ description: "Meeting location or video link" }),
      organizer: entity('person', { description: "Who organized the meeting" }),
      recordingUrl: text({ description: "Link to meeting recording" }),
      transcriptUrl: text({ description: "Link to transcript" })
    }
  })
})
```

### 3.2 Field Type Definitions

#### Markdown Field
```typescript
interface MarkdownFieldOptions {
  description: string;           // Help text for LLM
  required?: boolean;             // Default: true
  optional?: boolean;             // Alias for !required
  maxLength?: number;             // Character limit
  minLength?: number;             // Minimum characters
  placeholder?: string;           // Example content
  allowedElements?: string[];     // Restrict markdown elements
  default?: string;               // Default value
  
  // Display/Rendering options
  displayMode?: 'full' | 'inline' | 'preview'; // How to render
  sanitize?: boolean;             // Sanitize HTML (default: true)
  customRenderer?: string;        // Custom markdown renderer component
  highlightCode?: boolean;        // Syntax highlighting for code blocks
}

function md(options: MarkdownFieldOptions): MarkdownField
```

**Display modes:**
- `full` - Render complete markdown with all formatting (default)
- `inline` - Render as inline text (e.g., for list items, titles)
- `preview` - Show truncated version with "read more" option

#### Text Field
```typescript
interface TextFieldOptions {
  description: string;
  required?: boolean;
  optional?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: RegExp;              // Validation pattern
  default?: string;
}

function text(options: TextFieldOptions): TextField
```

#### Entity Field
```typescript
type EntityType = 'person' | 'company' | 'product' | 'location' | 'custom'

interface EntityFieldOptions {
  description: string;
  required?: boolean;
  optional?: boolean;
  entityType?: EntityType;       // For specialized handling
  linkable?: boolean;            // Can link to entity profile
  default?: string;
}

function entity(type: EntityType, options: EntityFieldOptions): EntityField
```

#### Enum Field
```typescript
interface EnumFieldOptions<T extends string> {
  description: string;
  required?: boolean;
  optional?: boolean;
  default?: T;
  labels?: Record<T, string>;    // Human-readable labels
}

function enumType<T extends string>(
  values: readonly T[], 
  options: EnumFieldOptions<T>
): EnumField<T>
```

#### Date Field
```typescript
interface DateFieldOptions {
  description: string;
  required?: boolean;
  optional?: boolean;
  format?: 'date' | 'datetime' | 'time'; // Default: 'date'
  min?: Date | string;           // Minimum date
  max?: Date | string;           // Maximum date
  default?: Date | string;
}

function date(options: DateFieldOptions): DateField
```

#### Number Field
```typescript
interface NumberFieldOptions {
  description: string;
  required?: boolean;
  optional?: boolean;
  min?: number;
  max?: number;
  integer?: boolean;             // Only allow integers
  precision?: number;            // Decimal places
  default?: number;
}

function number(options: NumberFieldOptions): NumberField
```

#### Boolean Field
```typescript
interface BooleanFieldOptions {
  description: string;
  required?: boolean;
  optional?: boolean;
  default?: boolean;
  labels?: { true: string; false: string }; // Custom labels
}

function boolean(options: BooleanFieldOptions): BooleanField
```

#### Array Field
```typescript
interface ArrayFieldOptions {
  description: string;
  minItems?: number;             // Minimum array length
  maxItems?: number;             // Maximum array length
  schema: SchemaDefinition;      // Schema for array items
  uniqueBy?: string;             // Field to ensure uniqueness
}

function array(options: ArrayFieldOptions): ArrayField
```

#### Object Field
```typescript
interface ObjectFieldOptions {
  description: string;
  required?: boolean;
  optional?: boolean;
  schema: SchemaDefinition;      // Nested schema
}

function object(options: ObjectFieldOptions): ObjectField
```

### 3.3 Schema Metadata

```typescript
interface SchemaOptions {
  name?: string;                 // Schema name
  description?: string;          // Schema description
  version?: string;              // Schema version
  strict?: boolean;              // Reject unknown fields
  examples?: any[];              // Example data
}

const schema = defineSchema({
  // fields...
}, {
  name: "MeetingNotes",
  description: "Structured meeting notes with action items",
  version: "1.0.0",
  strict: false,                 // Allow extra fields from LLM
  examples: [
    // Example meeting notes objects
  ]
})
```

---

## 4. LLM Integration Layer

### 4.1 Text Prompt Generation

```typescript
// Generate human-readable schema description for prompt
const promptText = MeetingNotesSchema.toPrompt({
  format: 'detailed' | 'compact',    // Level of detail
  includeExamples: boolean,          // Include example values
  includeConstraints: boolean,       // Show validation rules
  style: 'instructional' | 'technical' // Writing style
})

// Output example (detailed format):
/*
Please structure your response as JSON matching this schema:

{
  "meetingDate": "ISO date string (REQUIRED) - When the meeting took place",
  "duration": "number (optional) - Meeting duration in minutes (0-480)",
  "summary": "markdown string (REQUIRED, max 1000 chars) - High-level overview of the meeting",
  "actionItems": [
    {
      "task": "markdown string (REQUIRED, max 500 chars) - What needs to be done",
      "assignee": "string (REQUIRED) - Person responsible for this task",
      "dueDate": "ISO date string (optional) - When this task should be completed",
      "priority": "'high' | 'medium' | 'low' (default: 'medium') - Task priority level",
      "status": "'todo' | 'in-progress' | 'done' (default: 'todo') - Current status"
    }
  ],
  "participants": [
    {
      "name": "string (REQUIRED) - Person's full name",
      "role": "string (optional) - Their job title or role",
      "contributions": "markdown string (optional, max 500 chars) - Key points they shared"
    }
  ],
  // ... more fields
}

Important Notes:
- Fields marked 'markdown' support **bold**, *italic*, lists, and links
- REQUIRED fields must not be null or empty
- Use ISO 8601 format for dates (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
- Enum fields must use one of the specified values exactly
- Arrays can be empty unless minItems is specified
*/
```

### 4.2 OpenAI Tool Schema

```typescript
// Generate OpenAI function calling schema
const openAITool = MeetingNotesSchema.toOpenAITool({
  name: "save_meeting_notes",
  description: "Save structured meeting notes to the database"
})

// Output:
/*
{
  type: "function",
  function: {
    name: "save_meeting_notes",
    description: "Save structured meeting notes to the database",
    parameters: {
      type: "object",
      properties: {
        meetingDate: {
          type: "string",
          format: "date-time",
          description: "When the meeting took place"
        },
        duration: {
          type: "number",
          minimum: 0,
          maximum: 480,
          description: "Meeting duration in minutes"
        },
        summary: {
          type: "string",
          maxLength: 1000,
          description: "High-level overview (markdown supported)"
        },
        actionItems: {
          type: "array",
          items: {
            type: "object",
            properties: {
              task: { type: "string", maxLength: 500 },
              assignee: { type: "string" },
              dueDate: { type: "string", format: "date" },
              priority: { type: "string", enum: ["high", "medium", "low"] },
              status: { type: "string", enum: ["todo", "in-progress", "done"] }
            },
            required: ["task", "assignee"]
          }
        },
        // ... more properties
      },
      required: ["meetingDate", "summary", "participants"]
    }
  }
}
*/
```

### 4.3 Anthropic Tool Schema

```typescript
// Generate Anthropic tool use schema
const anthropicTool = MeetingNotesSchema.toAnthropicTool({
  name: "save_meeting_notes",
  description: "Save structured meeting notes"
})

// Similar structure optimized for Anthropic's format
```

### 4.4 JSON Schema Export

```typescript
// Export as standard JSON Schema
const jsonSchema = MeetingNotesSchema.toJsonSchema()

// Standard JSON Schema format for validation
```

### 4.5 Usage Example with OpenAI

```typescript
import OpenAI from 'openai'
import { MeetingNotesSchema } from './schemas/meeting-notes'

const openai = new OpenAI()

async function analyzeMeeting(transcript: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: "You are a meeting analysis assistant. Extract structured information from meeting transcripts."
      },
      {
        role: "user",
        content: `Analyze this meeting transcript and extract key information.\n\n${MeetingNotesSchema.toPrompt()}\n\nTranscript:\n${transcript}`
      }
    ],
    response_format: { type: "json_object" }
  })
  
  const content = response.choices[0].message.content
  const result = MeetingNotesSchema.parse(content)
  
  if (!result.success) {
    throw new Error("Failed to parse meeting notes", result.errors)
  }
  
  return result.data
}
```

### 4.6 Usage Example with Tool Calling

```typescript
async function analyzeMeetingWithTools(transcript: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content: `Analyze this meeting transcript: ${transcript}`
      }
    ],
    tools: [MeetingNotesSchema.toOpenAITool()],
    tool_choice: "auto"
  })
  
  const toolCall = response.choices[0].message.tool_calls?.[0]
  if (toolCall) {
    const args = JSON.parse(toolCall.function.arguments)
    const result = MeetingNotesSchema.parse(args)
    return result.data
  }
}
```

---

## 5. Parsing & Validation Engine

### 5.1 Parse Methods

```typescript
// Strict parsing - throws on error
const data = MeetingNotesSchema.parse(llmResponse)
// Returns: MeetingNotes (typed)
// Throws: ValidationError with detailed messages

// Safe parsing - returns result object
const result = MeetingNotesSchema.safeParse(llmResponse)
if (result.success) {
  const data: MeetingNotes = result.data
} else {
  console.error(result.errors)
}
// Returns: { success: true, data: MeetingNotes } | { success: false, errors: ValidationError[] }

// Parse with auto-repair
const repaired = MeetingNotesSchema.parseWithRepair(llmResponse, {
  onError: (error: ValidationError) => {
    // Custom repair logic
    if (error.path === 'dueDate' && error.code === 'invalid_format') {
      return parseFuzzyDate(error.value) // "next Friday" -> ISO date
    }
  },
  strictMode: false // Allow unknown fields
})
```

### 5.2 Validation Errors

```typescript
interface ValidationError {
  path: string;              // JSON path to field (e.g., "actionItems[0].dueDate")
  code: ValidationErrorCode; // Error type
  message: string;           // Human-readable message
  expected?: any;            // Expected value/type
  received?: any;            // Actual value received
  field?: FieldDefinition;   // Field schema definition
}

type ValidationErrorCode =
  | 'required_field_missing'
  | 'invalid_type'
  | 'invalid_format'
  | 'out_of_range'
  | 'invalid_enum_value'
  | 'string_too_long'
  | 'string_too_short'
  | 'array_too_short'
  | 'array_too_long'
  | 'invalid_date'
  | 'custom_validation_failed'
  | 'unknown_field'

// Example error:
/*
{
  path: "actionItems[0].priority",
  code: "invalid_enum_value",
  message: "Invalid priority value. Must be one of: high, medium, low",
  expected: ["high", "medium", "low"],
  received: "urgent",
  field: { type: "enum", values: ["high", "medium", "low"], ... }
}
*/
```

### 5.3 Auto-Repair Strategies

Built-in repair strategies for common LLM mistakes:

```typescript
interface RepairOptions {
  // Custom repair functions
  onError?: (error: ValidationError) => any;
  
  // Built-in repair strategies
  repairs?: {
    // Convert fuzzy dates: "next Friday", "in 2 weeks"
    fuzzyDates?: boolean;
    
    // Fix common enum mistakes: "High" -> "high", "In Progress" -> "in-progress"
    normalizeEnums?: boolean;
    
    // Trim whitespace from strings
    trimStrings?: boolean;
    
    // Convert null to empty string for optional text fields
    nullToEmpty?: boolean;
    
    // Parse markdown from plain text (add proper formatting)
    inferMarkdown?: boolean;
    
    // Extract entities from text: "Sarah from Product" -> "Sarah"
    extractEntities?: boolean;
    
    // Remove unknown fields instead of erroring
    stripUnknown?: boolean;
  };
  
  // How strict to be
  strictMode?: boolean;
}

// Usage
const result = MeetingNotesSchema.parseWithRepair(llmResponse, {
  repairs: {
    fuzzyDates: true,
    normalizeEnums: true,
    trimStrings: true,
    stripUnknown: true
  }
})
```

### 5.4 Validation Methods

```typescript
// Just validate without parsing
const errors = MeetingNotesSchema.validate(data)
if (errors.length > 0) {
  console.error("Validation failed:", errors)
}

// Validate specific field
const fieldErrors = MeetingNotesSchema.validateField('actionItems[0].dueDate', value)

// Check if data matches schema
const isValid = MeetingNotesSchema.isValid(data)
```

---

## 6. Type System

### 6.1 Type Inference

```typescript
import { z } from 'structured-llm'

// Infer TypeScript type from schema
type MeetingNotes = z.infer<typeof MeetingNotesSchema>

// Resulting type:
/*
type MeetingNotes = {
  id?: string;
  meetingDate: Date;
  duration?: number;
  summary: string;
  actionItems: Array<{
    id?: string;
    task: string;
    assignee: string;
    dueDate?: Date;
    priority: 'high' | 'medium' | 'low';
    status: 'todo' | 'in-progress' | 'done';
  }>;
  participants: Array<{
    name: string;
    role?: string;
    contributions?: string;
  }>;
  decisions: Array<{
    decision: string;
    rationale?: string;
    impact: 'high' | 'medium' | 'low';
    concerns?: string;
  }>;
  nextSteps?: string;
  metadata?: {
    location?: string;
    organizer?: string;
    recordingUrl?: string;
    transcriptUrl?: string;
  };
}
*/
```

### 6.2 Type Guards

```typescript
// Check if value matches schema type
function isMeetingNotes(value: unknown): value is MeetingNotes {
  return MeetingNotesSchema.isValid(value)
}

// Use in code
function processMeeting(data: unknown) {
  if (isMeetingNotes(data)) {
    // TypeScript knows data is MeetingNotes here
    console.log(data.summary)
    data.actionItems.forEach(item => {
      console.log(item.task, item.assignee)
    })
  }
}
```

### 6.3 Partial Types

```typescript
// For updates/patches
type PartialMeetingNotes = z.Partial<typeof MeetingNotesSchema>

// For creating new records (some fields may be generated)
type CreateMeetingNotes = z.Input<typeof MeetingNotesSchema>

// For database output (all fields populated)
type MeetingNotesOutput = z.Output<typeof MeetingNotesSchema>
```

---

## 7. React Components (Optional)

### 7.1 Schema Renderer

**The Display Layer** - This is where llm-schema shines. Markdown fields automatically render beautifully with zero configuration.

```typescript
import { SchemaRenderer } from 'llm-schema/react'

interface SchemaRendererProps<T> {
  schema: Schema<T>;
  data: T;
  
  // Customize rendering per field type
  components?: {
    markdown?: React.ComponentType<{ value: string; displayMode?: string }>;
    text?: React.ComponentType<{ value: string }>;
    entity?: React.ComponentType<{ value: string; type: string }>;
    date?: React.ComponentType<{ value: Date }>;
    enum?: React.ComponentType<{ value: string; options: string[] }>;
    number?: React.ComponentType<{ value: number }>;
    boolean?: React.ComponentType<{ value: boolean }>;
  };
  
  // Markdown rendering options (KEY FEATURE!)
  markdownOptions?: {
    sanitize?: boolean;           // Sanitize HTML (default: true)
    highlightCode?: boolean;      // Syntax highlighting (default: true)
    linkTarget?: '_blank' | '_self'; // Link behavior
    allowedElements?: string[];   // Restrict elements
    customComponents?: {          // Custom markdown components
      h1?: React.ComponentType;
      h2?: React.ComponentType;
      code?: React.ComponentType;
      link?: React.ComponentType;
    };
  };
  
  // Field-specific actions
  fieldActions?: {
    [path: string]: Array<{
      label: string;
      icon?: React.ComponentType;
      handler: (value: any) => void | Promise<void>;
    }>;
  };
  
  // Layout options
  layout?: 'vertical' | 'horizontal' | 'grid';
  spacing?: 'compact' | 'normal' | 'comfortable';
  
  // Field visibility
  showOptionalFields?: boolean;
  hiddenFields?: string[];
  
  // Interaction
  onFieldClick?: (path: string, value: any) => void;
  onEntityClick?: (entity: string, type: string) => void;
}

// Usage - Display is automatic!
<SchemaRenderer
  schema={MeetingNotesSchema}
  data={meetingData}
  
  // Markdown renders beautifully out of the box
  markdownOptions={{
    highlightCode: true,
    sanitize: true
  }}
  
  // Optional: Customize specific components
  components={{
    markdown: CustomMarkdownRenderer,
    entity: EntityChip
  }}
  
  fieldActions={{
    'actionItems': [
      {
        label: "Export to TODO app",
        icon: CheckSquare,
        handler: async (items) => {
          await exportToTodoApp(items)
        }
      }
    ]
  }}
/>
```

**Example of automatic markdown rendering:**

```typescript
// Schema with markdown field
const schema = defineSchema({
  summary: md({ 
    description: "Meeting summary",
    displayMode: 'full'
  })
})

// LLM returns this markdown
const data = {
  summary: `
## Key Decisions

We decided to:
- Launch the **new feature** in Q2
- Increase budget by 20%
- Hire 3 more engineers

### Next Steps
1. Create project timeline
2. Post job listings
3. Schedule kickoff meeting
  `
}

// Just render - it looks great automatically!
<SchemaRenderer schema={schema} data={data} />

// Output is beautifully formatted HTML with:
// ✅ Proper heading hierarchy
// ✅ Bold text rendered
// ✅ Lists formatted correctly
// ✅ Semantic HTML structure
// ✅ Accessible markup
```

**This is the killer feature** - developers get beautiful displays for free!

### 7.2 Schema Editor

```typescript
import { SchemaEditor } from 'structured-llm/react'

interface SchemaEditorProps<T> {
  schema: Schema<T>;
  data: T;
  onChange: (data: T) => void;
  
  // Edit modes per field type
  editModes?: {
    markdown?: 'richtext' | 'textarea' | 'inline';
    text?: 'input' | 'textarea';
    entity?: 'input' | 'autocomplete' | 'select';
    date?: 'datepicker' | 'input';
    enum?: 'select' | 'radio' | 'buttons';
    number?: 'input' | 'slider';
    boolean?: 'checkbox' | 'toggle' | 'switch';
  };
  
  // Entity resolution for autocomplete
  entityResolvers?: {
    [entityType: string]: (query: string) => Promise<Array<{
      value: string;
      label: string;
      metadata?: any;
    }>>;
  };
  
  // Validation
  validateOnChange?: boolean;
  showValidationErrors?: boolean;
  
  // UI
  disabled?: boolean;
  readOnlyFields?: string[];
}

// Usage
<SchemaEditor
  schema={MeetingNotesSchema}
  data={meetingData}
  onChange={setMeetingData}
  editModes={{
    markdown: 'richtext',
    entity: 'autocomplete',
    enum: 'select'
  }}
  entityResolvers={{
    person: async (query) => {
      const users = await searchUsers(query)
      return users.map(u => ({
        value: u.name,
        label: `${u.name} (${u.title})`,
        metadata: { id: u.id, email: u.email }
      }))
    }
  }}
/>
```

### 7.3 Field Component

```typescript
import { SchemaField } from 'structured-llm/react'

interface SchemaFieldProps<T> {
  schema: Schema<T>;
  data: T;
  path: string; // e.g., "actionItems[0].task"
  
  // Display mode
  mode?: 'view' | 'edit';
  
  // Custom renderer
  render?: (value: any, field: FieldDefinition) => React.ReactNode;
  
  // Edit handler
  onChange?: (value: any) => void;
  
  // Actions
  actions?: Array<{
    label: string;
    handler: (value: any) => void;
  }>;
}

// Usage
<SchemaField
  schema={MeetingNotesSchema}
  data={meetingData}
  path="actionItems[0].task"
  mode="edit"
  onChange={(value) => {
    // Update specific field
    updateField('actionItems[0].task', value)
  }}
/>
```

### 7.4 Custom Hooks

```typescript
// Manage schema data state
function useSchemaData<T>(schema: Schema<T>, initialData: T) {
  const [data, setData] = useState<T>(initialData)
  const [errors, setErrors] = useState<ValidationError[]>([])
  
  const updateField = (path: string, value: any) => {
    // Update nested field by path
  }
  
  const validate = () => {
    const errors = schema.validate(data)
    setErrors(errors)
    return errors.length === 0
  }
  
  return { data, setData, updateField, validate, errors }
}

// Usage
function MeetingNotesEditor() {
  const { data, updateField, validate, errors } = useSchemaData(
    MeetingNotesSchema,
    initialMeetingNotes
  )
  
  return (
    <SchemaEditor
      schema={MeetingNotesSchema}
      data={data}
      onChange={(newData) => updateField('', newData)}
    />
  )
}
```

---

## 8. Transformation Pipeline

### 8.1 Field Extraction

```typescript
// Extract specific fields by path
const actionItems = MeetingNotesSchema.extract(data, 'actionItems')
// Returns: Array<ActionItem>

const firstTask = MeetingNotesSchema.extract(data, 'actionItems[0].task')
// Returns: string

// Extract with transformation
const todoTasks = MeetingNotesSchema.extract(data, 'actionItems', {
  filter: (item) => item.status === 'todo',
  transform: (item) => ({
    id: item.id,
    title: stripMarkdown(item.task),
    assignee: item.assignee,
    due: item.dueDate
  })
})
```

### 8.2 Format Conversion

```typescript
// Convert to Markdown document
const markdown = MeetingNotesSchema.toMarkdown(data, {
  sections: ['summary', 'actionItems', 'decisions'],
  includeMetadata: true,
  template: 'default' | 'minimal' | 'detailed'
})

// Convert to CSV (for arrays)
const csv = MeetingNotesSchema.toCSV(data.actionItems, {
  fields: ['task', 'assignee', 'dueDate', 'priority', 'status'],
  headers: ['Task', 'Assignee', 'Due Date', 'Priority', 'Status'],
  stripMarkdown: true // Remove markdown from output
})

// Convert to plain object (for API responses)
const json = MeetingNotesSchema.toJSON(data, {
  stripMarkdown: false, // Keep markdown
  includeMeta: false    // Don't include schema metadata
})
```

### 8.3 Search

```typescript
// Search across markdown fields
const results = MeetingNotesSchema.search(data, 'pricing strategy', {
  fields: ['summary', 'actionItems[].task', 'decisions[].decision'],
  caseSensitive: false,
  matchWhole: false
})

// Returns:
/*
[
  {
    path: 'summary',
    matches: [
      {
        text: '...discussed **pricing strategy** for Q4...',
        position: 45,
        length: 16
      }
    ]
  },
  {
    path: 'actionItems[1].task',
    matches: [...]
  }
]
*/
```

### 8.4 Diff & Merge

```typescript
// Compare two versions
const diff = MeetingNotesSchema.diff(oldData, newData)

// Returns:
/*
{
  changed: [
    {
      path: 'actionItems[0].status',
      oldValue: 'todo',
      newValue: 'done',
      type: 'modified'
    },
    {
      path: 'actionItems[2]',
      value: { task: '...', ... },
      type: 'added'
    }
  ],
  summary: {
    added: 1,
    modified: 1,
    deleted: 0
  }
}
*/

// Merge with conflict resolution
const merged = MeetingNotesSchema.merge(baseData, updates, {
  strategy: 'overwrite' | 'preserve' | 'custom',
  onConflict: (path, baseValue, updateValue) => {
    // Custom resolution logic
    return updateValue
  }
})
```

### 8.5 Entity Extraction

```typescript
// Extract all entities of a specific type
const people = MeetingNotesSchema.getEntities(data, 'person')

// Returns:
/*
[
  {
    value: 'Sarah Chen',
    paths: ['actionItems[0].assignee', 'participants[0].name'],
    occurrences: 2
  },
  {
    value: 'John Doe',
    paths: ['participants[1].name'],
    occurrences: 1
  }
]
*/

// Get all markdown fields
const markdownFields = MeetingNotesSchema.getMarkdownFields(data)

// Returns:
/*
[
  { path: 'summary', value: '## Key Points...' },
  { path: 'actionItems[0].task', value: 'Review **pricing**...' },
  { path: 'nextSteps', value: 'Follow up next week...' }
]
*/
```

---

## 9. API Reference

### 9.1 Schema Definition

```typescript
// Define schema
defineSchema(definition: SchemaDefinition, options?: SchemaOptions): Schema

// Field types
md(options: MarkdownFieldOptions): MarkdownField
text(options: TextFieldOptions): TextField
entity(type: EntityType, options: EntityFieldOptions): EntityField
enumType<T>(values: T[], options: EnumFieldOptions<T>): EnumField<T>
date(options: DateFieldOptions): DateField
number(options: NumberFieldOptions): NumberField
boolean(options: BooleanFieldOptions): BooleanField
array(options: ArrayFieldOptions): ArrayField
object(options: ObjectFieldOptions): ObjectField
```

### 9.2 LLM Integration

```typescript
interface Schema<T> {
  // Prompt generation
  toPrompt(options?: PromptOptions): string
  
  // Tool schemas
  toOpenAITool(config?: ToolConfig): OpenAITool
  toAnthropicTool(config?: ToolConfig): AnthropicTool
  toJsonSchema(): JsonSchema
}
```

### 9.3 Parsing & Validation

```typescript
interface Schema<T> {
  // Parsing
  parse(input: string | unknown): T
  safeParse(input: string | unknown): ParseResult<T>
  parseWithRepair(input: string | unknown, options?: RepairOptions): T
  
  // Validation
  validate(data: unknown): ValidationError[]
  validateField(path: string, value: unknown): ValidationError[]
  isValid(data: unknown): boolean
}

type ParseResult<T> = 
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] }
```

### 9.4 Type Inference

```typescript
// Infer types from schema
type Infer<S extends Schema<any>> = z.infer<S>
type Input<S extends Schema<any>> = z.input<S>
type Output<S extends Schema<any>> = z.output<S>
type Partial<S extends Schema<any>> = z.partial<S>
```

### 9.5 Transformations

```typescript
interface Schema<T> {
  // Extraction
  extract(data: T, path: string, options?: ExtractOptions): any
  
  // Format conversion
  toMarkdown(data: T, options?: MarkdownOptions): string
  toCSV(data: any[], options?: CSVOptions): string
  toJSON(data: T, options?: JSONOptions): Record<string, any>
  
  // Search
  search(data: T, query: string, options?: SearchOptions): SearchResult[]
  
  // Diff & merge
  diff(oldData: T, newData: T): DiffResult
  merge(base: T, updates: Partial<T>, options?: MergeOptions): T
  
  // Entity extraction
  getEntities(data: T, type?: EntityType): Entity[]
  getMarkdownFields(data: T): MarkdownField[]
  
  // Schema introspection
  getFieldSchema(path: string): FieldDefinition | undefined
  getFieldType(path: string): FieldType | undefined
  getPaths(): string[]
}
```

### 9.6 React Components

```typescript
// Components
SchemaRenderer<T>(props: SchemaRendererProps<T>): JSX.Element
SchemaEditor<T>(props: SchemaEditorProps<T>): JSX.Element
SchemaField<T>(props: SchemaFieldProps<T>): JSX.Element

// Hooks
useSchemaData<T>(schema: Schema<T>, initial: T): SchemaDataState<T>
useSchemaValidation<T>(schema: Schema<T>, data: T): ValidationState
```

---

## 10. Implementation Phases

### Phase 1: Core Schema System (Week 1-2)
**Goal**: Basic schema definition and type system

**Deliverables**:
- [ ] Schema builder API (`defineSchema`, field types)
- [ ] Internal schema representation
- [ ] Type inference with TypeScript
- [ ] Basic validation engine
- [ ] Unit tests for schema definition

**Files**:
```
packages/core/src/
├── schema/
│   ├── builder.ts         # defineSchema function
│   ├── fields.ts          # Field type definitions
│   ├── types.ts           # TypeScript types
│   └── validation.ts      # Validation logic
└── index.ts
```

### Phase 2: Parsing & Validation (Week 2-3)
**Goal**: Parse LLM output and validate against schema

**Deliverables**:
- [ ] JSON parser with error recovery
- [ ] Schema validation with detailed errors
- [ ] `parse()`, `safeParse()` methods
- [ ] Error formatting and messages
- [ ] Unit tests for parsing

**Files**:
```
packages/core/src/
├── parser/
│   ├── parse.ts           # Main parsing logic
│   ├── validate.ts        # Validation implementation
│   ├── errors.ts          # Error types and formatting
│   └── utils.ts           # Parsing utilities
```

### Phase 3: LLM Integration (Week 3-4)
**Goal**: Generate prompts and tool schemas

**Deliverables**:
- [ ] Text prompt generation (`toPrompt()`)
- [ ] OpenAI tool schema (`toOpenAITool()`)
- [ ] Anthropic tool schema (`toAnthropicTool()`)
- [ ] JSON Schema export (`toJsonSchema()`)
- [ ] Examples and documentation

**Files**:
```
packages/core/src/
├── llm/
│   ├── prompt.ts          # Prompt generation
│   ├── openai.ts          # OpenAI integration
│   ├── anthropic.ts       # Anthropic integration
│   └── json-schema.ts     # JSON Schema export
```

### Phase 4: Auto-Repair (Week 4-5)
**Goal**: Handle common LLM mistakes gracefully

**Deliverables**:
- [ ] Fuzzy date parsing
- [ ] Enum normalization
- [ ] String trimming and cleanup
- [ ] Entity extraction
- [ ] `parseWithRepair()` method
- [ ] Unit tests for repair strategies

**Files**:
```
packages/core/src/
├── repair/
│   ├── strategies.ts      # Built-in repair strategies
│   ├── fuzzy-date.ts      # Date parsing
│   ├── normalize.ts       # Text normalization
│   └── index.ts           # Main repair logic
```

### Phase 5: Transformations (Week 5-6)
**Goal**: Extract, convert, and manipulate data

**Deliverables**:
- [ ] Field extraction by path
- [ ] Format conversion (Markdown, CSV, JSON)
- [ ] Search across markdown fields
- [ ] Diff and merge utilities
- [ ] Entity extraction
- [ ] Unit tests

**Files**:
```
packages/core/src/
├── transform/
│   ├── extract.ts         # Field extraction
│   ├── convert.ts         # Format conversion
│   ├── search.ts          # Search functionality
│   ├── diff.ts            # Diff and merge
│   └── entities.ts        # Entity extraction
```

### Phase 6: React Components (Week 6-8)
**Goal**: UI components for rendering and editing

**Deliverables**:
- [ ] `SchemaRenderer` component
- [ ] `SchemaEditor` component
- [ ] `SchemaField` component
- [ ] Custom hooks (`useSchemaData`, etc.)
- [ ] Default component implementations
- [ ] Storybook stories
- [ ] Component tests

**Files**:
```
packages/react/src/
├── components/
│   ├── SchemaRenderer.tsx
│   ├── SchemaEditor.tsx
│   ├── SchemaField.tsx
│   └── defaults/          # Default field components
│       ├── MarkdownDisplay.tsx
│       ├── EntityChip.tsx
│       └── ...
├── hooks/
│   ├── useSchemaData.ts
│   └── useSchemaValidation.ts
└── index.ts
```

### Phase 7: Documentation & Examples (Week 8-9)
**Goal**: Comprehensive docs and examples

**Deliverables**:
- [ ] API documentation
- [ ] Usage guides
- [ ] Example schemas (meeting notes, reports, etc.)
- [ ] Integration examples (Next.js, OpenAI, etc.)
- [ ] Best practices guide
- [ ] Migration guide

**Files**:
```
docs/
├── getting-started.md
├── api-reference.md
├── guides/
│   ├── schema-design.md
│   ├── llm-integration.md
│   └── react-components.md
└── examples/
    ├── meeting-notes/
    ├── research-report/
    └── customer-feedback/
```

### Phase 8: Testing & Polish (Week 9-10)
**Goal**: Production-ready library

**Deliverables**:
- [ ] Comprehensive test coverage (>80%)
- [ ] Performance optimization
- [ ] Bundle size optimization
- [ ] TypeScript strict mode
- [ ] ESLint/Prettier setup
- [ ] CI/CD pipeline
- [ ] NPM package publishing

---

## 11. Technical Specifications

### 11.1 Technology Stack

**Core Library**:
- TypeScript 5.3+
- No runtime dependencies (pure TypeScript)
- ESM and CommonJS builds
- Tree-shakeable exports

**React Package** (optional):
- React 18+
- No other UI library dependencies
- Headless components (BYO styling)

**Development**:
- Vitest for testing
- TSX/ESBuild for building
- Changesets for versioning
- Storybook for component development

### 11.2 Package Configuration

```json
// packages/llm-schema/package.json
{
  "name": "llm-schema",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts",
    "test": "vitest",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {},
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsup": "^8.0.0",
    "vitest": "^1.0.0"
  }
}
```

```json
// packages/llm-schema-react/package.json
{
  "name": "llm-schema-react",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "llm-schema": "workspace:*"
  }
}
```

### 11.3 TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020"],
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 11.4 Build Configuration

```typescript
// tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false, // Let consumers minify
})
```

### 11.5 Testing Strategy

```typescript
// Example test structure
import { describe, it, expect } from 'vitest'
import { defineSchema, md, text, array } from 'llm-schema'

describe('Schema Definition', () => {
  it('should define a schema with markdown fields', () => {
    const schema = defineSchema({
      title: text({ description: "Title" }),
      content: md({ description: "Main content" })
    })
    
    expect(schema).toBeDefined()
    expect(schema.getFieldType('content')).toBe('markdown')
  })
  
  it('should infer correct TypeScript types', () => {
    const schema = defineSchema({
      count: number({ description: "Count" })
    })
    
    type Data = z.infer<typeof schema>
    const data: Data = { count: 42 }
    
    expect(schema.isValid(data)).toBe(true)
  })
})

describe('Parsing', () => {
  it('should parse valid JSON', () => {
    const schema = defineSchema({
      title: text({ description: "Title" })
    })
    
    const result = schema.parse('{"title": "Hello"}')
    expect(result.title).toBe("Hello")
  })
  
  it('should handle validation errors', () => {
    const schema = defineSchema({
      count: number({ min: 0, max: 100 })
    })
    
    const result = schema.safeParse('{"count": 150}')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0].code).toBe('out_of_range')
    }
  })
})
```

### 11.6 Performance Considerations

**Optimization Strategies**:
1. **Lazy validation**: Only validate fields that are accessed
2. **Memoization**: Cache schema introspection results
3. **Streaming parsing**: For large JSON responses
4. **Virtual rendering**: For large arrays in React components
5. **Bundle splitting**: Separate core from React package

**Performance Targets**:
- Parse time: <10ms for typical responses (< 100KB)
- Validation time: <5ms for typical schemas
- Bundle size: Core <50KB gzipped, React <30KB gzipped
- Type inference: Instant (<1s in TypeScript)

### 11.7 Browser Compatibility

**Target Environments**:
- Modern browsers (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- Node.js 18+
- React Native (with appropriate polyfills)

**No Polyfills Needed**: Library uses only ES2020+ features available in all targets

### 11.8 Security Considerations

**Input Sanitization**:
- Markdown rendering should sanitize HTML by default
- Entity values should be escaped for XSS prevention
- JSON parsing should handle malformed input safely

**Best Practices**:
- Never execute code from LLM responses
- Validate all data before database operations
- Use Content Security Policy for markdown rendering
- Implement rate limiting for LLM API calls

---

## 12. Example Schemas

### 12.1 Meeting Notes (Complete Example)

See Section 3.1 for the complete `MeetingNotesSchema` definition.

### 12.2 Research Report

```typescript
const ResearchReportSchema = defineSchema({
  title: text({ 
    description: "Report title",
    maxLength: 200 
  }),
  
  abstract: md({
    description: "Executive summary of the research",
    maxLength: 1000
  }),
  
  authors: array({
    description: "Report authors",
    schema: {
      name: entity('person'),
      affiliation: text({ optional: true }),
      email: text({ optional: true })
    }
  }),
  
  findings: array({
    description: "Key research findings",
    schema: {
      finding: md({ description: "The finding statement" }),
      evidence: md({ description: "Supporting evidence" }),
      confidence: enumType(['high', 'medium', 'low']),
      sources: array({
        schema: {
          citation: text({ description: "Citation text" }),
          url: text({ optional: true })
        }
      })
    }
  }),
  
  recommendations: array({
    description: "Actionable recommendations",
    schema: {
      recommendation: md({ description: "What should be done" }),
      priority: enumType(['high', 'medium', 'low']),
      timeframe: text({ description: "When it should be done" })
    }
  }),
  
  methodology: md({
    description: "Research methodology used",
    optional: true
  }),
  
  limitations: md({
    description: "Study limitations and caveats",
    optional: true
  }),
  
  conclusion: md({
    description: "Final conclusions and next steps"
  })
})
```

### 12.3 Customer Feedback Analysis

```typescript
const CustomerFeedbackSchema = defineSchema({
  customerId: text({ description: "Customer identifier" }),
  
  feedbackDate: date({ description: "When feedback was provided" }),
  
  channel: enumType(['email', 'chat', 'phone', 'survey', 'social'], {
    description: "How feedback was received"
  }),
  
  sentiment: enumType(['positive', 'neutral', 'negative'], {
    description: "Overall sentiment"
  }),
  
  summary: md({
    description: "Brief summary of the feedback",
    maxLength: 500
  }),
  
  themes: array({
    description: "Key themes identified in the feedback",
    schema: {
      theme: text({ description: "Theme name" }),
      category: enumType(['product', 'service', 'pricing', 'support', 'other']),
      sentiment: enumType(['positive', 'neutral', 'negative']),
      quotes: array({
        schema: {
          quote: text({ description: "Direct customer quote" })
        }
      })
    }
  }),
  
  featureRequests: array({
    description: "Specific feature requests mentioned",
    schema: {
      feature: text({ description: "Feature name/description" }),
      priority: enumType(['high', 'medium', 'low']),
      context: md({ description: "Why customer wants this" })
    }
  }),
  
  painPoints: array({
    description: "Problems or frustrations mentioned",
    schema: {
      problem: text({ description: "Problem description" }),
      severity: enumType(['critical', 'major', 'minor']),
      impact: md({ description: "How it affects the customer" })
    }
  }),
  
  actionItems: array({
    description: "Follow-up actions needed",
    schema: {
      action: text({ description: "What needs to be done" }),
      assignee: entity('person', { optional: true }),
      dueDate: date({ optional: true })
    }
  })
})
```

### 12.4 Sales Call Analysis

```typescript
const SalesCallSchema = defineSchema({
  callDate: date({ description: "When the call took place" }),
  
  duration: number({ 
    description: "Call duration in minutes",
    min: 0
  }),
  
  participants: array({
    description: "People on the call",
    schema: {
      name: entity('person'),
      company: entity('company'),
      role: text({ description: "Their job title" }),
      type: enumType(['prospect', 'customer', 'internal'])
    }
  }),
  
  callType: enumType(['discovery', 'demo', 'negotiation', 'close', 'follow-up'], {
    description: "Type of sales call"
  }),
  
  summary: md({
    description: "Overall call summary",
    maxLength: 1000
  }),
  
  keyTopics: array({
    description: "Main topics discussed",
    schema: {
      topic: text({ description: "Topic name" }),
      discussion: md({ description: "What was discussed" })
    }
  }),
  
  needs: array({
    description: "Customer needs identified",
    schema: {
      need: text({ description: "Specific need" }),
      priority: enumType(['high', 'medium', 'low']),
      notes: md({ optional: true })
    }
  }),
  
  objections: array({
    description: "Objections raised and how they were handled",
    schema: {
      objection: text({ description: "The objection" }),
      response: md({ description: "How it was addressed" }),
      resolved: boolean({ description: "Was it resolved?" })
    }
  }),
  
  nextSteps: array({
    description: "Agreed next steps",
    schema: {
      step: text({ description: "What happens next" }),
      owner: entity('person'),
      dueDate: date({ optional: true })
    }
  }),
  
  dealStage: enumType([
    'discovery',
    'qualification',
    'proposal',
    'negotiation',
    'closed-won',
    'closed-lost'
  ], {
    description: "Current deal stage"
  }),
  
  winProbability: number({
    description: "Estimated probability of winning (0-100)",
    min: 0,
    max: 100,
    optional: true
  }),
  
  competitorsMentioned: array({
    description: "Competitors discussed",
    schema: {
      competitor: entity('company'),
      context: md({ description: "What was said about them" })
    }
  })
})
```

---

## 13. Future Enhancements

### 13.1 Phase 2 Features (Post-MVP)

**Database Integration** (As discussed earlier):
- PostgreSQL schema generation
- ORM integration (Drizzle, Prisma)
- Migration management
- Query builder

**Advanced Validation**:
- Custom validation functions
- Async validators
- Cross-field validation
- Conditional validation

**Schema Versioning**:
- Schema migration tools
- Backward compatibility
- Version negotiation

**Performance**:
- Streaming parser for large responses
- Worker thread support
- Caching layer

### 13.2 Phase 3 Features (Future)

**AI Enhancements**:
- Schema suggestion from examples
- Auto-repair improvements via ML
- Semantic search across fields
- Smart field extraction

**Additional Integrations**:
- LangChain integration
- More LLM providers
- Vector database support
- Graph database support

**Developer Tools**:
- VS Code extension
- Schema visualizer
- Interactive playground
- CLI tools

---

## 14. Success Metrics

### 14.1 Technical Metrics

- **Adoption**: 1000+ weekly NPM downloads within 6 months
- **Performance**: <10ms parse time for typical responses
- **Reliability**: >99% successful parse rate
- **Bundle Size**: Core <50KB gzipped
- **Test Coverage**: >80% code coverage

### 14.2 Developer Experience Metrics

- **Time to First Schema**: <15 minutes from install to working schema
- **Documentation Quality**: <5% of issues are documentation-related
- **API Satisfaction**: 4.5+ stars on NPM
- **Integration Ease**: Works with popular frameworks without adapters

---

## 15. Open Questions & Decisions Needed

### 15.1 Technical Decisions

1. **Should we support Zod compatibility?**
   - Pro: Leverage existing ecosystem
   - Con: Additional complexity, larger bundle
   - **Decision**: Start independent, consider adapter later

2. **Should markdown fields support custom elements?**
   - Pro: More flexibility (e.g., tables, diagrams)
   - Con: More complex rendering
   - **Decision**: Start with standard markdown, add extensibility

3. **How to handle schema evolution in production?**
   - Add version field to schema
   - Implement migration helpers
   - Document best practices

### 15.2 Design Decisions

1. **Default strict vs. lenient parsing?**
   - **Recommendation**: Lenient by default (allow unknown fields)
   - Rationale: LLMs often add helpful context

2. **React components: styled or headless?**
   - **Recommendation**: Headless with example styled components
   - Rationale: Maximum flexibility for users

3. **Entity linking: built-in or user-provided?**
   - **Recommendation**: User-provided resolvers
   - Rationale: App-specific logic

---

## 16. Getting Started (For Implementers)

### 16.1 Reserve the Name

**First priority** - claim the name before starting implementation:

```bash
# 1. Check availability
npm view llm-schema
# Should return: npm ERR! code E404

# 2. Create minimal package.json
{
  "name": "llm-schema",
  "version": "0.0.1",
  "description": "The ORM for LLM content - Schema-driven TypeScript library for structured AI responses",
  "keywords": ["llm", "schema", "openai", "anthropic", "typescript", "ai", "orm"],
  "author": "Your Name <your.email@example.com>",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/llm-schema"
  }
}

# 3. Publish placeholder to claim the name
npm publish

# 4. Buy domain
# Go to Namecheap/Google Domains and buy: llmschema.dev

# 5. Create GitHub repo
# github.com/yourusername/llm-schema
```

### 16.1 Project Setup

```bash
# Create monorepo
mkdir llm-schema
cd llm-schema
npm init -y

# Setup pnpm workspaces
pnpm init

# Create packages
mkdir -p packages/llm-schema packages/llm-schema-react

# Install dependencies
pnpm add -D typescript vitest tsup @changesets/cli

# Setup TypeScript
npx tsc --init
```

### 16.2 First Implementation Task

Start with the most basic schema definition:

```typescript
// packages/llm-schema/src/schema/builder.ts

export function defineSchema(definition: any) {
  return {
    definition,
    parse: (input: string) => {
      // TODO: Implement
      return JSON.parse(input)
    }
  }
}

// packages/llm-schema/src/schema/fields.ts

export function text(options: any) {
  return {
    type: 'text',
    ...options
  }
}

export function md(options: any) {
  return {
    type: 'markdown',
    ...options
  }
}
```

### 16.3 Testing Your First Schema

```typescript
// test/basic.test.ts

import { defineSchema, text, md } from 'llm-schema'

const schema = defineSchema({
  title: text({ description: "The title" }),
  content: md({ description: "The content" })
})

const result = schema.parse(`{
  "title": "Hello World",
  "content": "This is **markdown** content"
}`)

console.log(result)
// { title: "Hello World", content: "This is **markdown** content" }
```

---

## 17. Conclusion

This design document provides a comprehensive blueprint for building **llm-schema**, a structured LLM content library that solves a fundamental problem in AI-native applications.

### The Vision: The ORM for LLM

Just as **ORMs revolutionized database development** by providing a type-safe, schema-driven layer between applications and databases, **llm-schema** does the same for LLM integration. It transforms LLM development from ad-hoc parsing and manual validation to a structured, maintainable, type-safe workflow.

### Official Branding

```
Package:     llm-schema
Domain:      llmschema.dev
GitHub:      github.com/[username]/llm-schema
Tagline:     "The ORM for LLM content"
NPM:         npm install llm-schema
```

### What llm-schema Enables

Developers can:

1. **Define schemas once** and use them throughout the application lifecycle (like Prisma schema)
2. **Generate LLM prompts** automatically from schemas (like SQL migrations)
3. **Parse and validate** LLM responses with strong typing (like query results)
4. **Render and edit** content with React components (like form libraries)
5. **Transform and extract** data for various use cases (like query builders)

### The Impact

**Before llm-schema** (manual approach):
```typescript
// Write custom prompts
const prompt = "Please return JSON with title, summary, and action items..."

// Manual parsing
const data = JSON.parse(llmResponse)

// Manual validation
if (!data.title || typeof data.title !== 'string') {
  throw new Error('Invalid title')
}

// Manual type assertions
const notes = data as MeetingNotes  // Hope for the best!

// Manual rendering
<div>{notes.summary}</div>
```

**With llm-schema** (ORM approach):
```typescript
// Schema definition (once)
const schema = defineSchema({ 
  title: text(...), 
  summary: md(...),  // Markdown = easy display!
  ... 
})

// Auto-generated prompt
const prompt = schema.toPrompt()

// Type-safe parsing with validation
const notes = schema.parse(llmResponse)  // Fully typed, validated!

// Automatic rendering - THIS IS THE MAGIC! ✨
<SchemaRenderer schema={schema} data={notes} />
// Markdown renders beautifully with ZERO extra work!
// No manual HTML, no custom formatters, just works!
```

**The killer feature**: Markdown fields give you both structure AND beautiful display for free. This is why llm-schema exists.

### Market Position

llm-schema occupies a unique position in the AI development stack:

- **Not just a validator** (like Zod) - it's LLM-first
- **Not just a UI library** (like form builders) - it covers the full lifecycle  
- **Not just a prompt framework** (like LangChain) - it enforces structure
- **It's an ORM for LLM content** - the missing layer in AI-native apps

The phased implementation approach ensures steady progress with deliverable milestones, while the modular architecture allows for future enhancements without breaking changes.

### Next Steps

1. ✅ **Claim the name**: Reserve `llm-schema` on NPM
2. ✅ **Buy domain**: Secure `llmschema.dev`
3. ✅ **Create repo**: Set up GitHub repository
4. 🚀 **Begin Phase 1**: Core Schema System implementation
5. 📚 **Build examples**: Create compelling use cases
6. 🌟 **Launch**: Open source and promote to community

### Target Impact

Become the **de facto standard** for structured LLM content, just as Prisma/Drizzle became standards for database access.

**Success Metrics:**
- Year 1: 1,000+ weekly NPM downloads, 500+ GitHub stars
- Year 2: 10,000+ weekly downloads, featured in AI tutorials
- Long-term: The library developers reach for when building AI-native apps

---

## Appendix A: Quick Start Guide

```bash
# Install
npm install llm-schema

# Create your first schema
import { defineSchema, md, array } from 'llm-schema'

const schema = defineSchema({
  summary: md({ description: "Meeting summary" }),
  actionItems: array({ schema: { ... } })
})

# Use with OpenAI
const prompt = schema.toPrompt()
const response = await openai.chat.completions.create({...})
const data = schema.parse(response.choices[0].message.content)

# Render in React
<SchemaRenderer schema={schema} data={data} />
```

---

**llm-schema** - The ORM for LLM content. Define once, use everywhere.

---

## Appendix A: Related Technologies

- **Zod**: TypeScript-first schema validation
- **JSON Schema**: Standard JSON schema specification
- **Ajv**: JSON schema validator
- **React Hook Form**: Form state management
- **TipTap**: Rich text editor framework
- **Remark/Rehype**: Markdown processing

## Appendix B: Glossary

- **Schema**: Definition of data structure and validation rules
- **Field**: Single piece of data with a specific type
- **Entity**: Named thing that can be linked (person, company, etc.)
- **Markdown (md)**: Lightweight markup language for formatted text
- **Enum**: Field with a fixed set of possible values
- **Validation**: Checking data against schema rules
- **Parsing**: Converting text to structured data
- **Type Inference**: Automatic TypeScript type generation from schema

## Appendix C: Version History

- **v0.1** (2025-10-26): Initial design document
