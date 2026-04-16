import type { BaseFieldOptions, ParseIssue } from './types';

export type DetermineOptional<O extends BaseFieldOptions> =
  O['optional'] extends true
    ? true
    : 'default' extends keyof O
      ? Exclude<O['default'], undefined> extends never
        ? false
        : true
      : false;

export function resolveOptional(options: BaseFieldOptions): boolean {
  if (options.optional === true) return true;
  return 'default' in options && (options as Record<string, unknown>).default !== undefined;
}

export function formatPath(path: string[]): string {
  return path.length === 0 ? '<root>' : path.join('.');
}

export function issue(
  path: string[],
  message: string,
  code: ParseIssue['code'],
  expected?: string,
  received?: unknown
): ParseIssue {
  return { path, message, code, expected, received };
}

export function appendPath(path: string[], segment: string | number): string[] {
  return [...path, String(segment)];
}
