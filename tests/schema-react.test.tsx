import React from 'react';
import { describe, expect, test } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  SchemaEditor,
  SchemaRenderer,
  useSchemaValidation,
  defineSchema,
  text,
  md,
  enumType,
  array,
  entity,
  boolean
} from '../src';

const DemoSchema = defineSchema({
  title: text({ description: 'Title' }),
  summary: md({ optional: true, description: 'Markdown summary' }),
  tags: enumType(['docs', 'product', 'engineering'] as const, {
    description: 'Select a single tag.'
  }),
  contributors: array({
    description: 'Contributors',
    schema: {
      name: entity('person'),
      active: boolean({ default: true })
    }
  })
});

describe('React helpers', () => {
  test('SchemaRenderer produces markup for markdown fields', () => {
    const data = {
      title: 'Launch Notes',
      summary: 'Highlights:\n- New features',
      tags: 'docs',
      contributors: [{ name: 'alice', active: true }]
    } as const;

    const html = renderToString(<SchemaRenderer schema={DemoSchema} data={data} />);
    expect(html).toContain('Launch Notes');
    expect(html).toContain('Highlights');
    expect(html).toContain('Contributors');
  });

  test('SchemaEditor renders controls for enum and markdown', () => {
    const data = {
      title: 'Launch Notes',
      summary: 'Highlights',
      tags: 'product',
      contributors: [{ name: 'alice', active: true }]
    } as const;

    const html = renderToString(
      <SchemaEditor schema={DemoSchema} data={data} onChange={() => void 0} validationIssues={[]} />
    );

    expect(html).toContain('<select');
    expect(html).toContain('textarea');
  });

  test('useSchemaValidation runs inside a component tree', () => {
    const data = {
      title: 'Launch',
      summary: undefined,
      tags: 'engineering',
      contributors: [{ name: 'alice', active: true }]
    } as const;

    const HookHarness = () => {
      const validation = useSchemaValidation(DemoSchema, data);
      return <pre>{JSON.stringify(validation)}</pre>;
    };

    const html = renderToString(<HookHarness />);
    expect(html).toContain('&quot;success&quot;:true');
  });
});
