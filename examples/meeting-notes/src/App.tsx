import { useMemo, useState, type CSSProperties } from 'react';
import type { ParseIssue } from 'llm-schema';
import { SchemaRenderer, MarkdownField } from 'llm-schema/react';
import { MeetingNotesSchema, type MeetingNotes } from '../schema';

interface AnalyzeResponse {
  success: boolean;
  data?: MeetingNotes;
  issues?: ParseIssue[];
  prompt?: string;
  raw?: string;
}

const sentimentTokens: Record<
  MeetingNotes['sentiment'],
  { label: string; text: string; background: string; border: string }
> = {
  positive: {
    label: 'Positive',
    text: '#166534',
    background: '#dcfce7',
    border: '#bbf7d0'
  },
  neutral: {
    label: 'Neutral',
    text: '#1f2937',
    background: '#f3f4f6',
    border: '#e5e7eb'
  },
  negative: {
    label: 'Negative',
    text: '#991b1b',
    background: '#fee2e2',
    border: '#fecaca'
  }
};

const priorityTokens: Record<
  NonNullable<MeetingNotes['actionItems'][number]['priority']>,
  { text: string; background: string }
> = {
  high: {
    text: '#b91c1c',
    background: 'rgba(248, 113, 113, 0.18)'
  },
  medium: {
    text: '#b45309',
    background: 'rgba(251, 191, 36, 0.18)'
  },
  low: {
    text: '#2563eb',
    background: 'rgba(96, 165, 250, 0.18)'
  }
};

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

function formatDueDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function App() {
  const [transcript, setTranscript] = useState(exampleTranscript);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MeetingNotes | null>(null);
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<string | undefined>();

  const actionItemsCount = result?.actionItems.length ?? 0;

  const submitDisabled = useMemo(() => loading || transcript.trim().length === 0, [loading, transcript]);

  async function handleAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setIssues([]);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ transcript })
      });

      const payload = (await response.json()) as AnalyzeResponse;

      setPrompt(payload.prompt);

      if (!payload.success) {
        setIssues(payload.issues ?? []);
        setError('The model response did not match the schema. See issues below.');
        return;
      }

      if (!payload.data) {
        setError('The response succeeded but did not include data.');
        return;
      }

      setResult(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.backdrop} />
      <header style={styles.header}>
        <span style={styles.titleEyebrow}>Meeting Notes</span>
        <h1 style={styles.title}>llm-schema Example</h1>
        <p style={styles.subtitle}>
          Define once. Use everywhere. Paste a transcript, generate structured notes, render them instantly.
        </p>
      </header>

      <main style={styles.content}>
        <section style={styles.inputCard}>
          <form onSubmit={handleAnalyze} style={styles.form}>
            <label htmlFor="transcript" style={styles.label}>
              Meeting transcript or notes
            </label>
            <textarea
              id="transcript"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              rows={18}
              style={styles.textarea}
              placeholder="Paste raw meeting notes or transcript here..."
            />
            <button
              type="submit"
              style={{
                ...styles.button,
                opacity: submitDisabled ? 0.6 : 1,
                cursor: submitDisabled ? 'not-allowed' : 'pointer'
              }}
              disabled={submitDisabled}
            >
              {loading ? 'Analyzing…' : 'Generate structured notes'}
            </button>
            <p style={styles.helperText}>
              OpenAI model: <code>gpt-5-mini</code>. Schema and instructions come from <code>MeetingNotesSchema</code>.
            </p>
          </form>

          {prompt && (
            <details style={styles.promptDetails}>
              <summary style={styles.summary}>See the generated prompt instructions</summary>
              <pre style={styles.promptPre}>{prompt}</pre>
            </details>
          )}

          {error && (
            <div style={styles.errorPanel}>
              <strong>{error}</strong>
              {issues.length > 0 && (
                <ul style={styles.issueList}>
                  {issues.map((issue, index) => (
                    <li key={`${issue.path.join('.')}-${index}`}>
                      <code>{issue.path.join('.')}</code>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section style={styles.resultSection}>
          {!result && !loading && (
            <div style={styles.placeholderCard}>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.2rem', color: '#0f172a' }}>
                Structured results appear here
              </h3>
              <p style={{ color: '#5b6470', margin: 0 }}>
                Submit a transcript to see how one schema powers prompt instructions, parsing, and rich React rendering.
              </p>
            </div>
          )}

          {result && (
            <div style={styles.resultCard}>
              <header style={styles.hero}>
                <div>
                  <span style={styles.heroEyebrow}>Meeting summary</span>
                  <h2 style={styles.heroTitle}>{result.meetingTitle}</h2>
                </div>
                <div style={styles.heroMeta}>
                  <span
                    style={{
                      ...styles.sentimentBadge,
                      color: sentimentTokens[result.sentiment].text,
                      background: sentimentTokens[result.sentiment].background,
                      borderColor: sentimentTokens[result.sentiment].border
                    }}
                  >
                    {sentimentTokens[result.sentiment].label}
                  </span>
                  <span style={styles.metaPill}>{actionItemsCount} action items</span>
                </div>
              </header>

              <div style={styles.summaryStack}>
                <section style={styles.sectionCard}>
                  <h3 style={styles.sectionTitle}>Summary</h3>
                  <div style={styles.markdown}>
                    <MarkdownField content={result.summary ?? ''} />
                  </div>
                </section>
                <section style={styles.sectionCard}>
                  <h3 style={styles.sectionTitle}>Highlights</h3>
                  <div style={styles.markdown}>
                    <MarkdownField content={result.highlights ?? ''} />
                  </div>
                </section>
                <section style={styles.sectionCard}>
                  <h3 style={styles.sectionTitle}>Follow ups</h3>
                  <div style={styles.markdown}>
                    <MarkdownField content={result.followUps ?? ''} />
                  </div>
                </section>
              </div>

              <section style={styles.actionSection}>
                <div style={styles.sectionHeader}>
                  <h3 style={styles.sectionTitle}>Action items</h3>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
                    Ownership, due dates, and priority are captured automatically.
                  </span>
                </div>
                <div style={styles.actionGrid}>
                  {result.actionItems.map((item, index) => {
                    const priority = item.priority ? priorityTokens[item.priority] : null;
                    return (
                      <article key={`${item.task}-${index}`} style={styles.actionCard}>
                        <header style={styles.actionHeader}>
                          <span style={styles.actionIndex}>#{index + 1}</span>
                          {priority && (
                            <span
                              style={{
                                ...styles.priorityBadge,
                                color: priority.text,
                                background: priority.background
                              }}
                            >
                              {item.priority.toUpperCase()}
                            </span>
                          )}
                        </header>
                        <h4 style={styles.actionTask}>{item.task}</h4>
                        <div style={styles.actionMeta}>
                          <span style={styles.ownerPill}>{item.owner}</span>
                          {item.dueDate && (
                            <span style={styles.dueChip}>Due {formatDueDate(item.dueDate) ?? item.dueDate}</span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <details style={styles.schemaDetails}>
                <summary style={styles.summary}>Peek at the schema-driven renderer</summary>
                <div style={styles.schemaPreview}>
                  <SchemaRenderer schema={MeetingNotesSchema} data={result} />
                </div>
              </details>
            </div>
          )}
        </section>
      </main>
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
    background: 'radial-gradient(circle at top, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.75) 45%, transparent 70%)',
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
    margin: '0 auto 40px'
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
    maxWidth: 520
  },
  content: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 920,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    padding: '0 32px'
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
    minHeight: '320px',
    boxShadow: 'inset 0 1px 3px rgba(148, 163, 184, 0.18)'
  },
  button: {
    borderRadius: 999,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1 0%, #2563eb 100%)',
    color: 'white',
    padding: '15px 20px',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: '0 12px 30px rgba(79, 70, 229, 0.35)'
  },
  helperText: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#5b6470'
  },
  promptDetails: {
    background: '#0f172a',
    borderRadius: 16,
    color: '#e2e8f0',
    padding: '16px 18px',
    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.45)'
  },
  summary: {
    fontWeight: 600,
    cursor: 'pointer'
  },
  promptPre: {
    marginTop: 12,
    maxHeight: 240,
    overflowY: 'auto',
    background: 'rgba(10, 12, 29, 0.65)',
    color: '#e2e8f0',
    padding: '16px',
    borderRadius: 12,
    fontSize: '0.85rem'
  },
  errorPanel: {
    background: '#fef2f2',
    borderRadius: 16,
    padding: '16px',
    color: '#b91c1c',
    boxShadow: '0 8px 24px rgba(244, 63, 94, 0.18)'
  },
  issueList: {
    marginTop: 12,
    paddingLeft: 20,
    color: '#7f1d1d'
  },
  resultSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  placeholderCard: {
    background: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 24,
    padding: '48px 40px',
    textAlign: 'center',
    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.08)',
    border: '1px solid rgba(148, 163, 184, 0.24)'
  },
  resultCard: {
    background: 'rgba(255, 255, 255, 0.96)',
    borderRadius: 28,
    boxShadow: '0 40px 90px rgba(15, 23, 42, 0.12)',
    padding: '36px',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
    border: '1px solid rgba(148, 163, 184, 0.18)'
  },
  hero: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '18px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '18px'
  },
  heroEyebrow: {
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#94a3b8'
  },
  heroTitle: {
    margin: '6px 0 0',
    fontSize: '1.9rem',
    lineHeight: 1.25,
    color: '#0f172a'
  },
  heroMeta: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center'
  },
  sentimentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontWeight: 600,
    fontSize: '0.85rem',
    padding: '8px 12px',
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'solid'
  },
  metaPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '8px 12px',
    borderRadius: 999,
    border: '1px solid #cbd5f5',
    background: '#eef2ff',
    color: '#312e81',
    fontWeight: 600,
    fontSize: '0.85rem'
  },
  summaryStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px'
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
  sectionHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '12px'
  },
  sectionTitle: {
    margin: 0,
    fontSize: '1.08rem',
    color: '#0f172a'
  },
  markdown: {
    fontSize: '0.95rem',
    lineHeight: 1.6,
    color: '#1f2937'
  },
  actionSection: {
    background: '#f5f8ff',
    borderRadius: 22,
    padding: '24px',
    boxShadow: 'inset 0 0 0 1px #dbeafe',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  actionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px'
  },
  actionCard: {
    borderRadius: 18,
    padding: '18px',
    background: '#ffffff',
    boxShadow: '0 16px 36px rgba(15, 23, 42, 0.12)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  actionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  actionIndex: {
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#94a3b8'
  },
  priorityBadge: {
    fontWeight: 700,
    fontSize: '0.75rem',
    borderRadius: 999,
    padding: '4px 10px'
  },
  actionTask: {
    margin: 0,
    fontSize: '1.05rem',
    color: '#0f172a',
    lineHeight: 1.4
  },
  actionMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  ownerPill: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    background: '#e2e8f0',
    color: '#1e293b',
    fontWeight: 600,
    fontSize: '0.8rem'
  },
  dueChip: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: 999,
    background: '#f1f5f9',
    color: '#334155',
    fontWeight: 500,
    fontSize: '0.8rem'
  },
  schemaDetails: {
    background: '#f8fafc',
    borderRadius: 20,
    padding: '14px 18px',
    boxShadow: '0 4px 20px rgba(15, 23, 42, 0.08)'
  },
  schemaPreview: {
    marginTop: 14,
    background: '#ffffff',
    padding: '16px',
    borderRadius: 16,
    boxShadow: 'inset 0 0 0 1px #e2e8f0',
    maxHeight: 360,
    overflowY: 'auto'
  }
};

export default App;
