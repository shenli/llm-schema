import {
  type ArrayFieldDefinition,
  type ArrayFieldOptions,
  type BooleanFieldDefinition,
  type BooleanFieldOptions,
  type DateFieldDefinition,
  type DateFieldOptions,
  type EntityFieldDefinition,
  type EntityFieldOptions,
  type EnumFieldDefinition,
  type EnumFieldOptions,
  type FieldDefinition,
  type FieldParseResult,
  type MarkdownFieldDefinition,
  type MarkdownFieldOptions,
  type NumberFieldDefinition,
  type NumberFieldOptions,
  type ObjectFieldDefinition,
  type ObjectFieldOptions,
  type ParseIssue,
  type SchemaDefinition,
  type SchemaOutput,
  type TextFieldDefinition,
  type TextFieldOptions
} from './types';
import { determineDate, determineNumberPrecision } from './internal';
import { parseDefinition } from './validation';
import { appendPath, issue, resolveOptional } from './utils';
import type { DetermineOptional } from './utils';

type TextFieldReturn<O extends TextFieldOptions> = TextFieldDefinition<DetermineOptional<O>>;

export function text<const O extends TextFieldOptions = TextFieldOptions>(options?: O): TextFieldReturn<O> {
  const opts = (options ?? {}) as TextFieldOptions;
  const optional = resolveOptional(opts) as DetermineOptional<O>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<string>['parse'] = (value, ctx) => {
    if (typeof value !== 'string') {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected text value', 'invalid_type', 'string', typeof value)]
      };
    }

    if (opts.minLength !== undefined && value.length < opts.minLength) {
      return {
        success: false,
        issues: [
          issue(
            ctx.path,
            `Expected at least ${opts.minLength} characters`,
            'too_small',
            `>= ${opts.minLength}`,
            value.length
          )
        ]
      };
    }

    if (opts.maxLength !== undefined && value.length > opts.maxLength) {
      return {
        success: false,
        issues: [
          issue(
            ctx.path,
            `Expected at most ${opts.maxLength} characters`,
            'too_big',
            `<= ${opts.maxLength}`,
            value.length
          )
        ]
      };
    }

    if (opts.pattern && !opts.pattern.test(value)) {
      return {
        success: false,
        issues: [
          issue(ctx.path, 'Value does not match required pattern', 'invalid_format', opts.pattern.toString(), value)
        ]
      };
    }

    return { success: true, value };
  };

  return {
    kind: 'text',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault ? (() => opts.default!) : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const constraints: string[] = [];
      if (opts.minLength !== undefined) constraints.push(`min ${opts.minLength} chars`);
      if (opts.maxLength !== undefined) constraints.push(`max ${opts.maxLength} chars`);
      if (opts.pattern) constraints.push(`pattern ${opts.pattern}`);
      const constraintText = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": string (${requirement})${constraintText}${description}`;
    },
    options: opts,
    _optional: optional
  } as TextFieldReturn<O>;
}

type MarkdownFieldReturn<O extends MarkdownFieldOptions> = MarkdownFieldDefinition<DetermineOptional<O>>;

export function md<const O extends MarkdownFieldOptions = MarkdownFieldOptions>(options?: O): MarkdownFieldReturn<O> {
  const opts = (options ?? {}) as MarkdownFieldOptions;
  const optional = resolveOptional(opts) as DetermineOptional<O>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<string>['parse'] = (value, ctx) => {
    if (typeof value !== 'string') {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected markdown string', 'invalid_type', 'string', typeof value)]
      };
    }

    if (opts.maxLength !== undefined && value.length > opts.maxLength) {
      return {
        success: false,
        issues: [
          issue(
            ctx.path,
            `Markdown exceeds maximum length ${opts.maxLength}`,
            'too_big',
            `<= ${opts.maxLength}`,
            value.length
          )
        ]
      };
    }

    return { success: true, value };
  };

  return {
    kind: 'markdown',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault ? (() => opts.default!) : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const constraints: string[] = [];
      if (opts.maxLength !== undefined) constraints.push(`max ${opts.maxLength} chars`);
      const constraintText = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": markdown (${requirement})${constraintText}${description}`;
    },
    options: opts,
    _optional: optional
  } as MarkdownFieldReturn<O>;
}

type NumberFieldReturn<O extends NumberFieldOptions> = NumberFieldDefinition<DetermineOptional<O>>;

const createNumberField = <const O extends NumberFieldOptions = NumberFieldOptions>(options?: O): NumberFieldReturn<O> => {
  const opts = (options ?? {}) as NumberFieldOptions;
  const optional = resolveOptional(opts) as DetermineOptional<O>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<number>['parse'] = (value, ctx) => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected numeric value', 'invalid_type', 'number', value)]
      };
    }

    if (opts.min !== undefined && value < opts.min) {
      return {
        success: false,
        issues: [issue(ctx.path, `Value must be >= ${opts.min}`, 'too_small', `>= ${opts.min}`, value)]
      };
    }

    if (opts.max !== undefined && value > opts.max) {
      return {
        success: false,
        issues: [issue(ctx.path, `Value must be <= ${opts.max}`, 'too_big', `<= ${opts.max}`, value)]
      };
    }

    if (opts.precision !== undefined) {
      const precision = determineNumberPrecision(value);
      if (precision > opts.precision) {
        return {
          success: false,
          issues: [
            issue(ctx.path, `Value exceeds precision of ${opts.precision} decimals`, 'invalid_format')
          ]
        };
      }
    }

    return { success: true, value };
  };

  return {
    kind: 'number',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault ? (() => opts.default!) : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const constraints: string[] = [];
      if (opts.min !== undefined) constraints.push(`min ${opts.min}`);
      if (opts.max !== undefined) constraints.push(`max ${opts.max}`);
      if (opts.precision !== undefined) constraints.push(`precision ${opts.precision}`);
      const constraintText = constraints.length > 0 ? ` (${constraints.join(', ')})` : '';
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": number (${requirement})${constraintText}${description}`;
    },
    options: opts,
    _optional: optional
  } as NumberFieldReturn<O>;
};

export const number = createNumberField;

type BooleanFieldReturn<O extends BooleanFieldOptions> = BooleanFieldDefinition<DetermineOptional<O>>;

const createBooleanField = <const O extends BooleanFieldOptions = BooleanFieldOptions>(options?: O): BooleanFieldReturn<O> => {
  const opts = (options ?? {}) as BooleanFieldOptions;
  const optional = resolveOptional(opts) as DetermineOptional<O>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<boolean>['parse'] = (value, ctx) => {
    if (typeof value !== 'boolean') {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected boolean value', 'invalid_type', 'boolean', typeof value)]
      };
    }
    return { success: true, value };
  };

  return {
    kind: 'boolean',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault ? (() => opts.default!) : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": boolean (${requirement})${description}`;
    },
    options: opts,
    _optional: optional
  } as BooleanFieldReturn<O>;
};

export const boolean = createBooleanField;

type DateFieldReturn<O extends DateFieldOptions> = DateFieldDefinition<DetermineOptional<O>>;

export function date<const O extends DateFieldOptions = DateFieldOptions>(options?: O): DateFieldReturn<O> {
  const opts = (options ?? {}) as DateFieldOptions;
  const optional = resolveOptional(opts) as DetermineOptional<O>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<Date>['parse'] = (value, ctx) => {
    const resolved = determineDate(value, opts);
    if (!resolved.success) {
      return { success: false, issues: [resolved.issue(ctx.path)] };
    }
    return { success: true, value: resolved.value };
  };

  return {
    kind: 'date',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault
      ? () => {
          const resolved = determineDate((opts as DateFieldOptions).default, opts);
          if (!resolved.success) {
            throw new Error('Invalid default date value');
          }
          return resolved.value;
        }
      : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const format = opts.format === 'date' ? 'ISO date' : 'ISO date-time';
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": ${format} string (${requirement})${description}`;
    },
    options: opts,
    _optional: optional
  } as DateFieldReturn<O>;
}

export function enumType<
  const Values extends readonly string[],
  const O extends EnumFieldOptions<Values> = EnumFieldOptions<Values>
>(values: Values, options?: O): EnumFieldDefinition<Values, DetermineOptional<O>> {
  const opts = (options ?? {}) as EnumFieldOptions<Values>;
  const optional = resolveOptional(opts) as DetermineOptional<O>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<Values[number]>['parse'] = (value, ctx) => {
    if (typeof value !== 'string') {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected string enum value', 'invalid_type', 'string', typeof value)]
      };
    }

    if (!values.includes(value as Values[number])) {
      return {
        success: false,
        issues: [
          issue(
            ctx.path,
            `Value must be one of: ${values.join(', ')}`,
            'invalid_enum_value',
            values.join(' | '),
            value
          )
        ]
      };
    }

    return { success: true, value: value as Values[number] };
  };

  return {
    kind: 'enum',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault ? (() => opts.default!) : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const valuesText = values.map((v) => `'${v}'`).join(' | ');
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": ${valuesText} (${requirement})${description}`;
    },
    options: opts,
    values,
    _optional: optional
  };
}

export function entity<
  const Type extends string,
  const O extends Omit<EntityFieldOptions, 'type'> = Omit<EntityFieldOptions, 'type'>
>(type: Type, options?: O): EntityFieldDefinition<Type, DetermineOptional<O & { type: Type }>> {
  const opts = ({ ...(options ?? {}), type } as unknown) as EntityFieldOptions;
  const optional = resolveOptional(opts) as DetermineOptional<O & { type: Type }>;
  const hasDefault = 'default' in opts && opts.default !== undefined;

  const parse: FieldDefinition<string>['parse'] = (value, ctx) => {
    if (typeof value !== 'string') {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected entity identifier string', 'invalid_type', 'string', typeof value)]
      };
    }
    return { success: true, value };
  };

  return {
    kind: 'entity',
    description: opts.description,
    optional,
    hasDefault,
    defaultValue: hasDefault ? (() => opts.default!) : undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const description = opts.description ? ` - ${opts.description}` : '';
      return `"${name}": string (${requirement}, entity: ${type})${description}`;
    },
    options: opts,
    entityType: type,
    _optional: optional
  };
}

export function array<
  const Definition extends SchemaDefinition,
  const O extends ArrayFieldOptions = ArrayFieldOptions
>(options: O & { schema: Definition }): ArrayFieldDefinition<Definition, DetermineOptional<O>> {
  const optional = resolveOptional(options) as DetermineOptional<O>;
  const hasDefault = 'default' in options && (options as Record<string, unknown>).default !== undefined;

  const parse = (value: unknown, ctx: { path: string[] }): FieldParseResult<SchemaOutput<Definition>[]> => {
    if (!Array.isArray(value)) {
      return {
        success: false,
        issues: [issue(ctx.path, 'Expected array value', 'invalid_type', 'array', typeof value)]
      };
    }

    const issues: ParseIssue[] = [];
    const result: SchemaOutput<Definition>[] = [];

    if (options.minItems !== undefined && value.length < options.minItems) {
      issues.push(
        issue(
          ctx.path,
          `Expected at least ${options.minItems} items`,
          'too_small',
          `>= ${options.minItems}`,
          value.length
        )
      );
    }

    if (options.maxItems !== undefined && value.length > options.maxItems) {
      issues.push(
        issue(
          ctx.path,
          `Expected at most ${options.maxItems} items`,
          'too_big',
          `<= ${options.maxItems}`,
          value.length
        )
      );
    }

    value.forEach((item, index) => {
      const nested = parseDefinition(options.schema, item, appendPath(ctx.path, index));
      if (nested.success) {
        result.push(nested.data);
      } else {
        issues.push(...nested.issues);
      }
    });

    if (issues.length > 0) {
      return { success: false, issues };
    }

    if (options.uniqueBy) {
      const seen = new Set<unknown>();
      for (const item of result) {
        const key = (item as Record<string, unknown>)[options.uniqueBy];
        if (key === undefined) continue;
        if (seen.has(key)) {
          return {
            success: false,
            issues: [
              issue(
                ctx.path,
                `Array items must be unique by "${options.uniqueBy}"`,
                'invalid_format',
                undefined,
                key
              )
            ]
          };
        }
        seen.add(key);
      }
    }

    return { success: true, value: result };
  };

  return {
    kind: 'array',
    description: options.description,
    optional,
    hasDefault,
    defaultValue: undefined,
    parse,
    toPrompt: (name, promptOptions) => {
      const requirement = optional ? 'optional' : 'required';
      const description = options.description ? ` - ${options.description}` : '';
      const constraints: string[] = [];
      if (options.minItems !== undefined) constraints.push(`min ${options.minItems}`);
      if (options.maxItems !== undefined) constraints.push(`max ${options.maxItems}`);
      const constraintText = constraints.length ? ` (${constraints.join(', ')})` : '';
      return `"${name}": array (${requirement})${constraintText}${description}`;
    },
    options,
    itemDefinition: options.schema,
    _optional: optional
  };
}

export function object<
  const Definition extends SchemaDefinition,
  const O extends ObjectFieldOptions = ObjectFieldOptions
>(options: O & { schema: Definition }): ObjectFieldDefinition<Definition, DetermineOptional<O>> {
  const optional = resolveOptional(options) as DetermineOptional<O>;
  const hasDefault = 'default' in options && (options as Record<string, unknown>).default !== undefined;

  const parse = (value: unknown, ctx: { path: string[] }): FieldParseResult<SchemaOutput<Definition>> => {
    const nested = parseDefinition(options.schema, value, ctx.path);
    if (nested.success) {
      return { success: true, value: nested.data };
    }
    return { success: false, issues: nested.issues };
  };

  return {
    kind: 'object',
    description: options.description,
    optional,
    hasDefault,
    defaultValue: undefined,
    parse,
    toPrompt: (name) => {
      const requirement = optional ? 'optional' : 'required';
      const description = options.description ? ` - ${options.description}` : '';
      return `"${name}": object (${requirement})${description}`;
    },
    options,
    shape: options.schema,
    _optional: optional
  };
}
