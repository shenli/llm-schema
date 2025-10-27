import React from 'react';
import type { Schema } from '../schema/builder';
import type { ParseIssue, SchemaDefinition, SchemaOutput, SchemaValidationResult } from '../schema/types';

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
