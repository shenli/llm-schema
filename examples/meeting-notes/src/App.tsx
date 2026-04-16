import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { jsonSchema } from 'ai';
import {
  SchemaRenderer,
  SchemaEditor,
  SchemaDiff,
  EntityProvider,
  useEntityResolver,
  useStreamingSchema,
  type Entity,
  type ParseIssue,
  type ParseWithRepairResult
} from 'llm-schema';
import { MeetingNotesSchema, type MeetingNotes } from '../schema';
import { PolishedView } from './PolishedView';
import { SchemaInspector } from './SchemaInspector';

// AI SDK 6 wraps — feed our JSON Schema through `jsonSchema()` for typed streaming.
const aiSchema = jsonSchema<MeetingNotes>(
  MeetingNotesSchema.toJsonSchema() as unknown as Parameters<typeof jsonSchema>[0]
);

type Pipeline = 'structured' | 'legacy';
type ResultTab = 'polished' | 'generated' | 'edit';

const exampleTranscript = `
Alice (PM): Welcome everyone. Today we need to align on the Q3 launch plan for the analytics dashboard.

Sam (Design): The new layout is 90% done. Remaining work is polishing the responsive states.

Priya (Eng): Backend endpoints for collaborative filtering are finished. We still need load tests by next Friday.

Alice: Great. We also promised marketing that the beta invite list would be ready by the 20th.

Leo (Marketing): We'll prepare the launch email sequence once we confirm the beta cohort. Need final list by July 18.

Sam: We discovered a usability issue with the filter chips. We should run a quick usability session early next week.

Priya: We'll handle load tests and prep a failover plan. If we finish early, we can help with analytics instrumentation.

Alice: Let's document risks in Confluence and make sure the support team gets a quickstart guide.
`.trim();

const seedPeople: Entity[] = [
  { type: 'person', id: 'alice@acme.com', label: 'Alice Archer (PM)' },
  { type: 'person', id: 'sam@acme.com', label: 'Sam Song (Design)' },
  { type: 'person', id: 'priya@acme.com', label: 'Priya Patel (Eng)' },
  { type: 'person', id: 'leo@acme.com', label: 'Leo Lin (Marketing)' }
];

function App() {
  const [people, setPeople] = useState<Entity[]>(seedPeople);

  return (
    <EntityProvider entities={people} onChange={setPeople}>
      <AppInner />
    </EntityProvider>
  );
}

function AppInner() {
  const [transcript, setTranscript] = useState(exampleTranscript);
  const [pipeline, setPipeline] = useState<Pipeline>('structured');
  const [tab, setTab] = useState<ResultTab>('polished');
  const [edited, setEdited] = useState<MeetingNotes | null>(null);

  // Structured streaming pipeline (AI SDK useObject).
  // Cast needed because `ai` and `@ai-sdk/react` each bundle their own copy of
  // `@ai-sdk/provider-utils`, so the `validatorSymbol` brand differs across the
  // two packages at type-check time. At runtime the shape matches exactly.
  const structuredHook = useObject({
    api: '/api/analyze',
    schema: aiSchema as unknown as Parameters<typeof useObject>[0]['schema']
  });
  const {
    object: streamObject,
    submit: streamSubmit,
    isLoading: streamLoading,
    error: streamError,
    stop
  } = structuredHook;
  const streaming = useStreamingSchema({
    schema: MeetingNotesSchema,
    object: streamObject,
    isLoading: streamLoading
  });

  // Legacy + repair pipeline
  const [legacyLoading, setLegacyLoading] = useState(false);
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [legacyRaw, setLegacyRaw] = useState<string | null>(null);
  const [legacyResult, setLegacyResult] =
    useState<ParseWithRepairResult<MeetingNotes> | null>(null);

  const active =
    pipeline === 'structured'
      ? {
          data: streaming.data as MeetingNotes | undefined,
          partial: streaming.partial,
          isValid: streaming.isValid,
          issues: streaming.issues,
          loading: streamLoading,
          error: streamError?.message ?? null
        }
      : {
          data: legacyResult?.data,
          partial: false,
          isValid: !!legacyResult?.success,
          issues: legacyResult?.issues ?? [],
          loading: legacyLoading,
          error: legacyError
        };

  const submitDisabled = active.loading || transcript.trim().length === 0;

  const handleAnalyze = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEdited(null);
    setTab('polished');

    if (pipeline === 'structured') {
      streamSubmit({ transcript });
      return;
    }

    setLegacyLoading(true);
    setLegacyError(null);
    setLegacyRaw(null);
    setLegacyResult(null);
    try {
      const res = await fetch('/api/analyze-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript })
      });
      const payload = (await res.json()) as { raw?: string; error?: string };
      if (payload.error) throw new Error(payload.error);
      const raw = payload.raw ?? '';
      setLegacyRaw(raw);
      const repaired = MeetingNotesSchema.parseWithRepair(
        raw
      ) as ParseWithRepairResult<MeetingNotes>;
      setLegacyResult(repaired);
    } catch (err) {
      setLegacyError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLegacyLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.backdrop} />
      <header style={styles.header}>
        <span style={styles.titleEyebrow}>Meeting Notes · llm-schema 0.3</span>
        <h1 style={styles.title}>One schema. Every job.</h1>
        <p style={styles.subtitle}>
          Streaming structured output, zero-code rendering, nested editing, diff view, entity
          resolution, and JSON repair — all driven by the same schema definition.
        </p>
      </header>

      <main style={styles.content}>
        <PipelinePicker value={pipeline} onChange={setPipeline} />

        <section style={styles.inputCard}>
          <form onSubmit={handleAnalyze} style={styles.form}>
            <label htmlFor="transcript" style={styles.label}>
              Meeting transcript
            </label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={14}
              style={styles.textarea}
              placeholder="Paste raw meeting notes or transcript here..."
            />
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="submit"
                style={{
                  ...styles.button,
                  opacity: submitDisabled ? 0.6 : 1,
                  cursor: submitDisabled ? 'not-allowed' : 'pointer'
                }}
                disabled={submitDisabled}
              >
                {active.loading
                  ? pipeline === 'structured'
                    ? 'Streaming…'
                    : 'Generating…'
                  : pipeline === 'structured'
                    ? 'Generate (streaming)'
                    : 'Generate (legacy → repair)'}
              </button>
              {pipeline === 'structured' && streamLoading && (
                <button type="button" onClick={() => stop()} style={styles.buttonSecondary}>
                  Stop
                </button>
              )}
            </div>
            <p style={styles.helperText}>
              {pipeline === 'structured' ? (
                <>
                  Uses <code>streamObject({'{ schema: MeetingNotesSchema }'})</code> from Vercel AI
                  SDK. The schema is enforced at the token level; the renderer is partial-aware.
                </>
              ) : (
                <>
                  Uses plain <code>generateText</code> with no schema enforcement. The client feeds
                  the raw response to <code>schema.parseWithRepair()</code> — see the repair panel
                  below.
                </>
              )}
            </p>
          </form>

          {active.error && (
            <div style={styles.errorPanel}>
              <strong>Request failed:</strong> {active.error}
            </div>
          )}
        </section>

        {pipeline === 'legacy' && legacyRaw && legacyResult && (
          <RepairPanel raw={legacyRaw} result={legacyResult} />
        )}

        {active.data && (
          <section style={styles.resultCard}>
            <ResultTabs
              tab={tab}
              onChange={setTab}
              canEdit={!active.partial && active.isValid}
              hasEdits={!!edited}
            />

            {tab === 'polished' && (
              <PolishedView data={active.data} partial={active.partial} />
            )}

            {tab === 'generated' && (
              <GeneratedView data={active.data} partial={active.partial} />
            )}

            {tab === 'edit' && active.data && (
              <EditTab
                original={active.data}
                edited={edited}
                setEdited={setEdited}
                issues={active.issues}
              />
            )}
          </section>
        )}

        <SchemaInspector />
      </main>
    </div>
  );
}

function PipelinePicker({
  value,
  onChange
}: {
  value: Pipeline;
  onChange: (next: Pipeline) => void;
}) {
  return (
    <section style={styles.pipelineCard}>
      <strong style={styles.pipelineTitle}>Pipeline</strong>
      <label style={styles.pipelineOption}>
        <input
          type="radio"
          name="pipeline"
          checked={value === 'structured'}
          onChange={() => onChange('structured')}
        />
        <div>
          <div style={styles.pipelineOptionTitle}>Structured streaming</div>
          <div style={styles.pipelineOptionBody}>
            AI SDK <code>streamObject</code> · token-level schema enforcement · partial render
          </div>
        </div>
      </label>
      <label style={styles.pipelineOption}>
        <input
          type="radio"
          name="pipeline"
          checked={value === 'legacy'}
          onChange={() => onChange('legacy')}
        />
        <div>
          <div style={styles.pipelineOptionTitle}>Legacy + repair</div>
          <div style={styles.pipelineOptionBody}>
            Plain text response with code fences · <code>schema.parseWithRepair()</code> strips and
            validates
          </div>
        </div>
      </label>
    </section>
  );
}

function RepairPanel({
  raw,
  result
}: {
  raw: string;
  result: ParseWithRepairResult<MeetingNotes>;
}) {
  return (
    <section style={styles.repairCard}>
      <div style={styles.repairHeader}>
        <strong>Repair pipeline</strong>
        <span
          style={{
            ...styles.repairBadge,
            background: result.success ? '#dcfce7' : '#fee2e2',
            color: result.success ? '#166534' : '#991b1b'
          }}
        >
          {result.success ? 'Validated after repair' : 'Validation failed'}
        </span>
      </div>
      {result.repairSteps.length === 0 ? (
        <p style={styles.repairNote}>
          No repair was necessary — the raw response parsed as valid JSON directly.
        </p>
      ) : (
        <>
          <p style={styles.repairNote}>Applied repair steps, in order:</p>
          <ol style={styles.repairSteps}>
            {result.repairSteps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </>
      )}
      <div style={styles.repairGrid}>
        <div>
          <div style={styles.repairLabel}>Raw LLM output</div>
          <pre style={styles.repairPre}>{raw}</pre>
        </div>
        <div>
          <div style={styles.repairLabel}>After repair</div>
          <pre style={styles.repairPre}>
            {result.repairedSource ?? '(no repair needed — identical to raw)'}
          </pre>
        </div>
      </div>
    </section>
  );
}

function ResultTabs({
  tab,
  onChange,
  canEdit,
  hasEdits
}: {
  tab: ResultTab;
  onChange: (next: ResultTab) => void;
  canEdit: boolean;
  hasEdits: boolean;
}) {
  const tabs: Array<{ id: ResultTab; label: string; disabled?: boolean; badge?: string }> = [
    { id: 'polished', label: 'Polished (custom UI)' },
    { id: 'generated', label: 'Generated (zero custom code)' },
    {
      id: 'edit',
      label: `Edit${hasEdits ? ' •' : ''}`,
      disabled: !canEdit,
      badge: canEdit ? undefined : 'waits for stream'
    }
  ];
  return (
    <div style={styles.resultTabs}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={t.disabled}
          onClick={() => onChange(t.id)}
          style={{
            ...styles.resultTab,
            ...(t.id === tab ? styles.resultTabActive : null),
            ...(t.disabled ? styles.resultTabDisabled : null)
          }}
          title={t.badge}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function GeneratedView({
  data,
  partial
}: {
  data: MeetingNotes | Record<string, unknown>;
  partial: boolean;
}) {
  return (
    <div>
      <p style={styles.generatedNote}>
        Everything below is rendered by <code>&lt;SchemaRenderer /&gt;</code> with zero custom UI
        code. Theme it with <code>config.classNames</code>, replace any field component with
        <code>components</code>, or leave the defaults.
      </p>
      <SchemaRenderer schema={MeetingNotesSchema} data={data as MeetingNotes} partial={partial} />
    </div>
  );
}

function EditTab({
  original,
  edited,
  setEdited,
  issues
}: {
  original: MeetingNotes;
  edited: MeetingNotes | null;
  setEdited: (next: MeetingNotes | null) => void;
  issues: ParseIssue[];
}) {
  useEffect(() => {
    if (!edited) {
      setEdited(structuredClone(original));
    }
  }, [edited, original, setEdited]);

  const resolver = useEntityResolver();
  const current = edited ?? original;
  const validation = useMemo(
    () => MeetingNotesSchema.safeParse(current),
    [current]
  );
  const editorIssues = validation.success ? [] : validation.issues;
  const hasEdits = JSON.stringify(current) !== JSON.stringify(original);

  // Detect owner ids that aren't registered in the entity provider.
  const unregisteredOwners = useMemo(() => {
    if (!resolver) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of current.actionItems ?? []) {
      const id = item?.owner;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      if (!resolver.byId('person', id)) out.push(id);
    }
    return out;
  }, [current, resolver]);

  const reset = () => setEdited(structuredClone(original));

  const simulateInvalid = () => {
    // Strip a required field to show field-level errors in the editor.
    const next = structuredClone(current);
    (next as Record<string, unknown>).sentiment = undefined;
    setEdited(next);
  };

  return (
    <>
      <div style={styles.editHeader}>
        <div>
          <h3 style={styles.sectionTitle}>Human-in-the-loop editor</h3>
          <p style={{ margin: '4px 0 0', color: '#5b6470', fontSize: '0.9rem' }}>
            Arrays have add / remove / reorder. Owners use a typeahead from the entity registry.
            Errors surface per-field.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            style={styles.buttonSecondary}
            onClick={simulateInvalid}
            title="Strips the required sentiment field — watch the editor show a validation error"
          >
            💥 Simulate invalid output
          </button>
          <button
            type="button"
            style={styles.buttonSecondary}
            onClick={reset}
            disabled={!hasEdits}
          >
            Reset
          </button>
        </div>
      </div>

      {unregisteredOwners.length > 0 && (
        <UnregisteredOwners ids={unregisteredOwners} />
      )}

      {issues.length > 0 && (
        <div style={{ ...styles.errorPanel, marginBottom: 0 }}>
          <strong>Streaming output had issues:</strong>
          <ul style={styles.issueList}>
            {issues.map((issue, i) => (
              <li key={i}>
                <code>{issue.path.join('.') || '<root>'}</code>: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={styles.editorShell}>
        <SchemaEditor
          schema={MeetingNotesSchema}
          data={current}
          onChange={(next) => setEdited(next as MeetingNotes)}
          validationIssues={editorIssues}
          config={{ stylePreset: 'plain' }}
        />
      </div>

      <section style={styles.sectionCard}>
        <h3 style={styles.sectionTitle}>Changes {hasEdits ? '(unsaved)' : '(none)'}</h3>
        <SchemaDiff
          schema={MeetingNotesSchema}
          prev={original}
          next={current}
          layout="side-by-side"
        />
      </section>
    </>
  );
}

function UnregisteredOwners({ ids }: { ids: string[] }) {
  const resolver = useEntityResolver();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!resolver) return null;

  return (
    <div style={styles.unregisteredPanel}>
      <strong>Unknown owners</strong>
      <p style={{ margin: '4px 0 10px', color: '#7c2d12', fontSize: '0.85rem' }}>
        The LLM produced owner ids that aren't in the entity registry. Register them so they
        display with readable labels across every view.
      </p>
      {ids.map((id) => (
        <div key={id} style={styles.unregisteredRow}>
          <code style={{ flex: 1, color: '#7c2d12' }}>{id}</code>
          <input
            type="text"
            placeholder="Display label"
            value={drafts[id] ?? ''}
            onChange={(e) => setDrafts({ ...drafts, [id]: e.target.value })}
            style={styles.unregisteredInput}
          />
          <button
            type="button"
            style={styles.button}
            onClick={() => {
              const label = drafts[id]?.trim();
              if (!label) return;
              resolver.register({ type: 'person', id, label });
              setDrafts({ ...drafts, [id]: '' });
            }}
          >
            Register
          </button>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    position: 'relative',
    fontFamily: '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: 'linear-gradient(135deg, #eef2ff 0%, #e0f2fe 100%)',
    minHeight: '100vh',
    padding: '56px 0 96px'
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 45%, transparent 70%)',
    pointerEvents: 'none'
  },
  header: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '6px',
    maxWidth: 720,
    margin: '0 auto 32px'
  },
  titleEyebrow: {
    textTransform: 'uppercase',
    letterSpacing: '0.2em',
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#6366f1'
  },
  title: {
    margin: 0,
    fontSize: '2.4rem',
    color: '#0f172a'
  },
  subtitle: {
    margin: 0,
    color: '#475569',
    fontSize: '1rem',
    maxWidth: 640
  },
  content: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 980,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    padding: '0 32px'
  },
  pipelineCard: {
    background: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 20,
    padding: '18px 22px',
    display: 'grid',
    gridTemplateColumns: 'auto 1fr 1fr',
    gap: 16,
    alignItems: 'center',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
    border: '1px solid rgba(148, 163, 184, 0.24)'
  },
  pipelineTitle: {
    color: '#0f172a',
    fontSize: '0.95rem'
  },
  pipelineOption: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 12,
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    cursor: 'pointer'
  },
  pipelineOptionTitle: {
    fontWeight: 600,
    color: '#0f172a',
    fontSize: '0.9rem'
  },
  pipelineOptionBody: {
    color: '#475569',
    fontSize: '0.82rem',
    marginTop: 2
  },
  inputCard: {
    background: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 24,
    boxShadow: '0 30px 80px rgba(15, 23, 42, 0.08)',
    padding: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    border: '1px solid rgba(148, 163, 184, 0.24)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  label: {
    fontWeight: 600,
    color: '#1f2937',
    fontSize: '1rem'
  },
  textarea: {
    width: '100%',
    borderRadius: 16,
    border: '1px solid #cbd5f5',
    padding: '18px',
    fontSize: '1rem',
    lineHeight: 1.6,
    resize: 'vertical',
    minHeight: '240px',
    boxShadow: 'inset 0 1px 3px rgba(148, 163, 184, 0.18)'
  },
  button: {
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #2563eb 100%)',
    color: 'white',
    padding: '12px 20px',
    fontWeight: 600,
    fontSize: '0.95rem',
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(79, 70, 229, 0.35)'
  },
  buttonSecondary: {
    borderRadius: 999,
    border: '1px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    padding: '10px 18px',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  helperText: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#5b6470'
  },
  errorPanel: {
    background: '#fef2f2',
    borderRadius: 16,
    padding: '16px',
    color: '#b91c1c',
    boxShadow: '0 8px 24px rgba(244, 63, 94, 0.18)',
    marginBottom: 20
  },
  issueList: {
    marginTop: 10,
    paddingLeft: 20,
    color: '#7f1d1d'
  },
  repairCard: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '22px',
    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148, 163, 184, 0.24)'
  },
  repairHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10
  },
  repairBadge: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 600
  },
  repairNote: {
    margin: '0 0 8px',
    color: '#334155',
    fontSize: '0.9rem'
  },
  repairSteps: {
    margin: '0 0 14px',
    paddingLeft: 20,
    color: '#334155',
    fontSize: '0.9rem',
    lineHeight: 1.6
  },
  repairGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14
  },
  repairLabel: {
    fontWeight: 600,
    marginBottom: 4,
    color: '#475569',
    fontSize: '0.82rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  repairPre: {
    margin: 0,
    background: '#0f172a',
    color: '#e2e8f0',
    padding: '14px',
    borderRadius: 12,
    fontSize: '0.8rem',
    maxHeight: 280,
    overflow: 'auto',
    whiteSpace: 'pre-wrap'
  },
  resultCard: {
    background: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 28,
    boxShadow: '0 40px 90px rgba(15, 23, 42, 0.12)',
    padding: '28px',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    border: '1px solid rgba(148, 163, 184, 0.18)'
  },
  resultTabs: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: 12
  },
  resultTab: {
    padding: '8px 16px',
    borderRadius: 999,
    border: '1px solid transparent',
    background: '#f1f5f9',
    color: '#334155',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer'
  },
  resultTabActive: {
    background: '#0f172a',
    color: '#ffffff',
    border: '1px solid #0f172a'
  },
  resultTabDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.08rem',
    color: '#0f172a'
  },
  sectionCard: {
    background: '#f9fafb',
    borderRadius: 20,
    padding: '20px 22px',
    boxShadow: 'inset 0 0 0 1px #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  generatedNote: {
    margin: '0 0 16px',
    color: '#5b6470',
    fontSize: '0.9rem'
  },
  editHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap'
  },
  editorShell: {
    background: '#ffffff',
    padding: '20px',
    borderRadius: 20,
    boxShadow: 'inset 0 0 0 1px #e2e8f0'
  },
  unregisteredPanel: {
    background: '#fff7ed',
    borderRadius: 16,
    padding: '14px 18px',
    border: '1px solid #fed7aa'
  },
  unregisteredRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    marginTop: 8
  },
  unregisteredInput: {
    flex: 1,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #fed7aa',
    fontSize: '0.9rem'
  }
};

export default App;
