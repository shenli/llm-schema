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
  PartialSchemaOutput,
  ParseWithRepairResult,
  SchemaDefinition,
  JsonSchema,
  OpenAIToolOptions,
  AnthropicToolOptions
} from './schema/types';

export { repairJsonString } from './schema/repair';
export type { RepairResult, RepairFailure } from './schema/repair';
export type { StandardSchemaV1, StandardSchemaV1Interface } from './schema/standardSchema';

export { SchemaError } from './schema/types';

export {
  SchemaRenderer,
  SchemaField,
  SchemaEditor,
  SchemaDiff,
  MarkdownField,
  EntityProvider,
  useEntityResolver,
  useEntity,
  useEntitiesOfType,
  useSchemaData,
  useSchemaValidation,
  useStreamingSchema,
  stylePresets,
  mergeRendererStyles
} from './react';

export type {
  SchemaRendererProps,
  RendererComponents,
  RendererConfig,
  RendererStyles,
  RendererClassNames,
  SchemaFieldProps,
  SchemaEditorProps,
  SchemaDiffProps,
  MarkdownFieldProps,
  Entity,
  EntityResolver,
  EntityProviderProps,
  SchemaDataState,
  UseStreamingSchemaOptions,
  UseStreamingSchemaResult
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
