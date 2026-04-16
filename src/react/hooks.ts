import React from 'react';
import type { Schema } from '../schema/builder';
import type {
  ParseIssue,
  PartialSchemaOutput,
  SchemaDefinition,
  SchemaOutput,
  SchemaValidationResult
} from '../schema/types';

type Updater<T> = T | ((previous: T) => T);

export interface SchemaDataState<Definition extends SchemaDefinition> {
  data: SchemaOutput<Definition>;
  setData: (updater: Updater<SchemaOutput<Definition>>) => void;
  issues: ParseIssue[];
  isValid: boolean;
  validate: () => SchemaValidationResult<SchemaOutput<Definition>>;
}

export function useSchemaData<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  initial: SchemaOutput<Definition>
): SchemaDataState<Definition> {
  const [data, setDataState] = React.useState(initial);
  const [issues, setIssues] = React.useState<ParseIssue[]>([]);

  const setData = React.useCallback(
    (updater: Updater<SchemaOutput<Definition>>) => {
      setDataState((prev) => {
        const next = typeof updater === 'function' ? (updater as (value: typeof prev) => typeof prev)(prev) : updater;
        const validation = schema.safeParse(next);
        setIssues(validation.success ? [] : validation.issues);
        return next;
      });
    },
    [schema]
  );

  const validate = React.useCallback(() => {
    const result = schema.safeParse(data);
    setIssues(result.success ? [] : result.issues);
    return result;
  }, [schema, data]);

  return {
    data,
    setData,
    issues,
    isValid: issues.length === 0,
    validate
  };
}

export function useSchemaValidation<Definition extends SchemaDefinition>(
  schema: Schema<Definition>,
  data: SchemaOutput<Definition>
) {
  return React.useMemo(() => schema.safeParse(data), [schema, data]);
}

export interface UseStreamingSchemaOptions<Definition extends SchemaDefinition> {
  object: unknown;
  isLoading?: boolean;
  schema: Schema<Definition>;
}

export interface UseStreamingSchemaResult<Definition extends SchemaDefinition> {
  data: PartialSchemaOutput<Definition> | undefined;
  partial: boolean;
  issues: ParseIssue[];
  isValid: boolean;
}

export function useStreamingSchema<Definition extends SchemaDefinition>(
  options: UseStreamingSchemaOptions<Definition>
): UseStreamingSchemaResult<Definition> {
  const { schema, object, isLoading } = options;

  return React.useMemo<UseStreamingSchemaResult<Definition>>(() => {
    if (object === undefined || object === null) {
      return { data: undefined, partial: Boolean(isLoading), issues: [], isValid: false };
    }

    if (isLoading) {
      const partial = schema.safeParsePartial(object);
      return {
        data: partial.success ? partial.data : (object as PartialSchemaOutput<Definition>),
        partial: true,
        issues: partial.success ? [] : partial.issues,
        isValid: partial.success
      };
    }

    const strict = schema.safeParse(object);
    if (strict.success) {
      return {
        data: strict.data as PartialSchemaOutput<Definition>,
        partial: false,
        issues: [],
        isValid: true
      };
    }
    const partial = schema.safeParsePartial(object);
    return {
      data: partial.success ? partial.data : (object as PartialSchemaOutput<Definition>),
      partial: false,
      issues: strict.issues,
      isValid: false
    };
  }, [schema, object, isLoading]);
}
