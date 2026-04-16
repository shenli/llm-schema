import type { ParseIssue, SchemaDefinition, SchemaOutput, SchemaValidationResult } from './types';

export namespace StandardSchemaV1 {
  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | { readonly key: PropertyKey }>;
  }
  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }
  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }
  export type Result<Output> = SuccessResult<Output> | FailureResult;
  export interface Props<Input, Output> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  }
}

export interface StandardSchemaV1Interface<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

export function toStandardResult<T>(
  result: SchemaValidationResult<T>
): StandardSchemaV1.Result<T> {
  if (result.success) {
    return { value: result.data };
  }
  return { issues: result.issues.map(issueToStandard) };
}

function issueToStandard(raw: ParseIssue): StandardSchemaV1.Issue {
  return {
    message: raw.message,
    path: raw.path.map((segment) => ({ key: segment }))
  };
}

export function buildStandardProps<Definition extends SchemaDefinition>(
  name: string,
  validate: (value: unknown) => SchemaValidationResult<SchemaOutput<Definition>>
): StandardSchemaV1.Props<unknown, SchemaOutput<Definition>> {
  return {
    version: 1,
    vendor: 'llm-schema',
    validate: (value) => toStandardResult(validate(value))
  };
}
