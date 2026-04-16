import React from 'react';
import { describe, expect, test } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  defineSchema,
  text,
  md,
  enumType,
  array,
  entity,
  boolean,
  SchemaRenderer,
  SchemaEditor,
  SchemaDiff,
  EntityProvider,
  useStreamingSchema
} from '../src';

const Schema = defineSchema({
  title: text({ description: 'Title' }),
  summary: md({ optional: true }),
  tags: enumType(['a', 'b'] as const),
  contributors: array({
    schema: {
      name: entity('person'),
      active: boolean({ default: true })
    }
  })
});

describe('SchemaRenderer partial mode', () => {
  test('renders pending placeholders for missing required fields', () => {
    const html = renderToString(
      <SchemaRenderer schema={Schema} data={{ title: 'wip' } as never} partial />
    );
    expect(html).toContain('llm-schema-pending');
  });

  test('renders pending for empty arrays in partial mode', () => {
    const html = renderToString(
      <SchemaRenderer
        schema={Schema}
        data={{ title: 't', tags: 'a', contributors: [] } as never}
        partial
      />
    );
    expect(html).toContain('llm-schema-pending');
  });

  test('accepts classNames overrides', () => {
    const html = renderToString(
      <SchemaRenderer
        schema={Schema}
        data={{ title: 't', tags: 'a', contributors: [] } as never}
        config={{ classNames: { container: 'my-theme-root', field: 'my-theme-field' } }}
      />
    );
    expect(html).toContain('my-theme-root');
    expect(html).toContain('my-theme-field');
  });
});

describe('EntityProvider + renderer', () => {
  test('renders entity label from registry instead of raw id', () => {
    const html = renderToString(
      <EntityProvider
        entities={[{ type: 'person', id: 'alice', label: 'Alice Archer' }]}
      >
        <SchemaRenderer
          schema={Schema}
          data={{
            title: 't',
            tags: 'a',
            contributors: [{ name: 'alice', active: true }]
          }}
        />
      </EntityProvider>
    );
    expect(html).toContain('Alice Archer');
  });

  test('falls back to raw id when entity not registered', () => {
    const html = renderToString(
      <SchemaRenderer
        schema={Schema}
        data={{
          title: 't',
          tags: 'a',
          contributors: [{ name: 'bob', active: true }]
        }}
      />
    );
    expect(html).toContain('bob');
  });
});

describe('SchemaEditor real editing', () => {
  test('renders add button for arrays', () => {
    const html = renderToString(
      <SchemaEditor
        schema={Schema}
        data={{ title: 't', tags: 'a', contributors: [] } as never}
        onChange={() => void 0}
      />
    );
    expect(html).toContain('+ Add');
  });

  test('renders nested inputs without JSON textarea fallback', () => {
    const html = renderToString(
      <SchemaEditor
        schema={Schema}
        data={{
          title: 't',
          tags: 'a',
          contributors: [{ name: 'alice', active: true }]
        }}
        onChange={() => void 0}
      />
    );
    expect(html).toContain('Remove');
    expect(html).toContain('aria-label="Move item 1 up"');
  });

  test('surfaces validation errors at field paths', () => {
    const html = renderToString(
      <SchemaEditor
        schema={Schema}
        data={{ title: '', tags: 'a', contributors: [] } as never}
        onChange={() => void 0}
        validationIssues={[
          {
            path: ['title'],
            message: 'Title must be filled out',
            code: 'required'
          }
        ]}
      />
    );
    expect(html).toContain('Title must be filled out');
  });
});

describe('SchemaDiff', () => {
  test('renders added/removed/changed', () => {
    const prev = Schema.parse({
      title: 'original',
      tags: 'a',
      contributors: [{ name: 'alice', active: true }]
    });
    const next = Schema.parse({
      title: 'updated',
      tags: 'b',
      contributors: [
        { name: 'alice', active: true },
        { name: 'bob', active: true }
      ]
    });

    const html = renderToString(<SchemaDiff schema={Schema} prev={prev} next={next} />);
    expect(html).toContain('title');
    expect(html).toContain('tags');
    expect(html).toContain('llm-schema-diff-row--changed');
    expect(html).toContain('llm-schema-diff-row--added');
  });

  test('reports no changes when data is equal', () => {
    const data = Schema.parse({
      title: 'same',
      tags: 'a',
      contributors: [{ name: 'alice', active: true }]
    });
    const html = renderToString(<SchemaDiff schema={Schema} prev={data} next={data} />);
    expect(html).toContain('No changes');
  });
});

describe('useStreamingSchema', () => {
  test('returns partial data while loading', () => {
    const Harness = () => {
      const state = useStreamingSchema({
        schema: Schema,
        object: { title: 'partial' },
        isLoading: true
      });
      return <pre>{JSON.stringify(state)}</pre>;
    };
    const html = renderToString(<Harness />);
    expect(html).toContain('&quot;partial&quot;:true');
    expect(html).toContain('&quot;title&quot;:&quot;partial&quot;');
  });

  test('returns full validation result when not loading', () => {
    const Harness = () => {
      const state = useStreamingSchema({
        schema: Schema,
        object: {
          title: 'done',
          tags: 'a',
          contributors: [{ name: 'alice', active: true }]
        },
        isLoading: false
      });
      return <pre>{JSON.stringify(state)}</pre>;
    };
    const html = renderToString(<Harness />);
    expect(html).toContain('&quot;isValid&quot;:true');
    expect(html).toContain('&quot;partial&quot;:false');
  });
});
