export type FieldKind =
  | 'text'
  | 'markdown'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'entity'
  | 'array'
  | 'object';

export interface BaseFieldOptions {
  description?: string;
  optional?: boolean;
  required?: boolean;
  note?: string;
}

export interface ParseContext {
  path: string[];
}

export interface ParseIssue {
  path: string[];
  message: string;
  code:
    | 'invalid_type'
    | 'invalid_literal'
    | 'invalid_enum_value'
    | 'invalid_date'
    | 'invalid_format'
    | 'too_small'
    | 'too_big'
    | 'required';
  expected?: string;
  received?: unknown;
}

export type FieldParseResult<T> =
  | { success: true; value: T }
  | { success: false; issues: ParseIssue[] };

export interface PromptRenderOptions {
  includeExamples?: boolean;
  includeConstraints?: boolean;
  style?: 'instructional' | 'technical';
}

export interface SchemaOptions {
  name?: string;
  description?: string;
  version?: string;
  strict?: boolean;
  examples?: Array<Record<string, unknown>>;
}

export interface SchemaPromptOptions extends PromptRenderOptions {
  format?: 'detailed' | 'compact';
  structure?: 'json' | 'typescript';
}

export type SchemaValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ParseIssue[] };

export class SchemaError extends Error {
  constructor(
    message: string,
    public readonly issues: ParseIssue[]
  ) {
    super(message);
    this.name = 'SchemaError';
  }
}

export interface BaseFieldDefinition<
  TOutput,
  Kind extends FieldKind,
  IsOptional extends boolean
> {
  kind: Kind;
  description?: string;
  optional: IsOptional;
  hasDefault: boolean;
  defaultValue?: () => TOutput;
  parse(value: unknown, ctx: ParseContext): FieldParseResult<TOutput>;
  toPrompt(name: string, options?: PromptRenderOptions): string;
  _type?: TOutput;
  _optional?: IsOptional;
}

export type FieldDefinition<
  TOutput,
  Kind extends FieldKind = FieldKind,
  IsOptional extends boolean = boolean
> = BaseFieldDefinition<TOutput, Kind, IsOptional>;

export interface ArrayFieldOptions extends BaseFieldOptions {
  minItems?: number;
  maxItems?: number;
  uniqueBy?: string;
}

export interface ObjectFieldOptions extends BaseFieldOptions {}

export interface TextFieldOptions extends BaseFieldOptions {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  placeholder?: string;
  default?: string;
}

export interface MarkdownFieldOptions extends TextFieldOptions {
  allowHtml?: boolean;
  allowedMarkdown?: {
    bold?: boolean;
    italic?: boolean;
    lists?: boolean;
    headers?: boolean;
    links?: boolean;
    images?: boolean;
    code?: boolean;
    quote?: boolean;
  };
  toolbar?: string[];
  livePreview?: boolean;
}

export interface NumberFieldOptions extends BaseFieldOptions {
  min?: number;
  max?: number;
  precision?: number;
  default?: number;
}

export interface BooleanFieldOptions extends BaseFieldOptions {
  labels?: { true: string; false: string };
  default?: boolean;
}

export interface DateFieldOptions extends BaseFieldOptions {
  format?: 'date' | 'date-time';
  fromUnix?: boolean;
  default?: Date | string | number;
}

export interface EnumFieldOptions<T extends readonly string[]> extends BaseFieldOptions {
  labels?: Partial<Record<T[number], string>>;
  default?: T[number];
}

export interface EntityFieldOptions extends BaseFieldOptions {
  type: string;
  default?: string;
}

export interface ArrayFieldDefinition<
  ItemDefinition extends SchemaDefinition,
  IsOptional extends boolean
> extends FieldDefinition<SchemaOutput<ItemDefinition>[], 'array', IsOptional> {
  options: ArrayFieldOptions;
  itemDefinition: ItemDefinition;
}

export interface ObjectFieldDefinition<
  Shape extends SchemaDefinition,
  IsOptional extends boolean
> extends FieldDefinition<SchemaOutput<Shape>, 'object', IsOptional> {
  options: ObjectFieldOptions;
  shape: Shape;
}

export interface TextFieldDefinition<IsOptional extends boolean>
  extends FieldDefinition<string, 'text', IsOptional> {
  options: TextFieldOptions;
}

export interface MarkdownFieldDefinition<IsOptional extends boolean>
  extends FieldDefinition<string, 'markdown', IsOptional> {
  options: MarkdownFieldOptions;
}

export interface NumberFieldDefinition<IsOptional extends boolean>
  extends FieldDefinition<number, 'number', IsOptional> {
  options: NumberFieldOptions;
}

export interface BooleanFieldDefinition<IsOptional extends boolean>
  extends FieldDefinition<boolean, 'boolean', IsOptional> {
  options: BooleanFieldOptions;
}

export interface DateFieldDefinition<IsOptional extends boolean>
  extends FieldDefinition<Date, 'date', IsOptional> {
  options: DateFieldOptions;
}

export interface EnumFieldDefinition<
  Values extends readonly string[],
  IsOptional extends boolean
> extends FieldDefinition<Values[number], 'enum', IsOptional> {
  options: EnumFieldOptions<Values>;
  values: Values;
}

export interface EntityFieldDefinition<
  Type extends string,
  IsOptional extends boolean
> extends FieldDefinition<string, 'entity', IsOptional> {
  options: EntityFieldOptions;
  entityType: Type;
}

export interface OpenAIToolOptions {
  name?: string;
  description?: string;
}

export interface AnthropicToolOptions {
  name?: string;
  description?: string;
}

export interface JsonSchema {
  type: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  additionalProperties?: boolean;
}

export type AnyFieldDefinition =
  | FieldDefinition<any, FieldKind, boolean>
  | ArrayFieldDefinition<any, boolean>
  | ObjectFieldDefinition<any, boolean>;

export type SchemaDefinition = Record<string, AnyFieldDefinition>;

type OptionalKeys<Definition extends SchemaDefinition> = {
  [K in keyof Definition]: Definition[K] extends { _optional?: true } ? K : never;
}[keyof Definition];

type RequiredKeys<Definition extends SchemaDefinition> = {
  [K in keyof Definition]: Definition[K] extends { _optional?: true } ? never : K;
}[keyof Definition];

export type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type FieldOutput<F> = F extends FieldDefinition<infer T, any, any>
  ? T
  : never;

export type SchemaOutput<Definition extends SchemaDefinition> = Simplify<
  { [K in RequiredKeys<Definition>]: FieldOutput<Definition[K]> } &
    { [K in OptionalKeys<Definition>]?: FieldOutput<Definition[K]> }
>;
