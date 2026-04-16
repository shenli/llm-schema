import type { CSSProperties } from 'react';
import { MarkdownField, useEntity, type PartialSchemaOutput } from 'llm-schema';
import { MeetingNotesSchema, type MeetingNotes } from '../schema';

type PartialMeetingNotes = PartialSchemaOutput<typeof MeetingNotesSchema.definition>;

export interface PolishedViewProps {
  data: MeetingNotes | PartialMeetingNotes;
  partial: boolean;
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
  high: { text: '#b91c1c', background: 'rgba(248, 113, 113, 0.18)' },
  medium: { text: '#b45309', background: 'rgba(251, 191, 36, 0.18)' },
  low: { text: '#2563eb', background: 'rgba(96, 165, 250, 0.18)' }
};

function formatDueDate(value?: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : null;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function OwnerPill({ id }: { id: string }) {
  const entity = useEntity('person', id);
  return <span style={styles.ownerPill}>{entity?.label ?? id}</span>;
}

function Pending() {
  return <span style={styles.pending} aria-busy="true">{'\u00a0'}</span>;
}

export function PolishedView({ data, partial }: PolishedViewProps) {
  const actionItems = data.actionItems ?? [];
  const sentiment = data.sentiment as MeetingNotes['sentiment'] | undefined;

  return (
    <>
      <header style={styles.hero}>
        <div>
          <span style={styles.heroEyebrow}>{partial ? 'Streaming…' : 'Meeting summary'}</span>
          <h2 style={styles.heroTitle}>
            {data.meetingTitle ?? <Pending />}
          </h2>
        </div>
        <div style={styles.heroMeta}>
          {sentiment && (
            <span
              style={{
                ...styles.sentimentBadge,
                color: sentimentTokens[sentiment].text,
                background: sentimentTokens[sentiment].background,
                borderColor: sentimentTokens[sentiment].border
              }}
            >
              {sentimentTokens[sentiment].label}
            </span>
          )}
          <span style={styles.metaPill}>
            {typeof actionItems.length === 'number' ? `${actionItems.length} action items` : <Pending />}
          </span>
        </div>
      </header>

      <div style={styles.summaryStack}>
        <section style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Summary</h3>
          <div style={styles.markdown}>
            {data.summary ? <MarkdownField content={data.summary} /> : <Pending />}
          </div>
        </section>
        <section style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Highlights</h3>
          <div style={styles.markdown}>
            {data.highlights ? <MarkdownField content={data.highlights} /> : <Pending />}
          </div>
        </section>
        <section style={styles.sectionCard}>
          <h3 style={styles.sectionTitle}>Follow ups</h3>
          <div style={styles.markdown}>
            {data.followUps ? <MarkdownField content={data.followUps} /> : <Pending />}
          </div>
        </section>
      </div>

      <section style={styles.actionSection}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Action items</h3>
          <span style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Owners resolved from the entity registry.
          </span>
        </div>
        <div style={styles.actionGrid}>
          {actionItems.map((item, index) => {
            const priority = item?.priority ? priorityTokens[item.priority] : null;
            return (
              <article key={`${item?.task ?? 'pending'}-${index}`} style={styles.actionCard}>
                <header style={styles.actionHeader}>
                  <span style={styles.actionIndex}>#{index + 1}</span>
                  {priority && item?.priority && (
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
                <h4 style={styles.actionTask}>
                  {item?.task ?? <Pending />}
                </h4>
                <div style={styles.actionMeta}>
                  {item?.owner && <OwnerPill id={item.owner} />}
                  {item?.dueDate && (
                    <span style={styles.dueChip}>
                      Due {formatDueDate(item.dueDate) ?? String(item.dueDate)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
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
    alignItems: 'center',
    flexWrap: 'wrap'
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
  pending: {
    display: 'inline-block',
    minWidth: 120,
    height: '0.9rem',
    borderRadius: 6,
    background:
      'linear-gradient(90deg, rgba(226,232,240,0.6) 25%, rgba(203,213,225,0.8) 37%, rgba(226,232,240,0.6) 63%)',
    backgroundSize: '400% 100%',
    animation: 'llm-schema-pulse 1.4s ease infinite'
  }
};
