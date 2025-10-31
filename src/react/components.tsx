import React from 'react';
import type { CSSProperties } from 'react';
import type { Schema } from '../schema/builder';
import type {
  AnyFieldDefinition,
  ParseIssue,
  SchemaDefinition,
  SchemaOutput
} from '../schema/types';
import {
  isArrayField,
  isBooleanField,
  isDateField,
  isEntityField,
  isEnumField,
  isMarkdownField,
  isNumberField,
  isObjectField,
  isTextField
} from '../schema/typeGuards';
import { MarkdownField } from './MarkdownField';

type FieldComponentProps = {
  value: unknown;
  field: AnyFieldDefinition;
  path: string;
  label: string;
};

type FieldRenderer = (props: FieldComponentProps) => React.ReactNode;

export interface RendererComponents {
  text: FieldRenderer;
  markdown: FieldRenderer;
  number: FieldRenderer;
  boolean: FieldRenderer;
  date: FieldRenderer;
  enum: FieldRenderer;
  entity: FieldRenderer;
}

export interface RendererConfig {
  layout?: 'stack' | 'grid';
  showOptionalFields?: boolean;
  hiddenFields?: string[];
  labelFormatter?: (params: { path: string; field: AnyFieldDefinition }) => string;
  stylePreset?: 'card' | 'plain';
  styles?: Partial<RendererStyles>;
}

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
}

const stylePresets: Record<'card' | 'plain', RendererStyles> = {
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
      fontSize: '1.05rem',
      textTransform: 'none'
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
    }
  }
};

function mergeRendererStyles(
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

const defaultComponents: RendererComponents = {
  text: ({ value }) => <span>{String(value ?? '')}</span>,
  markdown: ({ value }) => {
    const content =
      typeof value === 'string' ? value : value == null ? '' : String(value);
    return <MarkdownField content={content} className="llm-schema-renderer__markdown" />;
  },
  number: ({ value }) => <span>{String(value ?? '')}</span>,
  boolean: ({ value }) => <span>{value ? 'Yes' : 'No'}</span>,
  date: ({ value }) => {
    if (value instanceof Date) {
      return <time dateTime={value.toISOString()}>{value.toLocaleString()}</time>;
    }
    if (typeof value === 'string') {
      return <time dateTime={value}>{value}</time>;
    }
    return <span>{String(value ?? '')}</span>;
  },
  enum: ({ value }) => <span>{String(value ?? '')}</span>,
  entity: ({ value }) => <code>{String(value ?? '')}</code>
};

function formatLabel(key: string) {
  const withSpaces = key.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function isHidden(path: string, config?: RendererConfig) {
  if (!config?.hiddenFields?.length) return false;
  return config.hiddenFields.some((hidden) => path === hidden || path.startsWith(`${hidden}.`));
}

function renderFieldValue(
  field: AnyFieldDefinition,
  value: unknown,
  path: string,
  components: RendererComponents,
  config: RendererConfig | undefined,
  styles: RendererStyles,
  depth: number
): React.ReactNode {
  const label =
    config?.labelFormatter?.({ path, field }) ??
    formatLabel(path.split('.').slice(-1)[0] ?? path);
  const fieldStyle =
    depth === 0
      ? styles.field
      : styles.nestedField ?? styles.field;
  const labelStyle =
    depth === 0
      ? styles.rootLabel ?? styles.label
      : styles.nestedLabel ?? styles.label ?? undefined;

  const renderPrimitive = (kind: keyof RendererComponents) => (
    <div
      className="llm-schema-field"
      data-kind={kind}
      data-path={path}
      style={fieldStyle}
    >
      <dt style={labelStyle}>{label}</dt>
      <dd style={styles.value}>
        {components[kind]?.({ value, field, path, label })}
      </dd>
    </div>
  );

  if (isTextField(field)) return renderPrimitive('text');
  if (isMarkdownField(field)) return renderPrimitive('markdown');
  if (isNumberField(field)) return renderPrimitive('number');
  if (isBooleanField(field)) return renderPrimitive('boolean');
  if (isDateField(field)) return renderPrimitive('date');
  if (isEnumField(field)) return renderPrimitive('enum');
  if (isEntityField(field)) return renderPrimitive('entity');

  if (isArrayField(field)) {
    const items = Array.isArray(value) ? value : [];
    return (
      <div
        className="llm-schema-field"
        data-kind="array"
        data-path={path}
        style={fieldStyle}
      >
        <dt style={styles.label}>{label}</dt>
        <dd style={styles.value}>
          {items.length === 0 ? (
            <em style={styles.missing}>No entries</em>
          ) : (
            <ol style={styles.list}>
              {items.map((item, index) => (
                <li key={index} style={styles.listItem}>
                  {styles.listItemHeading && (
                    <div style={styles.listItemHeading}>
                      {styles.listItemBadge ? (
                        <span style={styles.listItemBadge}>{index + 1}</span>
                      ) : (
                        <strong>#{index + 1}</strong>
                      )}
                      <span>Item {index + 1}</span>
                    </div>
                  )}
                  {renderNestedFields(
                    field.itemDefinition,
                    (item as Record<string, unknown>) ?? {},
                    `${path}.${index}`,
                    components,
                    config,
                    styles,
                    depth + 1
                  )}
                </li>
              ))}
            </ol>
          )}
        </dd>
      </div>
    );
  }

  if (isObjectField(field)) {
    return (
      <div
        className="llm-schema-field"
        data-kind="object"
        data-path={path}
        style={fieldStyle}
      >
        <dt style={labelStyle}>{label}</dt>
        <dd style={styles.value}>
          {renderNestedFields(
            field.shape,
            (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}) ?? {},
            path,
            components,
            config,
            styles,
            depth + 1
          )}
        </dd>
      </div>
    );
  }

  return renderPrimitive('text');
}

function renderNestedFields(
  definition: SchemaDefinition,
  data: unknown,
  parentPath: string,
  components: RendererComponents,
  config: RendererConfig | undefined,
  styles: RendererStyles,
  depth = 0
) {
  const entries = Object.entries(definition);
  if (entries.length === 0) {
    return <em>Empty</em>;
  }

  const record: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};

  return (
    <dl
      className="llm-schema-group"
      style={depth === 0 ? styles.group : styles.nestedGroup ?? styles.group}
    >
      {entries.map(([key, childField]) => {
        const path = parentPath ? `${parentPath}.${key}` : key;
        const value = record[key];

        if (isHidden(path, config)) {
          return null;
        }

        if (value === undefined && !config?.showOptionalFields && childField.optional) {
          return null;
        }

        if (value === undefined && config?.showOptionalFields) {
          return (
            <div
              key={path}
              className="llm-schema-field llm-schema-field--missing"
              data-path={path}
              style={depth === 0 ? styles.field : styles.nestedField ?? styles.field}
            >
              <dt style={styles.label}>{formatLabel(key)}</dt>
              <dd style={{ ...(styles.value ?? {}), ...(styles.missing ?? {}) }}>
                Not provided
              </dd>
            </div>
          );
        }

        return (
          <React.Fragment key={path}>
            {renderFieldValue(childField, value, path, components, config, styles, depth)}
          </React.Fragment>
        );
      })}
    </dl>
  );
}

export interface SchemaRendererProps<Definition extends SchemaDefinition> {
  schema: Schema<Definition>;
  data: SchemaOutput<Definition>;
  components?: Partial<RendererComponents>;
  config?: RendererConfig;
  markdownRenderer?: (content: string) => React.ReactNode;
}

export function SchemaRenderer<Definition extends SchemaDefinition>({
  schema,
  data,
  components,
  config,
  markdownRenderer
}: SchemaRendererProps<Definition>) {
  const styles = React.useMemo(
    () => mergeRendererStyles(stylePresets[config?.stylePreset ?? 'card'], config?.styles),
    [config?.stylePreset, config?.styles]
  );

  const mergedComponents: RendererComponents = {
    ...defaultComponents,
    ...(components ?? {})
  };

  if (markdownRenderer) {
    mergedComponents.markdown = ({ value }) =>
      markdownRenderer(typeof value === 'string' ? value : value == null ? '' : String(value));
  }

  return (
    <div
      className={[
        'llm-schema-renderer',
        config?.layout ? `llm-schema-renderer--${config.layout}` : null
      ]
        .filter(Boolean)
        .join(' ')}
      style={styles.container}
    >
      {renderNestedFields(schema.getDefinition(), data, '', mergedComponents, config, styles)}
    </div>
  );
}

export interface SchemaFieldProps {
  field: AnyFieldDefinition;
  value: unknown;
  path?: string;
  components?: Partial<RendererComponents>;
  config?: RendererConfig;
}

export function SchemaField({
  field,
  value,
  path = field.kind,
  components,
  config
}: SchemaFieldProps) {
  const styles = React.useMemo(
    () => mergeRendererStyles(stylePresets[config?.stylePreset ?? 'card'], config?.styles),
    [config?.stylePreset, config?.styles]
  );

  const mergedComponents: RendererComponents = {
    ...defaultComponents,
    ...(components ?? {})
  };

  return (
    <dl className="llm-schema-fieldset" style={styles.group}>
      {renderFieldValue(field, value, path, mergedComponents, config, styles, 0)}
    </dl>
  );
}

export interface SchemaEditorProps<Definition extends SchemaDefinition> {
  schema: Schema<Definition>;
  data: SchemaOutput<Definition>;
  onChange: (next: SchemaOutput<Definition>) => void;
  config?: RendererConfig;
  disabled?: boolean;
  validationIssues?: ParseIssue[];
}

function updatePathValue(source: unknown, path: string[], nextValue: unknown): unknown {
  if (path.length === 0) return nextValue;

  const [head, ...rest] = path;

  if (Array.isArray(source)) {
    const index = Number(head);
    const clone = [...source];
    clone[index] = updatePathValue(clone[index], rest, nextValue);
    return clone;
  }

  const record: Record<string, unknown> =
    source && typeof source === 'object' ? { ...(source as Record<string, unknown>) } : {};

  record[head] = updatePathValue(record[head], rest, nextValue);
  return record;
}

function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null, null, 2);
}

export function SchemaEditor<Definition extends SchemaDefinition>({
  schema,
  data,
  onChange,
  config,
  disabled,
  validationIssues
}: SchemaEditorProps<Definition>) {
  const definition = schema.getDefinition();
  const styles = React.useMemo(
    () => mergeRendererStyles(stylePresets[config?.stylePreset ?? 'plain'], config?.styles),
    [config?.stylePreset, config?.styles]
  );

  const handleChange = React.useCallback(
    (path: string, value: unknown) => {
      const parts = path.split('.').filter(Boolean);
      const updated = updatePathValue(data, parts, value) as SchemaOutput<Definition>;
      onChange(updated);
    },
    [data, onChange]
  );

  const renderInput = (field: AnyFieldDefinition, value: unknown, path: string) => {
    if (isTextField(field) || isEntityField(field)) {
      const inputValue = typeof value === 'string' ? value : '';
      return (
        <input
          type="text"
          disabled={disabled}
          value={inputValue}
          onChange={(event) => handleChange(path, event.target.value)}
        />
      );
    }

    if (isMarkdownField(field)) {
      const inputValue = typeof value === 'string' ? value : '';
      return (
        <textarea
          disabled={disabled}
          value={inputValue}
          rows={6}
          onChange={(event) => handleChange(path, event.target.value)}
        />
      );
    }

    if (isNumberField(field)) {
      const inputValue = typeof value === 'number' ? value : '';
      return (
        <input
          type="number"
          disabled={disabled}
          value={inputValue}
          onChange={(event) => {
            const nextRaw = event.target.value;
            if (nextRaw === '') {
              handleChange(path, undefined);
              return;
            }
            const next = Number(nextRaw);
            handleChange(path, Number.isNaN(next) ? undefined : next);
          }}
        />
      );
    }

    if (isBooleanField(field)) {
      return (
        <input
          type="checkbox"
          disabled={disabled}
          checked={Boolean(value)}
          onChange={(event) => handleChange(path, event.target.checked)}
        />
      );
    }

    if (isDateField(field)) {
      const format = field.options.format === 'date' ? 'date' : 'datetime-local';
      const inputValue =
        value instanceof Date
          ? field.options.format === 'date'
            ? value.toISOString().slice(0, 10)
            : value.toISOString().slice(0, 16)
          : typeof value === 'string'
            ? value
            : '';
      return (
        <input
          type={format}
          disabled={disabled}
          value={inputValue}
          onChange={(event) => {
            const next = event.target.value;
            handleChange(path, next ? new Date(next) : undefined);
          }}
        />
      );
    }

    if (isEnumField(field)) {
      const selected = typeof value === 'string' ? value : '';
      return (
        <select
          disabled={disabled}
          value={selected}
          onChange={(event) => handleChange(path, event.target.value)}
        >
          <option value="" disabled>
            Select…
          </option>
          {field.values.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    if (isArrayField(field) || isObjectField(field)) {
      return (
        <textarea
          disabled={disabled}
          value={serializeJson(value)}
          rows={8}
          onChange={(event) => {
            try {
              const parsed = JSON.parse(event.target.value);
              handleChange(path, parsed);
            } catch {
              // ignore parse errors, leave current data intact
            }
          }}
        />
      );
    }

    return <input disabled value={String(value ?? '')} onChange={() => undefined} />;
  };

  const issuesByPath = React.useMemo(() => {
    if (!validationIssues?.length) {
      return new Map<string, ParseIssue[]>();
    }
    return validationIssues.reduce((map, item) => {
      const key = item.path.join('.');
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(item);
      return map;
    }, new Map<string, ParseIssue[]>());
  }, [validationIssues]);

  return (
    <form className={`llm-schema-editor llm-schema-editor--${config?.layout ?? 'stack'}`}>
      {renderNestedFields(
        definition,
        data as Record<string, unknown>,
        '',
        {
          ...defaultComponents,
          text: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field">
              <label>
                <span>{label}</span>
                {renderInput(field, value, fieldPath)}
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          ),
          markdown: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field">
              <label>
                <span>{label}</span>
                {renderInput(field, value, fieldPath)}
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          ),
          number: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field">
              <label>
                <span>{label}</span>
                {renderInput(field, value, fieldPath)}
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          ),
          boolean: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field llm-schema-editor-field--boolean">
              <label>
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={Boolean(value)}
                  onChange={(event) => handleChange(fieldPath, event.target.checked)}
                />
                <span>{label}</span>
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          ),
          date: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field">
              <label>
                <span>{label}</span>
                {renderInput(field, value, fieldPath)}
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          ),
          enum: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field">
              <label>
                <span>{label}</span>
                {renderInput(field, value, fieldPath)}
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          ),
          entity: ({ value, field, path: fieldPath, label }) => (
            <div className="llm-schema-editor-field">
              <label>
                <span>{label}</span>
                {renderInput(field, value, fieldPath)}
              </label>
              {issuesByPath.get(fieldPath)?.map((issue, index) => (
                <p key={index} className="llm-schema-editor-error">
                  {issue.message}
                </p>
              ))}
            </div>
          )
        },
        config,
        styles
      )}
    </form>
  );
}
