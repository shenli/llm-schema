export { defineSchema, type Schema, type InferSchema } from './schema/builder';

export {
  text,
  md,
  number,
  boolean,
  date,
  enumType,
  entity,
  array,
  object
} from './schema/fields';

export type {
  SchemaOptions,
  SchemaValidationResult,
  ParseIssue,
  SchemaOutput,
  SchemaDefinition,
  JsonSchema,
  OpenAIToolOptions,
  AnthropicToolOptions
} from './schema/types';

export { SchemaError } from './schema/types';

export {
  SchemaRenderer,
  SchemaField,
  SchemaEditor,
  useSchemaData,
  useSchemaValidation
} from './react';

export type {
  SchemaRendererProps,
  RendererComponents,
  RendererConfig,
  SchemaFieldProps,
  SchemaEditorProps,
  SchemaDataState
} from './react';

export {
  diffSchemaData,
  mergeSchemaData,
  searchSchemaData,
  extractEntities,
  collectMarkdownFields,
  validateSchemaData
} from './schema/transform';

export type {
  DiffResult,
  DiffChange,
  SearchResult,
  SearchOptions,
  EntityRecord,
  MarkdownFieldRecord,
  MergeOptions
} from './schema/transform';
