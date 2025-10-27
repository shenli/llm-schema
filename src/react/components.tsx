import React from 'react';
import type { Schema } from '../schema/builder';
import type {
  AnyFieldDefinition,
  ParseIssue,
  SchemaDefinition,
  SchemaOutput
} from '../schema/types';

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
}

const defaultComponents: RendererComponents = {
  text: ({ value }) => <span>{String(value ?? '')}</span>,
  markdown: ({ value }) => (
    <div className="llm-schema-markdown">
      <pre>{String(value ?? '')}</pre>
    </div>
  ),
  number: ({ value }) => <span>{value}</span>,
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
  return config?.hiddenFields?.includes(path) ?? false;
}

function renderFieldValue(
  field: AnyFieldDefinition,
  value: unknown,
  path: string,
  components: RendererComponents,
  config?: RendererConfig
): React.ReactNode {
  const label =
    config?.labelFormatter?.({ path, field }) ??
    formatLabel(path.split('.').slice(-1)[0] ?? path);

  const renderPrimitive = (kind: keyof RendererComponents) => (
    <div className="llm-schema-field" data-kind={kind} data-path={path}>
      <dt>{label}</dt>
      <dd>{components[kind]?.({ value, field, path, label })}</dd>
    </div>
  );

  switch (field.kind) {
    case 'text':
      return renderPrimitive('text');
    case 'markdown':
      return renderPrimitive('markdown');
    case 'number':
      return renderPrimitive('number');
    case 'boolean':
      return renderPrimitive('boolean');
    case 'date':
      return renderPrimitive('date');
    case 'enum':
      return renderPrimitive('enum');
    case 'entity':
      return renderPrimitive('entity');
    case 'array': {
      const items = Array.isArray(value) ? value : [];
      return (
        <div className="llm-schema-field" data-kind="array" data-path={path}>
          <dt>{label}</dt>
          <dd>
            {items.length === 0 ? (
              <em>No entries</em>
            ) : (
              <ol>
                {items.map((item, index) => (
                  <li key={index}>
                    {renderNestedFields(
                      field.itemDefinition,
                      item as Record<string, unknown>,
                      `${path}.${index}`,
                      components,
                      config
                    )}
                  </li>
                ))}
              </ol>
            )}
          </dd>
        </div>
      );
    }
    case 'object': {
      return (
        <div className="llm-schema-field" data-kind="object" data-path={path}>
          <dt>{label}</dt>
          <dd>
            {renderNestedFields(field.shape, (value as Record<string, unknown>) ?? {}, path, components, config)}
          </dd>
        </div>
      );
    }
    default:
      return renderPrimitive('text');
  }
}

function renderNestedFields(
  definition: SchemaDefinition,
  data: Record<string, unknown>,
  parentPath: string,
  components: RendererComponents,
  config?: RendererConfig
) {
  const entries = Object.entries(definition);
  if (entries.length === 0) {
    return <em>Empty</em>;
  }

  return (
    <dl>
      {entries.map(([key, childField]) => {
        const path = parentPath ? `${parentPath}.${key}` : key;
        const value = (data as Record<string, unknown>)[key];

        if (isHidden(path, config)) {
          return null;
        }

        if (value === undefined && !config?.showOptionalFields && childField.optional) {
          return null;
        }

        if (value === undefined && config?.showOptionalFields) {
          return (
            <div key={path} className="llm-schema-field llm-schema-field--missing" data-path={path}>
              <dt>{formatLabel(key)}</dt>
              <dd>
                <em>Not provided</em>
              </dd>
            </div>
          );
        }

        return (
          <React.Fragment key={path}>
            {renderFieldValue(childField, value, path, components, config)}
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
}

export function SchemaRenderer<Definition extends SchemaDefinition>({
  schema,
  data,
  components,
  config
}: SchemaRendererProps<Definition>) {
  const mergedComponents: RendererComponents = {
    ...defaultComponents,
    ...(components ?? {})
  };

  return (
    <div className={`llm-schema-renderer llm-schema-renderer--${config?.layout ?? 'stack'}`}>
      {renderNestedFields(schema.getDefinition(), data as Record<string, unknown>, '', mergedComponents, config)}
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
  const mergedComponents: RendererComponents = {
    ...defaultComponents,
    ...(components ?? {})
  };

  return (
    <dl className="llm-schema-fieldset">
      {renderFieldValue(field, value, path, mergedComponents, config)}
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

function updatePathValue<T extends Record<string, unknown>>(source: T, path: string[], value: unknown): T {
  if (path.length === 0) return source;

  const [head, ...rest] = path;
  const clone: Record<string, unknown> = Array.isArray(source) ? [...(source as unknown[])] : { ...source };

  if (rest.length === 0) {
    clone[head] = value as never;
    return clone as T;
  }

  const current = (clone[head] ?? {}) as Record<string, unknown>;
  clone[head] = updatePathValue(current, rest, value);
  return clone as T;
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

  const handleChange = React.useCallback(
    (path: string, value: unknown) => {
      const parts = path.split('.').filter(Boolean);
      const updated = updatePathValue(data as Record<string, unknown>, parts, value) as SchemaOutput<Definition>;
      onChange(updated);
    },
    [data, onChange]
  );

  const renderInput = (field: AnyFieldDefinition, value: unknown, path: string) => {
    switch (field.kind) {
      case 'text':
      case 'entity':
        return (
          <input
            type="text"
            disabled={disabled}
            value={value ?? ''}
            onChange={(event) => handleChange(path, event.target.value)}
          />
        );
      case 'markdown':
        return (
          <textarea
            disabled={disabled}
            value={value ?? ''}
            rows={6}
            onChange={(event) => handleChange(path, event.target.value)}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            disabled={disabled}
            value={value ?? ''}
            onChange={(event) => {
              const next = event.target.value === '' ? undefined : Number(event.target.value);
              handleChange(path, Number.isNaN(next as number) ? undefined : next);
            }}
          />
        );
      case 'boolean':
        return (
          <input
            type="checkbox"
            disabled={disabled}
            checked={Boolean(value)}
            onChange={(event) => handleChange(path, event.target.checked)}
          />
        );
      case 'date': {
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
      case 'enum':
        return (
          <select
            disabled={disabled}
            value={(value as string | undefined) ?? ''}
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
      case 'array':
      case 'object':
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
      default:
        return <input disabled value={String(value ?? '')} onChange={() => undefined} />;
    }
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
      {renderNestedFields(definition, data as Record<string, unknown>, '', {
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
      })}
    </form>
  );
}
