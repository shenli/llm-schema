import {
  type AnthropicToolOptions,
  type ArrayFieldDefinition,
  type ArrayFieldOptions,
  type JsonSchema,
  type ObjectFieldDefinition,
  type OpenAIToolOptions,
  type SchemaDefinition,
  type SchemaOptions
} from './types';

function applyDescription(schema: JsonSchema, description?: string): JsonSchema {
  if (description) {
    schema.description = description;
  }
  return schema;
}

function fieldToJsonSchema(field: SchemaDefinition[string]): JsonSchema {
  switch (field.kind) {
    case 'text':
      return applyDescription(
        {
          type: 'string',
          minLength: field.options.minLength,
          maxLength: field.options.maxLength,
          pattern: field.options.pattern?.source
        },
        field.description
      );

    case 'markdown':
      return applyDescription(
        {
          type: 'string',
          maxLength: field.options.maxLength,
          format: 'markdown'
        },
        field.description ?? 'Markdown content'
      );

    case 'number':
      return applyDescription(
        {
          type: 'number',
          minimum: field.options.min,
          maximum: field.options.max
        },
        field.description
      );

    case 'boolean':
      return applyDescription(
        {
          type: 'boolean'
        },
        field.description
      );

    case 'date':
      return applyDescription(
        {
          type: 'string',
          format: field.options.format === 'date' ? 'date' : 'date-time'
        },
        field.description
      );

    case 'enum':
      return applyDescription(
        {
          type: 'string',
          enum: [...field.values]
        },
        field.description ?? `One of: ${field.values.join(', ')}`
      );

    case 'entity':
      return applyDescription(
        {
          type: 'string'
        },
        field.description ?? `Entity reference (${field.entityType})`
      );

    case 'array': {
      const typedField = field as ArrayFieldDefinition<any, any>;
      const itemSchema = definitionToJsonSchema(typedField.itemDefinition, { strict: true });
      const arrayOptions = field.options as ArrayFieldOptions;
      return applyDescription(
        {
          type: 'array',
          items: itemSchema,
          minItems: arrayOptions.minItems,
          maxItems: arrayOptions.maxItems
        },
        field.description
      );
    }

    case 'object': {
      const typedField = field as ObjectFieldDefinition<any, any>;
      return applyDescription(definitionToJsonSchema(typedField.shape, { strict: true }), field.description);
    }

    default:
      return { type: 'string' };
  }
}

export interface DefinitionToJsonOptions {
  description?: string;
  strict?: boolean;
}

export function definitionToJsonSchema(
  definition: SchemaDefinition,
  options: DefinitionToJsonOptions = {}
): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(definition)) {
    properties[key] = fieldToJsonSchema(field);
    if (!field.optional) {
      required.push(key);
    }
  }

  const schema: JsonSchema = {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined
  };

  if (options.description) {
    schema.description = options.description;
  }

  if (options.strict) {
    schema.additionalProperties = false;
  }

  return schema;
}

export function toOpenAIToolSchema(
  definition: SchemaDefinition,
  schemaOptions: Required<SchemaOptions>,
  options: OpenAIToolOptions = {}
) {
  const parameters = definitionToJsonSchema(definition, {
    description: schemaOptions.description,
    strict: schemaOptions.strict
  });

  return {
    type: 'function',
    function: {
      name: options.name ?? schemaOptions.name ?? 'schema_function',
      description: options.description ?? schemaOptions.description ?? 'Generated tool schema',
      parameters
    }
  } as const;
}

export function toAnthropicToolSchema(
  definition: SchemaDefinition,
  schemaOptions: Required<SchemaOptions>,
  options: AnthropicToolOptions = {}
) {
  return {
    name: options.name ?? schemaOptions.name ?? 'schema_tool',
    description: options.description ?? schemaOptions.description ?? 'Generated tool schema',
    input_schema: definitionToJsonSchema(definition, {
      description: schemaOptions.description,
      strict: schemaOptions.strict
    })
  };
}
