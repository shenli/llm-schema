import { describe, expect, test } from 'vitest';
import {
  array,
  boolean,
  date,
  defineSchema,
  entity,
  enumType,
  md,
  number,
  text,
  type InferSchema,
  type SchemaValidationResult
} from '../src';

const MeetingNotesSchema = defineSchema({
  title: text({ description: 'Meeting title' }),
  summary: md({ optional: true, maxLength: 2000 }),
  actionItems: array({
    description: 'Action items with owners',
    schema: {
      task: text({ description: 'What to do' }),
      owner: entity('person', { description: 'Person responsible' }),
      completed: boolean({ default: false })
    }
  }),
  priority: enumType(['high', 'medium', 'low'] as const, { default: 'medium' }),
  durationMinutes: number({ min: 0, max: 480, optional: true }),
  scheduledFor: date({ optional: true })
});

type MeetingNotes = InferSchema<typeof MeetingNotesSchema>;

describe('llm-schema core', () => {
  test('parses valid structured data', () => {
    const payload = {
      title: 'Sprint Review',
      summary: 'Discussed **progress** and next steps.',
      actionItems: [
        { task: 'Prepare release notes', owner: 'alice' },
        { task: 'Update roadmap', owner: 'bob', completed: true }
      ],
      durationMinutes: 60
    } satisfies Partial<MeetingNotes>;

    const result = MeetingNotesSchema.safeParse(payload);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.priority).toBe('medium');
      expect(result.data.actionItems[0]).toEqual({
        task: 'Prepare release notes',
        owner: 'alice',
        completed: false
      });
    }
  });

  test('parse throws SchemaError when invalid', () => {
    const invalid = {
      summary: 123,
      actionItems: []
    } as unknown;

    const safe = MeetingNotesSchema.safeParse(invalid);
    expect(safe.success).toBe(false);

    expect(() => MeetingNotesSchema.parse(invalid)).toThrowError(/Failed to parse schema data/);
  });

  test('accepts JSON string input', () => {
    const payload = JSON.stringify({
      title: 'Weekly Sync',
      actionItems: [{ task: 'Send follow-up', owner: 'carol' }]
    });

    const parsed = MeetingNotesSchema.parse(payload);
    expect(parsed.actionItems).toHaveLength(1);
    expect(parsed.actionItems[0].completed).toBe(false);
  });

  test('generates prompt text with field descriptions', () => {
    const prompt = MeetingNotesSchema.toPrompt({ format: 'compact', includeExamples: false });
    expect(prompt).toContain('Meeting title');
    expect(prompt).toContain('actionItems');
    expect(prompt).toContain('Items');
  });

  test('exports JSON schema and tool schemas', () => {
    const jsonSchema = MeetingNotesSchema.toJsonSchema();
    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.properties?.title?.type).toBe('string');
    expect(jsonSchema.properties?.priority?.enum).toEqual(['high', 'medium', 'low']);

    const openAITool = MeetingNotesSchema.toOpenAITool({ name: 'capture_notes' });
    expect(openAITool.function.name).toBe('capture_notes');
    expect(openAITool.function.parameters.properties?.actionItems?.type).toBe('array');

    const anthropicTool = MeetingNotesSchema.toAnthropicTool({ name: 'meeting_tool' });
    expect(anthropicTool.name).toBe('meeting_tool');
    expect(anthropicTool.input_schema.type).toBe('object');
  });

  test('diff/search/entity utilities work with schema data', () => {
    const before = MeetingNotesSchema.parse({
      title: 'Sprint Review',
      actionItems: [{ task: 'Draft notes', owner: 'alice', completed: false }],
      priority: 'medium'
    });

    const after = MeetingNotesSchema.parse({
      title: 'Sprint Review v2',
      actionItems: [
        { task: 'Draft notes', owner: 'alice', completed: true },
        { task: 'Email summary', owner: 'bob', completed: false }
      ],
      priority: 'high'
    });

    const diff = MeetingNotesSchema.diff(before, after);
    expect(diff.changed.some((entry) => entry.path === 'priority')).toBe(true);
    expect(diff.added.some((entry) => entry.path === 'actionItems.1')).toBe(true);

    const merged = MeetingNotesSchema.merge(before, { priority: 'high' });
    expect(merged.priority).toBe('high');

    const search = MeetingNotesSchema.search(after, 'Email');
    expect(search.some((result) => result.path.includes('actionItems'))).toBe(true);

    const entities = MeetingNotesSchema.getEntities(after, 'person');
    expect(entities).toHaveLength(2);
  });
});
