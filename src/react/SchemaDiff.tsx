import React from 'react';
import type { Schema } from '../schema/builder';
import type { SchemaDefinition, SchemaOutput } from '../schema/types';
import type { DiffResult } from '../schema/transform';
import {
  joinClassNames,
  mergeRendererStyles,
  stylePresets,
  type RendererClassNames,
  type RendererStyles
} from './styles';

export interface SchemaDiffProps<Definition extends SchemaDefinition> {
  schema: Schema<Definition>;
  prev: SchemaOutput<Definition>;
  next: SchemaOutput<Definition>;
  layout?: 'inline' | 'side-by-side';
  stylePreset?: 'card' | 'plain';
  styles?: Partial<RendererStyles>;
  classNames?: RendererClassNames;
  formatValue?: (value: unknown) => React.ReactNode;
}

function defaultFormatValue(value: unknown): React.ReactNode {
  if (value === undefined) return <em>undefined</em>;
  if (value === null) return <em>null</em>;
  if (typeof value === 'string') {
    if (value.length > 200) return `${value.slice(0, 200)}…`;
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return <code>{JSON.stringify(value)}</code>;
  } catch {
    return <code>[unserializable]</code>;
  }
}

function DiffRow({
  kind,
  path,
  before,
  after,
  styles,
  classNames,
  layout,
  formatValue
}: {
  kind: 'added' | 'removed' | 'changed';
  path: string;
  before?: unknown;
  after?: unknown;
  styles: RendererStyles;
  classNames?: RendererClassNames;
  layout: 'inline' | 'side-by-side';
  formatValue: (value: unknown) => React.ReactNode;
}) {
  const rowStyle =
    kind === 'added' ? styles.diffAdded : kind === 'removed' ? styles.diffRemoved : styles.diffChanged;
  const rowClass =
    kind === 'added'
      ? classNames?.diffAdded
      : kind === 'removed'
        ? classNames?.diffRemoved
        : classNames?.diffChanged;

  const marker = kind === 'added' ? '+ ' : kind === 'removed' ? '− ' : '~ ';

  return (
    <li
      style={{ ...rowStyle, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}
      className={joinClassNames(`llm-schema-diff-row--${kind}`, rowClass)}
      data-path={path}
    >
      <div
        style={styles.diffPath}
        className={joinClassNames('llm-schema-diff-path', classNames?.diffPath)}
      >
        {marker}
        {path}
      </div>
      {layout === 'side-by-side' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={styles.diffBefore}
            className={joinClassNames(classNames?.diffBefore)}
          >
            {kind === 'added' ? '' : formatValue(before)}
          </div>
          <div
            style={styles.diffAfter}
            className={joinClassNames(classNames?.diffAfter)}
          >
            {kind === 'removed' ? '' : formatValue(after)}
          </div>
        </div>
      ) : (
        <div>
          {kind !== 'added' && (
            <div
              style={styles.diffBefore}
              className={joinClassNames(classNames?.diffBefore)}
            >
              {formatValue(before)}
            </div>
          )}
          {kind !== 'removed' && (
            <div
              style={styles.diffAfter}
              className={joinClassNames(classNames?.diffAfter)}
            >
              {formatValue(after)}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function SchemaDiff<Definition extends SchemaDefinition>({
  schema,
  prev,
  next,
  layout = 'inline',
  stylePreset = 'plain',
  styles: stylesOverride,
  classNames,
  formatValue = defaultFormatValue
}: SchemaDiffProps<Definition>) {
  const styles = React.useMemo(
    () => mergeRendererStyles(stylePresets[stylePreset], stylesOverride),
    [stylePreset, stylesOverride]
  );

  const diff: DiffResult = React.useMemo(() => schema.diff(prev, next), [schema, prev, next]);

  const hasChanges = diff.added.length + diff.removed.length + diff.changed.length > 0;

  return (
    <div
      className={joinClassNames('llm-schema-diff', classNames?.container)}
      style={styles.container}
    >
      {!hasChanges ? (
        <em style={styles.missing} className={joinClassNames(classNames?.missing)}>
          No changes
        </em>
      ) : (
        <ul
          style={{ ...(styles.list ?? {}), padding: 0 }}
          className={joinClassNames(classNames?.list)}
        >
          {diff.added.map((entry) => (
            <DiffRow
              key={`added-${entry.path}`}
              kind="added"
              path={entry.path}
              after={entry.after}
              styles={styles}
              classNames={classNames}
              layout={layout}
              formatValue={formatValue}
            />
          ))}
          {diff.removed.map((entry) => (
            <DiffRow
              key={`removed-${entry.path}`}
              kind="removed"
              path={entry.path}
              before={entry.before}
              styles={styles}
              classNames={classNames}
              layout={layout}
              formatValue={formatValue}
            />
          ))}
          {diff.changed.map((entry) => (
            <DiffRow
              key={`changed-${entry.path}`}
              kind="changed"
              path={entry.path}
              before={entry.before}
              after={entry.after}
              styles={styles}
              classNames={classNames}
              layout={layout}
              formatValue={formatValue}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
