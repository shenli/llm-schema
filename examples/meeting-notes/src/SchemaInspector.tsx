import { useMemo, useState, type CSSProperties } from 'react';
import { MeetingNotesSchema } from '../schema';

type InspectorTab = 'prompt-ts' | 'prompt-json' | 'json-schema' | 'openai' | 'anthropic';

const tabs: Array<{ id: InspectorTab; label: string; note: string }> = [
  {
    id: 'prompt-ts',
    label: 'toPrompt (TS)',
    note: 'Prompt hint in TypeScript shape — use for models without structured output'
  },
  {
    id: 'prompt-json',
    label: 'toPrompt (JSON)',
    note: 'Same, but as a JSON placeholder structure'
  },
  {
    id: 'json-schema',
    label: 'toJsonSchema',
    note: 'Raw JSON Schema — feed into any validator or provider'
  },
  {
    id: 'openai',
    label: 'toOpenAITool',
    note: 'OpenAI function/tool definition'
  },
  {
    id: 'anthropic',
    label: 'toAnthropicTool',
    note: 'Anthropic tool definition'
  }
];

function formatOutput(tab: InspectorTab): string {
  switch (tab) {
    case 'prompt-ts':
      return MeetingNotesSchema.toPrompt({ structure: 'typescript' });
    case 'prompt-json':
      return MeetingNotesSchema.toPrompt({ structure: 'json' });
    case 'json-schema':
      return JSON.stringify(MeetingNotesSchema.toJsonSchema(), null, 2);
    case 'openai':
      return JSON.stringify(
        MeetingNotesSchema.toOpenAITool({ name: 'record_meeting_notes' }),
        null,
        2
      );
    case 'anthropic':
      return JSON.stringify(
        MeetingNotesSchema.toAnthropicTool({ name: 'record_meeting_notes' }),
        null,
        2
      );
  }
}

export function SchemaInspector() {
  const [tab, setTab] = useState<InspectorTab>('prompt-ts');
  const output = useMemo(() => formatOutput(tab), [tab]);
  const note = tabs.find((t) => t.id === tab)?.note;

  return (
    <details style={styles.wrapper}>
      <summary style={styles.summary}>
        🔎 Schema inspector — same <code>MeetingNotesSchema</code>, five different consumers
      </summary>
      <p style={styles.blurb}>
        This panel renders <code>MeetingNotesSchema</code> through the library's export methods.
        Edit the schema in <code>examples/meeting-notes/schema.ts</code> and every tab below,
        plus the streaming endpoint, plus the React UI, updates in sync. That's the "define
        once, use everywhere" payoff.
      </p>
      <div style={styles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...styles.tab,
              ...(t.id === tab ? styles.tabActive : null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {note && <p style={styles.note}>{note}</p>}
      <pre style={styles.code}>{output}</pre>
    </details>
  );
}

const styles: Record<string, CSSProperties> = {
  wrapper: {
    background: '#0f172a',
    borderRadius: 20,
    color: '#e2e8f0',
    padding: '20px 24px',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.3)'
  },
  summary: {
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    color: '#e2e8f0'
  },
  blurb: {
    color: '#cbd5e1',
    margin: '12px 0 16px',
    fontSize: '0.9rem',
    lineHeight: 1.5
  },
  tabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 10
  },
  tab: {
    background: 'rgba(148, 163, 184, 0.12)',
    color: '#cbd5e1',
    border: '1px solid rgba(148, 163, 184, 0.3)',
    borderRadius: 999,
    padding: '6px 12px',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  tabActive: {
    background: '#4338ca',
    color: '#ffffff',
    border: '1px solid #4338ca'
  },
  note: {
    margin: '0 0 10px',
    fontSize: '0.85rem',
    color: '#94a3b8'
  },
  code: {
    margin: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    padding: '16px',
    borderRadius: 12,
    fontSize: '0.82rem',
    lineHeight: 1.55,
    maxHeight: 340,
    overflow: 'auto'
  }
};
