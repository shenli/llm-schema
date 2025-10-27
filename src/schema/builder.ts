import {
  type ArrayFieldDefinition,
  type AnthropicToolOptions,
  type JsonSchema,
  type ObjectFieldDefinition,
  type OpenAIToolOptions,
  type SchemaDefinition,
  type SchemaOptions,
  type SchemaOutput,
  type SchemaPromptOptions,
  type SchemaValidationResult,
  SchemaError
} from './types';
import { parseRoot } from './validation';
import { definitionToJsonSchema, toAnthropicToolSchema, toOpenAIToolSchema } from './exporters';
import {
  diffSchemaData,
  mergeSchemaData,
  searchSchemaData,
  extractEntities,
  collectMarkdownFields,
  type DiffResult,
  type MergeOptions,
  type SearchOptions,
  type SearchResult,
  type EntityRecord,
  type MarkdownFieldRecord
} from './transform';

export interface Schema<Definition extends SchemaDefinition> {
  readonly definition: Definition;
  readonly options: Required<SchemaOptions>;

  parse(input: unknown): SchemaOutput<Definition>;
  safeParse(input: unknown): SchemaValidationResult<SchemaOutput<Definition>>;
  validate(input: unknown): SchemaValidationResult<SchemaOutput<Definition>>;
  toPrompt(options?: SchemaPromptOptions): string;
  toJsonSchema(): JsonSchema;
  toOpenAITool(options?: OpenAIToolOptions): ReturnType<typeof toOpenAIToolSchema>;
  toAnthropicTool(options?: AnthropicToolOptions): ReturnType<typeof toAnthropicToolSchema>;
  diff(previous: SchemaOutput<Definition>, next: SchemaOutput<Definition>): DiffResult;
  merge(
    base: SchemaOutput<Definition>,
    updates: Partial<SchemaOutput<Definition>>,
    options?: MergeOptions
  ): SchemaOutput<Definition>;
  search(data: SchemaOutput<Definition>, query: string, options?: SearchOptions): SearchResult[];
  getEntities(data: SchemaOutput<Definition>, type?: string): EntityRecord[];
  getMarkdownFields(data: SchemaOutput<Definition>): MarkdownFieldRecord[];
  getDefinition(): Definition;
}

type SchemaConfig = SchemaOptions;

function normalizeOptions(options?: SchemaOptions): Required<SchemaOptions> {
  return {
    name: options?.name ?? 'Schema',
    description: options?.description ?? '',
    version: options?.version ?? '1.0.0',
    strict: options?.strict ?? false,
    examples: options?.examples ?? []
  };
}

function renderFieldPrompt(
  fieldName: string,
  definition: SchemaDefinition[string],
  options: SchemaPromptOptions,
  indent = 2
): string {
  const indentSpace = ' '.repeat(indent);
  let line = `${indentSpace}- ${definition.toPrompt(fieldName, options)}`;

  if (definition.kind === 'array') {
    const nested = (definition as ArrayFieldDefinition<any, any>).itemDefinition;
    const inner = (Object.entries(nested) as Array<[string, SchemaDefinition[string]]>)
      .map(([childName, childField]) => renderFieldPrompt(childName, childField as SchemaDefinition[string], options, indent + 2))
      .join('\n');
    line += `\n${indentSpace}  Items:\n${inner}`;
  }

  if (definition.kind === 'object') {
    const nested = (definition as ObjectFieldDefinition<any, any>).shape;
    const inner = (Object.entries(nested) as Array<[string, SchemaDefinition[string]]>)
      .map(([childName, childField]) => renderFieldPrompt(childName, childField as SchemaDefinition[string], options, indent + 2))
      .join('\n');
    line += `\n${indentSpace}  Fields:\n${inner}`;
  }

  return line;
}

function normalizeInput(input: unknown): SchemaValidationResult<Record<string, unknown>> {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      return { success: true, data: parsed };
    } catch (error) {
      return {
        success: false,
        issues: [
          {
            path: [],
            message: `Failed to parse JSON input: ${(error as Error).message}`,
            code: 'invalid_format',
            expected: 'json_object',
            received: input
          }
        ]
      };
    }
  }

  if (typeof input !== 'object' || input === null) {
    return {
      success: false,
      issues: [
        {
          path: [],
          message: 'Expected object input',
          code: 'invalid_type',
          expected: 'object',
          received: input
        }
      ]
    };
  }

  return { success: true, data: input as Record<string, unknown> };
}

export function defineSchema<const Definition extends SchemaDefinition>(
  definition: Definition,
  options?: SchemaConfig
): Schema<Definition> {
  const normalized = normalizeOptions(options);

  const schema: Schema<Definition> = {
    definition,
    options: normalized,

    parse(input: unknown) {
      const result = this.safeParse(input);
      if (!result.success) {
        throw new SchemaError('Failed to parse schema data', result.issues);
      }
      return result.data;
    },

    safeParse(input: unknown) {
      const normalizedInput = normalizeInput(input);
      if (!normalizedInput.success) {
        return normalizedInput as SchemaValidationResult<SchemaOutput<Definition>>;
      }

      return parseRoot(definition, normalizedInput.data, normalized);
    },

    validate(input: unknown) {
      return this.safeParse(input);
    },

    toPrompt(promptOptions: SchemaPromptOptions = {}) {
      const header =
        promptOptions.format === 'compact'
          ? `Return JSON that follows the "${normalized.name}" schema.`
          : `Please respond with JSON that matches the "${normalized.name}" schema.`;

      const description = normalized.description ? `\n${normalized.description}` : '';

      const fieldDescriptions = Object.entries(definition)
        .map(([name, field]) => renderFieldPrompt(name, field, promptOptions))
        .join('\n');

      const examplesText =
        normalized.examples.length > 0 && promptOptions.includeExamples
          ? `\n\nExample:\n${JSON.stringify(normalized.examples[0], null, 2)}`
          : '';

      return `${header}${description}\n\nFields:\n${fieldDescriptions}${examplesText}`;
    },

    toJsonSchema() {
      return definitionToJsonSchema(definition, {
        description: normalized.description,
        strict: normalized.strict
      });
    },

    toOpenAITool(toolOptions?: OpenAIToolOptions) {
      return toOpenAIToolSchema(definition, normalized, toolOptions ?? {});
    },

    toAnthropicTool(toolOptions?: AnthropicToolOptions) {
      return toAnthropicToolSchema(definition, normalized, toolOptions ?? {});
    },

    diff(previous, next) {
      return diffSchemaData(this, previous, next);
    },

    merge(base, updates, mergeOptions) {
      return mergeSchemaData(this, base, updates, mergeOptions);
    },

    search(data, query, searchOptions) {
      return searchSchemaData(this, data, query, searchOptions);
    },

    getEntities(data, type) {
      return extractEntities(this, data, type);
    },

    getMarkdownFields(data) {
      return collectMarkdownFields(this, data);
    },

    getDefinition() {
      return definition;
    }
  };

  return schema;
}

export type InferSchema<S extends Schema<any>> = S extends Schema<infer Definition>
  ? SchemaOutput<Definition>
  : never;
