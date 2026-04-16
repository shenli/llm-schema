import React from 'react';
import type { Schema } from '../schema/builder';
import type {
  AnyFieldDefinition,
  ArrayFieldDefinition,
  ObjectFieldDefinition,
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
import type { RendererClassNames, RendererStyles } from './styles';
import { mergeRendererStyles, stylePresets, joinClassNames } from './styles';
import { useEntitiesOfType } from './EntityProvider';
import type { RendererConfig } from './components';

export interface SchemaEditorProps<Definition extends SchemaDefinition> {
  schema: Schema<Definition>;
  data: SchemaOutput<Definition>;
  onChange: (next: SchemaOutput<Definition>) => void;
  config?: RendererConfig;
  disabled?: boolean;
  validationIssues?: ParseIssue[];
}

function formatLabel(key: string) {
  const withSpaces = key.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function updatePathValue(source: unknown, path: Array<string | number>, next: unknown): unknown {
  if (path.length === 0) return next;
  const [head, ...rest] = path;

  if (Array.isArray(source) || typeof head === 'number') {
    const base = Array.isArray(source) ? source : [];
    const clone = [...base];
    const index = Number(head);
    clone[index] = updatePathValue(clone[index], rest, next);
    return clone;
  }

  const record: Record<string, unknown> =
    source && typeof source === 'object' ? { ...(source as Record<string, unknown>) } : {};
  record[head] = updatePathValue(record[head], rest, next);
  return record;
}

function getAtPath(source: unknown, path: Array<string | number>): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (current == null) return undefined;
    if (Array.isArray(current) && typeof segment === 'number') {
      current = current[segment];
    } else if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[String(segment)];
    } else {
      return undefined;
    }
  }
  return current;
}

function pathKey(path: Array<string | number>): string {
  return path.join('.');
}

function emptyValueForField(field: AnyFieldDefinition): unknown {
  if (isTextField(field) || isMarkdownField(field) || isEntityField(field)) return '';
  if (isNumberField(field)) return 0;
  if (isBooleanField(field)) return false;
  if (isDateField(field)) return undefined;
  if (isEnumField(field)) return field.values[0] ?? '';
  if (isArrayField(field)) return [];
  if (isObjectField(field)) {
    const out: Record<string, unknown> = {};
    for (const [k, f] of Object.entries(field.shape)) {
      out[k] = emptyValueForField(f as AnyFieldDefinition);
    }
    return out;
  }
  return undefined;
}

function useIssuesByPath(issues?: ParseIssue[]): Map<string, ParseIssue[]> {
  return React.useMemo(() => {
    const map = new Map<string, ParseIssue[]>();
    if (!issues) return map;
    for (const item of issues) {
      const key = item.path.join('.');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return map;
  }, [issues]);
}

function EntityInput({
  value,
  type,
  disabled,
  styles,
  classNames,
  onChange
}: {
  value: string;
  type: string;
  disabled?: boolean;
  styles: RendererStyles;
  classNames?: RendererClassNames;
  onChange: (next: string) => void;
}) {
  const options = useEntitiesOfType(type);
  const listId = React.useId();
  return (
    <>
      <input
        type="text"
        list={listId}
        value={value}
        disabled={disabled}
        style={styles.input}
        className={joinClassNames(classNames?.input)}
        placeholder={`Enter ${type}`}
        onChange={(e) => onChange(e.target.value)}
      />
      {options.length > 0 && (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </datalist>
      )}
    </>
  );
}

function isHidden(path: Array<string | number>, config?: RendererConfig) {
  if (!config?.hiddenFields?.length) return false;
  const pathStr = path.join('.');
  return config.hiddenFields.some((hidden) => pathStr === hidden || pathStr.startsWith(`${hidden}.`));
}

interface RenderContext {
  styles: RendererStyles;
  classNames?: RendererClassNames;
  disabled?: boolean;
  issuesByPath: Map<string, ParseIssue[]>;
  setPath: (path: Array<string | number>, next: unknown) => void;
  config?: RendererConfig;
}

function FieldErrors({
  path,
  ctx
}: {
  path: Array<string | number>;
  ctx: RenderContext;
}) {
  const issues = ctx.issuesByPath.get(pathKey(path));
  if (!issues || issues.length === 0) return null;
  return (
    <>
      {issues.map((issue, index) => (
        <p
          key={index}
          style={ctx.styles.error}
          className={joinClassNames('llm-schema-editor-error', ctx.classNames?.error)}
        >
          {issue.message}
        </p>
      ))}
    </>
  );
}

function PrimitiveInput({
  field,
  value,
  path,
  ctx
}: {
  field: AnyFieldDefinition;
  value: unknown;
  path: Array<string | number>;
  ctx: RenderContext;
}) {
  const { styles, classNames, disabled, setPath } = ctx;

  if (isTextField(field)) {
    return (
      <input
        type="text"
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        style={styles.input}
        className={joinClassNames(classNames?.input)}
        onChange={(e) => setPath(path, e.target.value)}
      />
    );
  }

  if (isMarkdownField(field)) {
    return (
      <textarea
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        rows={6}
        style={styles.textarea}
        className={joinClassNames(classNames?.textarea)}
        onChange={(e) => setPath(path, e.target.value)}
      />
    );
  }

  if (isNumberField(field)) {
    return (
      <input
        type="number"
        disabled={disabled}
        value={typeof value === 'number' ? value : ''}
        style={styles.input}
        className={joinClassNames(classNames?.input)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return setPath(path, undefined);
          const n = Number(raw);
          setPath(path, Number.isNaN(n) ? undefined : n);
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
        onChange={(e) => setPath(path, e.target.checked)}
      />
    );
  }

  if (isDateField(field)) {
    const type = field.options.format === 'date' ? 'date' : 'datetime-local';
    const dateValue =
      value instanceof Date
        ? type === 'date'
          ? value.toISOString().slice(0, 10)
          : value.toISOString().slice(0, 16)
        : typeof value === 'string'
          ? value
          : '';
    return (
      <input
        type={type}
        disabled={disabled}
        value={dateValue}
        style={styles.input}
        className={joinClassNames(classNames?.input)}
        onChange={(e) => {
          const next = e.target.value;
          setPath(path, next ? new Date(next) : undefined);
        }}
      />
    );
  }

  if (isEnumField(field)) {
    return (
      <select
        disabled={disabled}
        value={typeof value === 'string' ? value : ''}
        style={styles.select}
        className={joinClassNames(classNames?.select)}
        onChange={(e) => setPath(path, e.target.value)}
      >
        <option value="" disabled>
          Select…
        </option>
        {field.values.map((option) => (
          <option key={option} value={option}>
            {field.options.labels?.[option] ?? option}
          </option>
        ))}
      </select>
    );
  }

  if (isEntityField(field)) {
    return (
      <EntityInput
        type={field.entityType}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        styles={styles}
        classNames={classNames}
        onChange={(next) => setPath(path, next)}
      />
    );
  }

  return null;
}

function renderLeaf(
  key: string,
  field: AnyFieldDefinition,
  value: unknown,
  path: Array<string | number>,
  ctx: RenderContext,
  depth: number
): React.ReactNode {
  const { styles, classNames } = ctx;
  const label = ctx.config?.labelFormatter?.({ path: pathKey(path), field }) ?? formatLabel(key);
  const fieldStyle = depth === 0 ? styles.field : styles.nestedField ?? styles.field;
  const fieldClass = joinClassNames(
    'llm-schema-editor-field',
    depth === 0 ? classNames?.field : classNames?.nestedField ?? classNames?.field
  );

  if (isBooleanField(field)) {
    return (
      <div className={fieldClass} data-path={pathKey(path)} style={fieldStyle}>
        <label
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        >
          <input
            type="checkbox"
            disabled={ctx.disabled}
            checked={Boolean(value)}
            onChange={(e) => ctx.setPath(path, e.target.checked)}
          />
          <span
            style={depth === 0 ? styles.rootLabel ?? styles.label : styles.nestedLabel ?? styles.label}
            className={joinClassNames(classNames?.label)}
          >
            {label}
          </span>
        </label>
        <FieldErrors path={path} ctx={ctx} />
      </div>
    );
  }

  return (
    <div className={fieldClass} data-path={pathKey(path)} style={fieldStyle}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span
          style={depth === 0 ? styles.rootLabel ?? styles.label : styles.nestedLabel ?? styles.label}
          className={joinClassNames(classNames?.label)}
        >
          {label}
          {field.description ? (
            <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 6, fontSize: '0.85rem' }}>
              — {field.description}
            </span>
          ) : null}
        </span>
        <PrimitiveInput field={field} value={value} path={path} ctx={ctx} />
      </label>
      <FieldErrors path={path} ctx={ctx} />
    </div>
  );
}

function renderArrayField(
  key: string,
  field: ArrayFieldDefinition<SchemaDefinition, boolean>,
  value: unknown,
  path: Array<string | number>,
  ctx: RenderContext,
  depth: number
): React.ReactNode {
  const items = Array.isArray(value) ? value : [];
  const { styles, classNames } = ctx;
  const label = ctx.config?.labelFormatter?.({ path: pathKey(path), field }) ?? formatLabel(key);
  const fieldStyle = depth === 0 ? styles.field : styles.nestedField ?? styles.field;
  const fieldClass = joinClassNames(
    'llm-schema-editor-field',
    'llm-schema-editor-field--array',
    depth === 0 ? classNames?.field : classNames?.nestedField ?? classNames?.field
  );

  const emptyItem = () => {
    const out: Record<string, unknown> = {};
    for (const [k, f] of Object.entries(field.itemDefinition)) {
      out[k] = emptyValueForField(f as AnyFieldDefinition);
    }
    return out;
  };

  const addItem = () => {
    const next = [...items, emptyItem()];
    ctx.setPath(path, next);
  };

  const removeAt = (index: number) => {
    const next = items.filter((_, i) => i !== index);
    ctx.setPath(path, next);
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    ctx.setPath(path, next);
  };

  return (
    <div className={fieldClass} data-path={pathKey(path)} style={fieldStyle}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
      >
        <span
          style={depth === 0 ? styles.rootLabel ?? styles.label : styles.nestedLabel ?? styles.label}
          className={joinClassNames(classNames?.label)}
        >
          {label} ({items.length})
        </span>
        <button
          type="button"
          disabled={ctx.disabled}
          onClick={addItem}
          style={styles.buttonPrimary}
          className={joinClassNames(classNames?.buttonPrimary, classNames?.button)}
        >
          + Add
        </button>
      </div>
      <FieldErrors path={path} ctx={ctx} />
      {items.length === 0 ? (
        <em style={styles.missing} className={joinClassNames(classNames?.missing)}>
          No items yet
        </em>
      ) : (
        <ol style={styles.list} className={joinClassNames(classNames?.list)}>
          {items.map((item, index) => {
            const itemPath: Array<string | number> = [...path, index];
            return (
              <li
                key={index}
                style={styles.listItem}
                className={joinClassNames('llm-schema-editor-list-item', classNames?.listItem)}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8
                  }}
                >
                  <span
                    style={styles.listItemHeading}
                    className={joinClassNames(classNames?.listItemHeading)}
                  >
                    {styles.listItemBadge ? (
                      <span
                        style={styles.listItemBadge}
                        className={joinClassNames(classNames?.listItemBadge)}
                      >
                        {index + 1}
                      </span>
                    ) : (
                      <strong>#{index + 1}</strong>
                    )}
                    <span>Item {index + 1}</span>
                  </span>
                  <div style={styles.toolbar} className={joinClassNames(classNames?.toolbar)}>
                    <button
                      type="button"
                      disabled={ctx.disabled || index === 0}
                      onClick={() => moveItem(index, index - 1)}
                      style={styles.button}
                      className={joinClassNames(classNames?.button)}
                      aria-label={`Move item ${index + 1} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={ctx.disabled || index === items.length - 1}
                      onClick={() => moveItem(index, index + 1)}
                      style={styles.button}
                      className={joinClassNames(classNames?.button)}
                      aria-label={`Move item ${index + 1} down`}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      disabled={ctx.disabled}
                      onClick={() => removeAt(index)}
                      style={styles.buttonDanger}
                      className={joinClassNames(classNames?.buttonDanger, classNames?.button)}
                      aria-label={`Remove item ${index + 1}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                {renderDefinitionFields(
                  field.itemDefinition,
                  item,
                  itemPath,
                  ctx,
                  depth + 1
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function renderObjectField(
  key: string,
  field: ObjectFieldDefinition<SchemaDefinition, boolean>,
  value: unknown,
  path: Array<string | number>,
  ctx: RenderContext,
  depth: number
): React.ReactNode {
  const { styles, classNames } = ctx;
  const label = ctx.config?.labelFormatter?.({ path: pathKey(path), field }) ?? formatLabel(key);
  const fieldStyle = depth === 0 ? styles.field : styles.nestedField ?? styles.field;
  const fieldClass = joinClassNames(
    'llm-schema-editor-field',
    'llm-schema-editor-field--object',
    depth === 0 ? classNames?.field : classNames?.nestedField ?? classNames?.field
  );

  return (
    <div className={fieldClass} data-path={pathKey(path)} style={fieldStyle}>
      <div
        style={depth === 0 ? styles.rootLabel ?? styles.label : styles.nestedLabel ?? styles.label}
        className={joinClassNames(classNames?.label)}
      >
        {label}
      </div>
      <FieldErrors path={path} ctx={ctx} />
      {renderDefinitionFields(field.shape, value, path, ctx, depth + 1)}
    </div>
  );
}

function renderDefinitionFields(
  definition: SchemaDefinition,
  data: unknown,
  parentPath: Array<string | number>,
  ctx: RenderContext,
  depth: number
): React.ReactNode {
  const entries = Object.entries(definition);
  const record: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const { styles, classNames } = ctx;

  return (
    <div
      style={depth === 0 ? styles.group : styles.nestedGroup ?? styles.group}
      className={joinClassNames(
        depth === 0 ? classNames?.group : classNames?.nestedGroup ?? classNames?.group
      )}
    >
      {entries.map(([key, field]) => {
        const path = [...parentPath, key];
        if (isHidden(path, ctx.config)) return null;
        const value = record[key];
        const typed = field as AnyFieldDefinition;

        if (isArrayField(typed)) {
          return (
            <React.Fragment key={key}>
              {renderArrayField(key, typed, value, path, ctx, depth)}
            </React.Fragment>
          );
        }
        if (isObjectField(typed)) {
          return (
            <React.Fragment key={key}>
              {renderObjectField(key, typed, value, path, ctx, depth)}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={key}>
            {renderLeaf(key, typed, value, path, ctx, depth)}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export function SchemaEditor<Definition extends SchemaDefinition>({
  schema,
  data,
  onChange,
  config,
  disabled,
  validationIssues
}: SchemaEditorProps<Definition>) {
  const definition = schema.definition;
  const styles = React.useMemo(
    () => mergeRendererStyles(stylePresets[config?.stylePreset ?? 'plain'], config?.styles),
    [config?.stylePreset, config?.styles]
  );
  const issuesByPath = useIssuesByPath(validationIssues);

  const latestData = React.useRef(data);
  latestData.current = data;

  const setPath = React.useCallback(
    (path: Array<string | number>, next: unknown) => {
      const updated = updatePathValue(latestData.current, path, next) as SchemaOutput<Definition>;
      onChange(updated);
    },
    [onChange]
  );

  const ctx: RenderContext = {
    styles,
    classNames: config?.classNames,
    disabled,
    issuesByPath,
    setPath,
    config
  };

  return (
    <form
      className={joinClassNames(
        'llm-schema-editor',
        `llm-schema-editor--${config?.layout ?? 'stack'}`,
        config?.classNames?.container
      )}
      style={styles.container}
      onSubmit={(e) => e.preventDefault()}
    >
      {renderDefinitionFields(definition, data, [], ctx, 0)}
    </form>
  );
}
