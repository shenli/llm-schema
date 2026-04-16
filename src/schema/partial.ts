import type {
  AnyFieldDefinition,
  ParseIssue,
  SchemaDefinition,
  SchemaValidationResult
} from './types';
import { isArrayField, isObjectField } from './typeGuards';
import { appendPath, issue } from './utils';

export interface PartialParseOptions {
  strict?: boolean;
}

function ensureObject(value: unknown, path: string[]): { ok: true; record: Record<string, unknown> } | { ok: false; issues: ParseIssue[] } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {
      ok: false,
      issues: [issue(path, 'Expected object value', 'invalid_type', 'object', value)]
    };
  }
  return { ok: true, record: value as Record<string, unknown> };
}

export function parsePartialDefinition(
  definition: SchemaDefinition,
  value: unknown,
  path: string[],
  options: PartialParseOptions = {}
): SchemaValidationResult<Record<string, unknown>> {
  const ensured = ensureObject(value, path);
  if (!ensured.ok) {
    return { success: false, issues: ensured.issues };
  }
  const record = ensured.record;
  const out: Record<string, unknown> = {};
  const issues: ParseIssue[] = [];

  for (const key of Object.keys(definition)) {
    const field = definition[key] as AnyFieldDefinition;
    const raw = record[key];
    const fieldPath = appendPath(path, key);

    if (raw === undefined || raw === null) {
      continue;
    }

    if (isArrayField(field)) {
      if (!Array.isArray(raw)) {
        issues.push(issue(fieldPath, 'Expected array value', 'invalid_type', 'array', typeof raw));
        continue;
      }
      const arr: unknown[] = [];
      raw.forEach((item, index) => {
        const itemPath = appendPath(fieldPath, index);
        const itemResult = parsePartialDefinition(field.itemDefinition, item, itemPath, options);
        if (itemResult.success) {
          arr.push(itemResult.data);
        } else {
          arr.push(item);
          issues.push(...itemResult.issues);
        }
      });
      out[key] = arr;
      continue;
    }

    if (isObjectField(field)) {
      const nested = parsePartialDefinition(field.shape, raw, fieldPath, options);
      if (nested.success) {
        out[key] = nested.data;
      } else {
        out[key] = raw;
        issues.push(...nested.issues);
      }
      continue;
    }

    const result = field.parse(raw, { path: fieldPath });
    if (result.success) {
      out[key] = result.value;
    } else {
      out[key] = raw;
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
  return { success: true, data: out };
}
