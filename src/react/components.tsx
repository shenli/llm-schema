import React from 'react';
import type { Schema } from '../schema/builder';
import type {
  AnyFieldDefinition,
  SchemaDefinition,
  SchemaOutput,
  PartialSchemaOutput
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
import {
  mergeRendererStyles,
  stylePresets,
  joinClassNames,
  type RendererStyles,
  type RendererClassNames
} from './styles';
import { useEntity } from './EntityProvider';

export type { RendererStyles, RendererClassNames };

type FieldComponentProps = {
  value: unknown;
  field: AnyFieldDefinition;
  path: string;
  label: string;
  partial?: boolean;
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
  classNames?: RendererClassNames;
}

function EntityDisplay({ type, id }: { type: string; id: string }) {
  const entity = useEntity(type, id);
  if (entity) {
    return <span>{entity.label}</span>;
  }
  return <code>{id}</code>;
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
  entity: ({ value, field }) => {
    const id = String(value ?? '');
    if (!id) return null;
    if (!isEntityField(field)) return <code>{id}</code>;
    return <EntityDisplay type={field.entityType} id={id} />;
  }
};

function formatLabel(key: string) {
  const withSpaces = key.replace(/([A-Z])/g, ' $1');
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function isHidden(path: string, config?: RendererConfig) {
  if (!config?.hiddenFields?.length) return false;
  return config.hiddenFields.some((hidden) => path === hidden || path.startsWith(`${hidden}.`));
}

function Pending({
  styles,
  classNames
}: {
  styles: RendererStyles;
  classNames?: RendererClassNames;
}) {
  return (
    <span
      className={joinClassNames('llm-schema-pending', classNames?.pending)}
      style={styles.pending}
      aria-busy="true"
      aria-live="polite"
    >
      {'\u00a0'}
    </span>
  );
}

function renderFieldValue(
  field: AnyFieldDefinition,
  value: unknown,
  path: string,
  components: RendererComponents,
  config: RendererConfig | undefined,
  styles: RendererStyles,
  depth: number,
  partial: boolean
): React.ReactNode {
  const label =
    config?.labelFormatter?.({ path, field }) ??
    formatLabel(path.split('.').slice(-1)[0] ?? path);
  const fieldStyle = depth === 0 ? styles.field : styles.nestedField ?? styles.field;
  const labelStyle =
    depth === 0 ? styles.rootLabel ?? styles.label : styles.nestedLabel ?? styles.label ?? undefined;
  const classNames = config?.classNames;
  const fieldClass = joinClassNames(
    'llm-schema-field',
    depth === 0 ? classNames?.field : classNames?.nestedField ?? classNames?.field
  );
  const labelClass = joinClassNames(
    depth === 0 ? classNames?.rootLabel ?? classNames?.label : classNames?.nestedLabel ?? classNames?.label
  );

  const valueIsMissing = value === undefined || value === null;

  const renderPrimitive = (kind: keyof RendererComponents) => (
    <div
      className={fieldClass}
      data-kind={kind}
      data-path={path}
      style={fieldStyle}
    >
      <dt style={labelStyle} className={labelClass}>{label}</dt>
      <dd style={styles.value} className={joinClassNames(classNames?.value)}>
        {partial && valueIsMissing ? (
          <Pending styles={styles} classNames={classNames} />
        ) : (
          components[kind]?.({ value, field, path, label, partial })
        )}
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
        className={fieldClass}
        data-kind="array"
        data-path={path}
        style={fieldStyle}
      >
        <dt style={styles.label} className={joinClassNames(classNames?.label)}>
          {label}
        </dt>
        <dd style={styles.value} className={joinClassNames(classNames?.value)}>
          {items.length === 0 ? (
            partial ? (
              <Pending styles={styles} classNames={classNames} />
            ) : (
              <em style={styles.missing} className={joinClassNames(classNames?.missing)}>
                No entries
              </em>
            )
          ) : (
            <ol style={styles.list} className={joinClassNames('llm-schema-list', classNames?.list)}>
              {items.map((item, index) => (
                <li
                  key={index}
                  style={styles.listItem}
                  className={joinClassNames('llm-schema-list-item', classNames?.listItem)}
                >
                  {styles.listItemHeading && (
                    <div
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
                    </div>
                  )}
                  {renderNestedFields(
                    field.itemDefinition,
                    (item as Record<string, unknown>) ?? {},
                    `${path}.${index}`,
                    components,
                    config,
                    styles,
                    depth + 1,
                    partial
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
        className={fieldClass}
        data-kind="object"
        data-path={path}
        style={fieldStyle}
      >
        <dt style={labelStyle} className={labelClass}>{label}</dt>
        <dd style={styles.value} className={joinClassNames(classNames?.value)}>
          {renderNestedFields(
            field.shape,
            (value && typeof value === 'object' ? (value as Record<string, unknown>) : {}) ?? {},
            path,
            components,
            config,
            styles,
            depth + 1,
            partial
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
  depth = 0,
  partial = false
) {
  const entries = Object.entries(definition);
  if (entries.length === 0) {
    return <em>Empty</em>;
  }

  const record: Record<string, unknown> =
    data && typeof data === 'object' && !Array.isArray(data) ? (data as Record<string, unknown>) : {};
  const classNames = config?.classNames;

  return (
    <dl
      className={joinClassNames(
        'llm-schema-group',
        depth === 0 ? classNames?.group : classNames?.nestedGroup ?? classNames?.group
      )}
      style={depth === 0 ? styles.group : styles.nestedGroup ?? styles.group}
    >
      {entries.map(([key, childField]) => {
        const path = parentPath ? `${parentPath}.${key}` : key;
        const value = record[key];

        if (isHidden(path, config)) {
          return null;
        }

        if (value === undefined && !config?.showOptionalFields && childField.optional && !partial) {
          return null;
        }

        if (value === undefined && config?.showOptionalFields && !partial) {
          const fieldStyle = depth === 0 ? styles.field : styles.nestedField ?? styles.field;
          return (
            <div
              key={path}
              className={joinClassNames(
                'llm-schema-field',
                'llm-schema-field--missing',
                classNames?.missing
              )}
              data-path={path}
              style={fieldStyle}
            >
              <dt style={styles.label} className={joinClassNames(classNames?.label)}>
                {formatLabel(key)}
              </dt>
              <dd
                style={{ ...(styles.value ?? {}), ...(styles.missing ?? {}) }}
                className={joinClassNames(classNames?.value, classNames?.missing)}
              >
                Not provided
              </dd>
            </div>
          );
        }

        return (
          <React.Fragment key={path}>
            {renderFieldValue(childField, value, path, components, config, styles, depth, partial)}
          </React.Fragment>
        );
      })}
    </dl>
  );
}

export interface SchemaRendererProps<Definition extends SchemaDefinition> {
  schema: Schema<Definition>;
  data: SchemaOutput<Definition> | PartialSchemaOutput<Definition>;
  components?: Partial<RendererComponents>;
  config?: RendererConfig;
  markdownRenderer?: (content: string) => React.ReactNode;
  partial?: boolean;
}

export function SchemaRenderer<Definition extends SchemaDefinition>({
  schema,
  data,
  components,
  config,
  markdownRenderer,
  partial = false
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
      className={joinClassNames(
        'llm-schema-renderer',
        config?.layout ? `llm-schema-renderer--${config.layout}` : null,
        config?.classNames?.container
      )}
      style={styles.container}
    >
      {renderNestedFields(
        schema.definition,
        data,
        '',
        mergedComponents,
        config,
        styles,
        0,
        partial
      )}
    </div>
  );
}

export interface SchemaFieldProps {
  field: AnyFieldDefinition;
  value: unknown;
  path?: string;
  components?: Partial<RendererComponents>;
  config?: RendererConfig;
  partial?: boolean;
}

export function SchemaField({
  field,
  value,
  path = field.kind,
  components,
  config,
  partial = false
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
    <dl
      className={joinClassNames('llm-schema-fieldset', config?.classNames?.group)}
      style={styles.group}
    >
      {renderFieldValue(field, value, path, mergedComponents, config, styles, 0, partial)}
    </dl>
  );
}

export { defaultComponents, renderNestedFields, renderFieldValue };
export { SchemaEditor } from './SchemaEditor';
export type { SchemaEditorProps } from './SchemaEditor';
