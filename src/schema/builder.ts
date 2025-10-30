import {
  type AnthropicToolOptions,
  type JsonSchema,
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
import {
  isArrayField,
  isBooleanField,
  isDateField,
  isEntityField,
  isEnumField,
  isMarkdownField,
  isNumberField,
  isObjectField,
  isTextField
} from './typeGuards';

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

function getRequiredFields(definition: SchemaDefinition): string[] {
  return Object.entries(definition)
    .filter(([, field]) => !field.optional)
    .map(([key]) => key);
}

function buildFieldComment(field: SchemaDefinition[string], mode: 'json' | 'typescript'): string {
  const segments: string[] = [];

  if (mode === 'json' && field.optional) {
    segments.push('optional');
  }

  if (field.description) {
    const desc = field.description.endsWith('.') ? field.description : `${field.description}`;
    segments.push(desc);
  }

  const note = (field as { options?: { note?: string } }).options?.note;
  const noteText = note?.toLowerCase() ?? '';
  if (note) {
    segments.push(note);
  }

  if (isEnumField(field)) {
    // Union type already communicates allowed values; no need to repeat.
  }

  if (isNumberField(field) && !/range|min|max/.test(noteText)) {
    const range: string[] = [];
    if (field.options.min !== undefined) range.push(`min ${field.options.min}`);
    if (field.options.max !== undefined) range.push(`max ${field.options.max}`);
    if (range.length > 0) {
      segments.push(`range ${range.join(', ')}`);
    }
  }

  if (isArrayField(field) && !/min|max/.test(noteText)) {
    const constraints: string[] = [];
    if (field.options.minItems !== undefined) constraints.push(`min ${field.options.minItems} item${field.options.minItems === 1 ? '' : 's'}`);
    if (field.options.maxItems !== undefined) constraints.push(`max ${field.options.maxItems} items`);
    if (constraints.length > 0) {
      segments.push(constraints.join(', '));
    }
  }

  if ((isMarkdownField(field) || isTextField(field)) && !/max\s+\d+/.test(noteText)) {
    const lengths: string[] = [];
    if ('minLength' in field.options && field.options.minLength !== undefined) {
      lengths.push(`min ${field.options.minLength} chars`);
    }
    if (field.options.maxLength !== undefined) {
      lengths.push(`max ${field.options.maxLength} chars`);
    }
    if (lengths.length > 0) {
      segments.push(lengths.join(', '));
    }
  }

  const uniqueSegments = segments.filter(Boolean).reduce<string[]>((acc, segment) => {
    if (!acc.includes(segment)) acc.push(segment);
    return acc;
  }, []);

  return uniqueSegments.join(', ').trim();
}

function renderTypeScriptValueLines(field: SchemaDefinition[string], indent: number): string[] {
  const indentSpace = ' '.repeat(indent);

  if (isTextField(field) || isMarkdownField(field) || isEntityField(field)) {
    return ['string'];
  }

  if (isNumberField(field)) {
    return ['number'];
  }

  if (isBooleanField(field)) {
    return ['boolean'];
  }

  if (isDateField(field)) {
    return ['string'];
  }

  if (isEnumField(field)) {
    return [field.values.map((value) => `"${value}"`).join(' | ')];
  }

  if (isArrayField(field)) {
    const lines = ['['];
    const itemLines = renderTypeScriptObjectLines(field.itemDefinition, indent + 2);
    lines.push(...itemLines);
    lines.push(`${indentSpace}]`);
    return lines;
  }

  if (isObjectField(field)) {
    return renderTypeScriptObjectLines(field.shape, indent);
  }

  return ['null'];
}

function renderTypeScriptEntryLines(
  key: string,
  field: SchemaDefinition[string],
  indent: number,
  isLast: boolean
): string[] {
  const indentSpace = ' '.repeat(indent);
  const optionalMark = field.optional ? '?' : '';
  const valueLines = renderTypeScriptValueLines(field, indent + 2);
  const comment = buildFieldComment(field, 'typescript');

  if (valueLines.length === 1) {
    const baseLine = `${indentSpace}"${key}"${optionalMark}: ${valueLines[0]}${isLast ? '' : ','}`;
    return comment ? [`${baseLine} // ${comment}`] : [baseLine];
  }

  const [firstLine, ...rest] = valueLines;
  const lines: string[] = [`${indentSpace}"${key}"${optionalMark}: ${firstLine}`];

  if (rest.length > 0) {
    const middle = rest.slice(0, -1);
    middle.forEach((line) => lines.push(line));

    const lastValueLine = rest[rest.length - 1];
    if (comment) {
      lines[0] = `${lines[0]} // ${comment}`;
      lines.push(`${lastValueLine}${isLast ? '' : ','}`);
    } else {
      lines.push(`${lastValueLine}${isLast ? '' : ','}`);
    }
    return lines;
  }

  if (comment) {
    lines[0] = `${lines[0]} // ${comment}`;
  }

  return lines;
}

function renderTypeScriptObjectLines(definition: SchemaDefinition, indent: number): string[] {
  const indentSpace = ' '.repeat(indent);
  const entries = Object.entries(definition) as Array<[
    string,
    SchemaDefinition[string]
  ]>;

  if (entries.length === 0) {
    return [`${indentSpace}{}`,];
  }

  const lines: string[] = [`${indentSpace}{`];

  entries.forEach(([key, field], index) => {
    const entryLines = renderTypeScriptEntryLines(key, field, indent + 2, index === entries.length - 1);
    lines.push(...entryLines);
  });

  lines.push(`${indentSpace}}`);
  return lines;
}

function renderTypeScriptStructure(definition: SchemaDefinition): string {
  return renderTypeScriptObjectLines(definition, 0).join('\n');
}

function renderJsonValueLines(field: SchemaDefinition[string], indent: number): string[] {
  const indentSpace = ' '.repeat(indent);

  if (isTextField(field) || isMarkdownField(field) || isEntityField(field)) {
    return [`${indentSpace}"<string>"`];
  }

  if (isNumberField(field)) {
    return [`${indentSpace}0`];
  }

  if (isBooleanField(field)) {
    return [`${indentSpace}true`];
  }

  if (isDateField(field)) {
    const placeholder = field.options.format === 'date' ? '<YYYY-MM-DD>' : '<ISO-8601 date-time>';
    return [`${indentSpace}"${placeholder}"`];
  }

  if (isEnumField(field)) {
    return [`${indentSpace}"<${field.values.join(' | ')}>"`];
  }

  if (isArrayField(field)) {
    const lines = [`${indentSpace}[`];
    const itemLines = renderJsonObjectLines(field.itemDefinition, indent + 2);
    lines.push(...itemLines);
    lines.push(`${indentSpace}]`);
    return lines;
  }

  if (isObjectField(field)) {
    return renderJsonObjectLines(field.shape, indent);
  }

  return [`${indentSpace}null`];
}

function renderJsonEntryLines(
  key: string,
  field: SchemaDefinition[string],
  indent: number,
  isLast: boolean
): string[] {
  const indentSpace = ' '.repeat(indent);
  const valueLines = renderJsonValueLines(field, indent + 2);
  const comment = buildFieldComment(field, 'json');

  if (valueLines.length === 1) {
    const baseLine = `${indentSpace}"${key}": ${valueLines[0].trim()}${isLast ? '' : ','}`;
    return comment ? [`${baseLine} // ${comment}`] : [baseLine];
  }

  const [firstLine, ...rest] = valueLines;
  const lines: string[] = [`${indentSpace}"${key}": ${firstLine.trimStart()}`];

  if (rest.length > 0) {
    const middle = rest.slice(0, -1);
    middle.forEach((line) => lines.push(line));
    const lastValueLine = rest[rest.length - 1];
    lines.push(`${lastValueLine}${isLast ? '' : ','}${comment ? ` // ${comment}` : ''}`);
  }

  return lines;
}

function renderJsonObjectLines(definition: SchemaDefinition, indent: number): string[] {
  const indentSpace = ' '.repeat(indent);
  const entries = Object.entries(definition) as Array<[
    string,
    SchemaDefinition[string]
  ]>;

  if (entries.length === 0) {
    return [`${indentSpace}{}`];
  }

  const lines: string[] = [`${indentSpace}{`];

  entries.forEach(([key, field], index) => {
    const entryLines = renderJsonEntryLines(key, field, indent + 2, index === entries.length - 1);
    lines.push(...entryLines);
  });

  lines.push(`${indentSpace}}`);
  return lines;
}

function renderJsonStructure(definition: SchemaDefinition): string {
  return renderJsonObjectLines(definition, 0).join('\n');
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
      const structureStyle = promptOptions.structure ?? 'typescript';
      const header =
        structureStyle === 'json'
          ? 'Return a JSON object matching this structure:'
          : 'Respond with JSON matching this schema:';
      const description = normalized.description ? `\n\n${normalized.description}` : '';
      const body =
        structureStyle === 'json'
          ? renderJsonStructure(definition)
          : renderTypeScriptStructure(definition);
      const requiredFields = getRequiredFields(definition);

      const sections: string[] = [`${header}${description}\n\n${body}`];

      if (requiredFields.length > 0) {
        sections.push(`\n\nRequired fields: ${requiredFields.join(', ')}`);
      }

      if (normalized.examples.length > 0 && promptOptions.includeExamples) {
        sections.push(`\n\nExample:\n${JSON.stringify(normalized.examples[0], null, 2)}`);
      }

      return sections.join('');
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
