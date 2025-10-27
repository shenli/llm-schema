import type {
  AnyFieldDefinition,
  ParseContext,
  ParseIssue,
  SchemaDefinition,
  SchemaOptions,
  SchemaOutput,
  SchemaValidationResult
} from './types';
import { issue, appendPath } from './utils';

export interface ParseDefinitionOptions {
  strict?: boolean;
}

function ensureObject(value: unknown, path: string[]): { success: true; value: Record<string, unknown> } | {
  success: false;
  issues: ParseIssue[];
} {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      success: false,
      issues: [issue(path, 'Expected object value', 'invalid_type', 'object', value)]
    };
  }
  return { success: true, value: value as Record<string, unknown> };
}

export function parseDefinition<Definition extends SchemaDefinition>(
  definition: Definition,
  value: unknown,
  path: string[],
  options: ParseDefinitionOptions = {}
): SchemaValidationResult<SchemaOutput<Definition>> {
  const ensured = ensureObject(value, path);
  if (!ensured.success) {
    return ensured;
  }

  const { value: record } = ensured;
  const result: Record<string, unknown> = {};
  const issues: ParseIssue[] = [];

  for (const key of Object.keys(definition)) {
    const field = definition[key];
    const fieldPath = appendPath(path, key);
    const raw = record[key];

    if (raw === undefined || raw === null) {
      if (field.optional) {
        if (field.hasDefault && field.defaultValue) {
          result[key] = field.defaultValue();
        }
        continue;
      }

      issues.push(issue(fieldPath, 'Field is required', 'required'));
      continue;
    }

    const parseResult = (field as AnyFieldDefinition).parse(raw, { path: fieldPath });
    if (parseResult.success) {
      result[key] = parseResult.value;
    } else {
      issues.push(...parseResult.issues);
    }
  }

  if (options.strict) {
    for (const key of Object.keys(record)) {
      if (!(key in definition)) {
        issues.push(issue(appendPath(path, key), 'Unexpected field', 'invalid_type'));
      }
    }
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return { success: true, data: result as SchemaOutput<Definition> };
}

export function parseRoot<Definition extends SchemaDefinition>(
  definition: Definition,
  value: unknown,
  options: SchemaOptions
): SchemaValidationResult<SchemaOutput<Definition>> {
  return parseDefinition(definition, value, [], { strict: options.strict });
}
