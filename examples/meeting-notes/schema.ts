import {
  defineSchema,
  md,
  text,
  array,
  entity,
  date,
  enumType,
  type InferSchema
} from 'llm-schema';

export const MeetingNotesSchema = defineSchema(
  {
    meetingTitle: text({ description: 'Short title for the meeting' }),
    summary: md({
      description: 'Markdown summary. Use headings and bullet lists for key sections.'
    }),
    actionItems: array({
      schema: {
        task: text({ description: 'Specific action to take' }),
        owner: entity('person', {
          description: 'Person responsible. Use full names if provided.'
        }),
        dueDate: date({
          description: 'YYYY-MM-DD deadline if one was mentioned',
          optional: true
        }),
        priority: enumType(['high', 'medium', 'low'], {
          description: 'Relative urgency for the task',
          optional: true
        })
      }
    }),
    sentiment: enumType(['positive', 'neutral', 'negative'], {
      description: 'Overall tone of the conversation'
    }),
    highlights: md({
      description: 'Bulleted list of the most important decisions or announcements.'
    }),
    followUps: md({
      description: 'What should happen next. Mention blockers or open questions.'
    })
  },
  {
    name: 'MeetingNotes',
    description: 'Structured meeting summary with markdown-rich sections',
    strict: true
  }
);

export type MeetingNotes = InferSchema<typeof MeetingNotesSchema>;
