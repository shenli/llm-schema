import type { CSSProperties } from 'react';

export interface RendererStyles {
  container?: CSSProperties;
  group?: CSSProperties;
  nestedGroup?: CSSProperties;
  field?: CSSProperties;
  nestedField?: CSSProperties;
  rootLabel?: CSSProperties;
  nestedLabel?: CSSProperties;
  label?: CSSProperties;
  value?: CSSProperties;
  list?: CSSProperties;
  listItem?: CSSProperties;
  listItemHeading?: CSSProperties;
  listItemBadge?: CSSProperties;
  missing?: CSSProperties;
  pending?: CSSProperties;
  button?: CSSProperties;
  buttonPrimary?: CSSProperties;
  buttonDanger?: CSSProperties;
  input?: CSSProperties;
  textarea?: CSSProperties;
  select?: CSSProperties;
  error?: CSSProperties;
  toolbar?: CSSProperties;
  diffAdded?: CSSProperties;
  diffRemoved?: CSSProperties;
  diffChanged?: CSSProperties;
  diffBefore?: CSSProperties;
  diffAfter?: CSSProperties;
  diffPath?: CSSProperties;
  entityChip?: CSSProperties;
}

export type RendererClassNames = Partial<Record<keyof RendererStyles, string>>;

const commonButton: CSSProperties = {
  padding: '6px 10px',
  fontSize: '0.85rem',
  borderRadius: '8px',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  background: '#ffffff',
  color: '#1f2937',
  cursor: 'pointer',
  lineHeight: 1,
  transition: 'background 120ms ease, border-color 120ms ease'
};

const commonInput: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '0.95rem',
  borderRadius: '8px',
  border: '1px solid rgba(148, 163, 184, 0.6)',
  background: '#ffffff',
  color: '#0f172a',
  boxSizing: 'border-box'
};

export const stylePresets: Record<'card' | 'plain', RendererStyles> = {
  card: {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      background: '#ffffff',
      borderRadius: '20px',
      padding: '24px',
      border: '1px solid rgba(226, 232, 240, 0.9)',
      boxShadow: '0 24px 60px rgba(15, 23, 42, 0.12)'
    },
    group: {
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '18px'
    },
    nestedGroup: {
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      background: 'rgba(248, 250, 252, 0.9)',
      borderRadius: '18px',
      border: '1px solid rgba(226, 232, 240, 0.9)',
      padding: '16px 18px'
    },
    nestedField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      background: '#ffffff',
      borderRadius: '14px',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      padding: '14px'
    },
    rootLabel: {
      fontWeight: 700,
      color: '#0f172a',
      fontSize: '1.05rem'
    },
    nestedLabel: {
      fontWeight: 600,
      color: '#1e293b',
      fontSize: '0.95rem'
    },
    label: {
      fontWeight: 600,
      color: '#0f172a',
      fontSize: '0.95rem'
    },
    value: {
      color: '#1f2937',
      fontSize: '0.95rem',
      lineHeight: 1.6,
      margin: 0
    },
    list: {
      margin: 0,
      padding: 0,
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px'
    },
    listItem: {
      background: '#ffffff',
      borderRadius: '14px',
      border: '1px solid rgba(226, 232, 240, 0.9)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    listItemHeading: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '0.85rem',
      fontWeight: 600,
      color: '#64748b'
    },
    listItemBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 24,
      height: 24,
      borderRadius: 999,
      background: '#eef2ff',
      color: '#4338ca',
      fontWeight: 700,
      fontSize: '0.75rem'
    },
    missing: {
      color: '#94a3b8',
      fontStyle: 'italic'
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
    },
    button: commonButton,
    buttonPrimary: {
      ...commonButton,
      background: '#4338ca',
      color: '#ffffff',
      border: '1px solid #4338ca'
    },
    buttonDanger: {
      ...commonButton,
      color: '#b91c1c',
      borderColor: 'rgba(239, 68, 68, 0.4)'
    },
    input: commonInput,
    textarea: { ...commonInput, resize: 'vertical', minHeight: 80, lineHeight: 1.5 },
    select: commonInput,
    error: {
      color: '#b91c1c',
      fontSize: '0.85rem',
      margin: 0
    },
    toolbar: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    diffAdded: {
      background: 'rgba(34, 197, 94, 0.08)',
      borderLeft: '3px solid rgba(34, 197, 94, 0.8)',
      padding: '8px 12px',
      borderRadius: 8
    },
    diffRemoved: {
      background: 'rgba(239, 68, 68, 0.08)',
      borderLeft: '3px solid rgba(239, 68, 68, 0.8)',
      padding: '8px 12px',
      borderRadius: 8
    },
    diffChanged: {
      background: 'rgba(234, 179, 8, 0.08)',
      borderLeft: '3px solid rgba(234, 179, 8, 0.8)',
      padding: '8px 12px',
      borderRadius: 8
    },
    diffBefore: {
      color: '#b91c1c',
      textDecoration: 'line-through',
      opacity: 0.8
    },
    diffAfter: {
      color: '#166534'
    },
    diffPath: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.8rem',
      color: '#475569'
    },
    entityChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px',
      borderRadius: 999,
      background: '#eef2ff',
      color: '#4338ca',
      fontSize: '0.85rem',
      fontWeight: 500
    }
  },
  plain: {
    container: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    },
    group: {
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    },
    nestedGroup: {
      margin: 0,
      padding: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    field: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      padding: '4px 0'
    },
    nestedField: {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      padding: '2px 0'
    },
    rootLabel: {
      fontWeight: 700,
      color: '#111827',
      fontSize: '1rem'
    },
    nestedLabel: {
      fontWeight: 600,
      color: '#111827',
      fontSize: '0.95rem'
    },
    label: {
      fontWeight: 600,
      color: '#111827',
      fontSize: '0.95rem'
    },
    value: {
      color: '#1f2937',
      fontSize: '0.95rem',
      lineHeight: 1.6,
      margin: 0
    },
    list: {
      margin: 0,
      padding: 0,
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px'
    },
    listItem: {
      padding: '0 0 8px',
      borderBottom: '1px solid rgba(209, 213, 219, 0.5)'
    },
    listItemHeading: {
      fontWeight: 600,
      color: '#6b7280',
      fontSize: '0.85rem',
      marginBottom: '6px'
    },
    missing: {
      color: '#6b7280',
      fontStyle: 'italic'
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
    },
    button: commonButton,
    buttonPrimary: {
      ...commonButton,
      background: '#111827',
      color: '#ffffff',
      border: '1px solid #111827'
    },
    buttonDanger: {
      ...commonButton,
      color: '#b91c1c',
      borderColor: 'rgba(239, 68, 68, 0.4)'
    },
    input: commonInput,
    textarea: { ...commonInput, resize: 'vertical', minHeight: 80, lineHeight: 1.5 },
    select: commonInput,
    error: {
      color: '#b91c1c',
      fontSize: '0.85rem',
      margin: 0
    },
    toolbar: {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'wrap'
    },
    diffAdded: {
      background: 'rgba(34, 197, 94, 0.08)',
      padding: '6px 8px',
      borderRadius: 6
    },
    diffRemoved: {
      background: 'rgba(239, 68, 68, 0.08)',
      padding: '6px 8px',
      borderRadius: 6
    },
    diffChanged: {
      background: 'rgba(234, 179, 8, 0.08)',
      padding: '6px 8px',
      borderRadius: 6
    },
    diffBefore: {
      color: '#b91c1c',
      textDecoration: 'line-through',
      opacity: 0.8
    },
    diffAfter: {
      color: '#166534'
    },
    diffPath: {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '0.8rem',
      color: '#475569'
    },
    entityChip: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 6px',
      borderRadius: 6,
      background: '#f3f4f6',
      color: '#1f2937',
      fontSize: '0.9rem'
    }
  }
};

export function mergeRendererStyles(
  preset: RendererStyles,
  overrides?: Partial<RendererStyles>
): RendererStyles {
  if (!overrides) return preset;
  const merged: RendererStyles = { ...preset };
  (Object.keys(overrides) as (keyof RendererStyles)[]).forEach((key) => {
    const override = overrides[key];
    if (override) {
      merged[key] = { ...(preset[key] ?? {}), ...override };
    }
  });
  return merged;
}

export function pickClassName(
  classNames: RendererClassNames | undefined,
  key: keyof RendererStyles
): string | undefined {
  return classNames?.[key];
}

export function joinClassNames(...parts: Array<string | null | undefined | false>): string | undefined {
  const filtered = parts.filter(Boolean) as string[];
  return filtered.length > 0 ? filtered.join(' ') : undefined;
}
