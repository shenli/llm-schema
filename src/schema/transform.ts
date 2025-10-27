import type { Schema } from './builder';
import type { MarkdownFieldDefinition, SchemaDefinition, SchemaOutput, SchemaValidationResult } from './types';
import {
  isArrayField,
  isEntityField,
  isMarkdownField,
  isObjectField,
  isTextField,
  isEnumField
} from './typeGuards';

export interface DiffChange<T = unknown> {
  path: string;
  before?: T;
  after?: T;
}

export interface DiffResult<T = unknown> {
  added: DiffChange<T>[];
  removed: DiffChange<T>[];
  changed: DiffChange<T>[];
}

function joinPath(parent: string, key: string | number) {
  return parent ? `${parent}.${key}` : String(key);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }

  const aEntries = Object.entries(a as Record<string, unknown>);
  const bEntries = Object.entries(b as Record<string, unknown>);

  if (aEntries.length !== bEntries.length) return false;

  return aEntries.every(([key, value]) => deepEqual(value, (b as Record<string, unknown>)[key]));
}

export function diffSchemaData<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  previous: SchemaOutput<Definition>,
  next: SchemaOutput<Definition>
): DiffResult {
  const definition = schema.getDefinition();
  const added: DiffChange[] = [];
  const removed: DiffChange[] = [];
  const changed: DiffChange[] = [];

  function walk(
    fieldDef: SchemaDefinition[string],
    prevValue: unknown,
    nextValue: unknown,
    path: string
  ) {
    if (prevValue === undefined && nextValue === undefined) {
      return;
    }

    if (prevValue === undefined && nextValue !== undefined) {
      added.push({ path, after: nextValue });
      return;
    }

    if (prevValue !== undefined && nextValue === undefined) {
      removed.push({ path, before: prevValue });
      return;
    }

    if (isArrayField(fieldDef)) {
      const prevArray = Array.isArray(prevValue) ? prevValue : [];
      const nextArray = Array.isArray(nextValue) ? nextValue : [];
      const maxLength = Math.max(prevArray.length, nextArray.length);

      for (let index = 0; index < maxLength; index += 1) {
        const prevItem = prevArray[index];
        const nextItem = nextArray[index];
        const itemPath = joinPath(path, index);

        if (prevItem === undefined && nextItem !== undefined) {
          added.push({ path: itemPath, after: nextItem });
        } else if (prevItem !== undefined && nextItem === undefined) {
          removed.push({ path: itemPath, before: prevItem });
        } else if (!deepEqual(prevItem, nextItem)) {
          changed.push({ path: itemPath, before: prevItem, after: nextItem });
        }
      }
      return;
    }

    if (isObjectField(fieldDef) && prevValue && nextValue) {
      const nestedDefinition = fieldDef.shape;
      for (const key of Object.keys(nestedDefinition)) {
        walk(
          nestedDefinition[key],
          (prevValue as Record<string, unknown>)[key],
          (nextValue as Record<string, unknown>)[key],
          joinPath(path, key)
        );
      }
      return;
    }

    if (!deepEqual(prevValue, nextValue)) {
      changed.push({ path, before: prevValue, after: nextValue });
    }
  }

  for (const [key, field] of Object.entries(definition)) {
    const path = key;
    walk(field, (previous as Record<string, unknown>)[key], (next as Record<string, unknown>)[key], path);
  }

  return { added, removed, changed };
}

export interface MergeOptions {
  arrayStrategy?: 'replace' | 'append';
  preferNewArrays?: boolean;
}

export function mergeSchemaData<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  base: SchemaOutput<Definition>,
  updates: Partial<SchemaOutput<Definition>>,
  options: MergeOptions = {}
): SchemaOutput<Definition> {
  const definition = schema.getDefinition();

  function mergeField(
    fieldDef: SchemaDefinition[string],
    baseValue: unknown,
    updateValue: unknown
  ): unknown {
    if (updateValue === undefined) {
      return baseValue;
    }

    if (isArrayField(fieldDef)) {
      if (!Array.isArray(baseValue)) return updateValue;
      if (!Array.isArray(updateValue)) return baseValue;

      if (options.arrayStrategy === 'append') {
        return [...baseValue, ...updateValue];
      }
      return options.preferNewArrays ? updateValue : updateValue;
    }

    if (isObjectField(fieldDef)) {
      const result: Record<string, unknown> = {
        ...((baseValue && typeof baseValue === 'object' ? (baseValue as Record<string, unknown>) : {}) as Record<
          string,
          unknown
        >)
      };
      for (const [key, nestedField] of Object.entries(fieldDef.shape) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        result[key] = mergeField(
          nestedField,
          (baseValue as Record<string, unknown> | undefined)?.[key],
          (updateValue as Record<string, unknown> | undefined)?.[key]
        );
      }
      return result;
    }

    return updateValue;
  }

  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };

  for (const [key, field] of Object.entries(definition)) {
    const updateValue = (updates as Record<string, unknown>)[key];
    const baseValue = (base as Record<string, unknown>)[key];
    result[key] = mergeField(field, baseValue, updateValue);
  }

  return result as SchemaOutput<Definition>;
}

export interface SearchOptions {
  caseSensitive?: boolean;
  matchMarkdown?: boolean;
  limit?: number;
}

export interface SearchResult {
  path: string;
  value: unknown;
  excerpt: string;
}

function containsMatch(source: string, query: string, caseSensitive: boolean) {
  if (!caseSensitive) {
    return source.toLowerCase().includes(query.toLowerCase());
  }
  return source.includes(query);
}

function buildExcerpt(value: string, query: string, caseSensitive: boolean) {
  const haystack = caseSensitive ? value : value.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index === -1) return value.slice(0, 160);

  const start = Math.max(index - 30, 0);
  const end = Math.min(index + query.length + 30, value.length);
  return `${start > 0 ? '…' : ''}${value.slice(start, end)}${end < value.length ? '…' : ''}`;
}

export function searchSchemaData<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  data: SchemaOutput<Definition>,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const definition = schema.getDefinition();
  const caseSensitive = options.caseSensitive ?? false;
  const results: SearchResult[] = [];

  if (!query.trim()) return results;

  function visit(field: SchemaDefinition[string], value: unknown, path: string) {
    if (value === undefined || value === null) return;

    if (isTextField(field) || isEntityField(field) || isEnumField(field)) {
      const stringValue = String(value);
      if (containsMatch(stringValue, query, caseSensitive)) {
        results.push({
          path,
          value,
          excerpt: buildExcerpt(stringValue, query, caseSensitive)
        });
      }
      return;
    }

    if (isMarkdownField(field) && options.matchMarkdown !== false) {
      const stringValue = String(value);
      if (containsMatch(stringValue, query, caseSensitive)) {
        results.push({
          path,
          value,
          excerpt: buildExcerpt(stringValue, query, caseSensitive)
        });
      }
      return;
    }

    if (isArrayField(field) && Array.isArray(value)) {
    value.forEach((item, index) => {
      const child = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      for (const [key, nestedField] of Object.entries(field.itemDefinition) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        visit(nestedField, child[key], joinPath(joinPath(path, index), key));
      }
    });
    return;
  }

    if (isObjectField(field) && typeof value === 'object' && value) {
      const child = value as Record<string, unknown>;
      for (const [key, nestedField] of Object.entries(field.shape) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        visit(nestedField, child[key], joinPath(path, key));
      }
    }
  }

  for (const [key, field] of Object.entries(definition)) {
    visit(field, (data as Record<string, unknown>)[key], key);
    if (options.limit && results.length >= options.limit) break;
  }

  return options.limit ? results.slice(0, options.limit) : results;
}

export interface EntityRecord {
  path: string;
  type: string;
  value: string;
}

export function extractEntities<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  data: SchemaOutput<Definition>,
  filterType?: string
): EntityRecord[] {
  const definition = schema.getDefinition();
  const results: EntityRecord[] = [];

  function visit(field: SchemaDefinition[string], value: unknown, path: string) {
    if (value === undefined || value === null) return;

    if (isEntityField(field)) {
      if (!filterType || field.entityType === filterType) {
        results.push({
          path,
          value: String(value),
          type: field.entityType
        });
      }
      return;
    }

    if (isArrayField(field) && Array.isArray(value)) {
    value.forEach((item, index) => {
      const child = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      for (const [key, nestedField] of Object.entries(field.itemDefinition) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        visit(nestedField, child[key], joinPath(joinPath(path, index), key));
      }
    });
    return;
  }

    if (isObjectField(field) && value && typeof value === 'object') {
      const child = value as Record<string, unknown>;
      for (const [key, nestedField] of Object.entries(field.shape) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        visit(nestedField, child[key], joinPath(path, key));
      }
    }
  }

  for (const [key, field] of Object.entries(definition)) {
    visit(field, (data as Record<string, unknown>)[key], key);
  }

  return results;
}

export interface MarkdownFieldRecord {
  path: string;
  value: string;
  field: MarkdownFieldDefinition<boolean>;
}

export function collectMarkdownFields<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  data: SchemaOutput<Definition>
): MarkdownFieldRecord[] {
  const definition = schema.getDefinition();
  const records: MarkdownFieldRecord[] = [];

  function visit(field: SchemaDefinition[string], value: unknown, path: string) {
    if (value === undefined || value === null) return;

    if (isMarkdownField(field)) {
      const markdownField: MarkdownFieldDefinition<boolean> = field;
      records.push({
        path,
        value: String(value),
        field: markdownField
      });
      return;
    }

    if (isArrayField(field) && Array.isArray(value)) {
    value.forEach((item, index) => {
      const child = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
      for (const [key, nestedField] of Object.entries(field.itemDefinition) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        visit(nestedField, child[key], joinPath(joinPath(path, index), key));
      }
    });
    return;
  }

    if (isObjectField(field) && value && typeof value === 'object') {
      const child = value as Record<string, unknown>;
      for (const [key, nestedField] of Object.entries(field.shape) as Array<[
        string,
        SchemaDefinition[string]
      ]>) {
        visit(nestedField, child[key], joinPath(path, key));
      }
    }
  }

  for (const [key, field] of Object.entries(definition)) {
    visit(field, (data as Record<string, unknown>)[key], key);
  }

  return records;
}

export function validateSchemaData<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  data: SchemaOutput<Definition>
): SchemaValidationResult<SchemaOutput<Definition>> {
  return schema.safeParse(data);
}
