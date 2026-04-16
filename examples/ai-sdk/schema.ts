import {
  defineSchema,
  text,
  md,
  array,
  entity,
  enumType,
  type InferSchema
} from 'llm-schema';

export const CallSummary = defineSchema({
  summary: md('Concise meeting summary in markdown'),
  actionItems: array({
    schema: {
      task: text('Specific follow-up'),
      owner: entity('person', 'Owner email or handle'),
      priority: enumType(['high', 'medium', 'low'] as const, { optional: true })
    }
  }),
  sentiment: enumType(['positive', 'neutral', 'negative'])
});

export type CallSummary = InferSchema<typeof CallSummary>;
