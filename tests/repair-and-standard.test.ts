import { describe, expect, test } from 'vitest';
import {
  defineSchema,
  text,
  array,
  enumType,
  entity,
  md,
  number,
  repairJsonString
} from '../src';

const Schema = defineSchema({
  title: text({ description: 'title' }),
  tags: enumType(['a', 'b', 'c'] as const),
  items: array({
    schema: {
      name: text(),
      count: number()
    }
  })
});

describe('parseWithRepair', () => {
  test('strips code fences around JSON', () => {
    const raw = '```json\n{"title":"t","tags":"a","items":[{"name":"x","count":1}]}\n```';
    const result = Schema.parseWithRepair(raw);
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe('t');
    expect(result.repairSteps).toContain('stripped code fence');
  });

  test('extracts JSON from prose preamble', () => {
    const raw = 'Sure! Here is the result:\n{"title":"t","tags":"b","items":[]}\nHope that helps.';
    const result = Schema.parseWithRepair(raw);
    expect(result.success).toBe(true);
    expect(result.data?.tags).toBe('b');
    expect(result.repairSteps.some((s) => s.includes('prose'))).toBe(true);
  });

  test('fixes trailing commas', () => {
    const raw = '{"title":"t","tags":"a","items":[{"name":"x","count":1,},],}';
    const result = Schema.parseWithRepair(raw);
    expect(result.success).toBe(true);
    expect(result.repairSteps).toContain('removed trailing commas');
  });

  test('fixes unquoted keys and single quotes', () => {
    const raw = "{title:'t',tags:'c',items:[]}";
    const result = Schema.parseWithRepair(raw);
    expect(result.success).toBe(true);
    expect(result.data?.tags).toBe('c');
  });

  test('returns issues when JSON cannot be repaired', () => {
    const raw = 'not json at all, just words';
    const result = Schema.parseWithRepair(raw);
    expect(result.success).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test('repairJsonString returns steps trace', () => {
    const result = repairJsonString('```{"a":1,}```');
    expect('repaired' in result).toBe(true);
    if ('repaired' in result) {
      expect(result.steps).toContain('stripped code fence');
      expect(result.steps).toContain('removed trailing commas');
    }
  });
});

describe('Standard Schema v1 conformance', () => {
  test('schema exposes ~standard property', () => {
    expect(Schema['~standard'].version).toBe(1);
    expect(Schema['~standard'].vendor).toBe('llm-schema');
    expect(typeof Schema['~standard'].validate).toBe('function');
  });

  test('~standard.validate returns value on success', async () => {
    const result = await Schema['~standard'].validate({
      title: 't',
      tags: 'a',
      items: []
    });
    expect(result.issues).toBeUndefined();
    if (!result.issues) {
      expect(result.value.title).toBe('t');
    }
  });

  test('~standard.validate returns issues on failure', async () => {
    const result = await Schema['~standard'].validate({
      title: 123,
      tags: 'zzz',
      items: []
    });
    expect('issues' in result).toBe(true);
    if ('issues' in result && result.issues) {
      expect(result.issues.length).toBeGreaterThan(0);
      expect(typeof result.issues[0].message).toBe('string');
    }
  });
});

describe('safeParsePartial', () => {
  const Partial = defineSchema({
    title: text(),
    summary: md(),
    author: entity('person'),
    items: array({
      schema: {
        name: text(),
        note: text({ optional: true })
      }
    })
  });

  test('tolerates missing required fields', () => {
    const result = Partial.safeParsePartial({ title: 'hello' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe('hello');
      expect(result.data.summary).toBeUndefined();
    }
  });

  test('tolerates half-written arrays', () => {
    const result = Partial.safeParsePartial({
      title: 'x',
      items: [{ name: 'first' }, { name: 'second', note: 'ok' }]
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });

  test('rejects clearly non-object input', () => {
    const result = Partial.safeParsePartial(42);
    expect(result.success).toBe(false);
  });
});
