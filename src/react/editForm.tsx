import React from 'react';
import type { Schema } from '../schema/builder';
import type { ParseIssue, SchemaDefinition, SchemaOutput } from '../schema/types';
import { SchemaEditor } from './components';
import type { RendererConfig } from './components';

export interface GenerateEditFormOptions<Definition extends SchemaDefinition> {
  value: SchemaOutput<Definition>;
  onChange: (value: SchemaOutput<Definition>) => void;
  fields?: Array<keyof SchemaOutput<Definition> & string>;
  config?: RendererConfig;
  disabled?: boolean;
  validationIssues?: ParseIssue[];
}

export function generateEditForm<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  options: GenerateEditFormOptions<Definition>
): React.ReactElement {
  const { value, onChange, fields, config, disabled, validationIssues } = options;

  const allKeys = Object.keys(schema.getDefinition());
  const hiddenByFields =
    fields && fields.length > 0 ? allKeys.filter((key) => !fields.includes(key as never)) : [];

  const mergedHidden = new Set<string>(config?.hiddenFields ?? []);
  hiddenByFields.forEach((key) => mergedHidden.add(key));

  const editorConfig: RendererConfig | undefined =
    mergedHidden.size > 0 || config
      ? {
          ...config,
          hiddenFields: Array.from(mergedHidden)
        }
      : config;

  return (
    <SchemaEditor
      schema={schema}
      data={value}
      onChange={onChange}
      config={editorConfig}
      disabled={disabled}
      validationIssues={validationIssues}
    />
  );
}
