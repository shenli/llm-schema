import React from 'react';
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
                    (item as Record<string, unknown>) ?? {},
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

  if (isObjectField(field)) {
    return (
      <div className="llm-schema-field" data-kind="object" data-path={path}>
        <dt>{label}</dt>
        <dd>
          {renderNestedFields(
            field.shape,
            (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}) ?? {},
            path,
            components,
            config
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
  config?: RendererConfig
) {
  const entries = Object.entries(definition);
  if (entries.length === 0) {
    return <em>Empty</em>;
  }

  const record: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};

  return (
    <dl>
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
      {renderNestedFields(schema.getDefinition(), data, '', mergedComponents, config)}
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
        config
      )}
    </form>
  );
}
