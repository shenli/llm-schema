import type { DateFieldOptions, ParseIssue } from './types';
import { issue } from './utils';

export function determineNumberPrecision(value: number): number {
  const [_, decimals] = value.toString().split('.');
  return decimals ? decimals.length : 0;
}

export function determineDate(
  value: unknown,
  options: DateFieldOptions
): { success: true; value: Date } | { success: false; issue: (path: string[]) => ParseIssue } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return { success: true, value };
  }

  if (typeof value === 'number') {
    const timestamp = options.fromUnix ? value * 1000 : value;
    const result = new Date(timestamp);
    if (!Number.isNaN(result.getTime())) {
      return { success: true, value: result };
    }
  }

  if (typeof value === 'string') {
    const result = new Date(value);
    if (!Number.isNaN(result.getTime())) {
      return { success: true, value: result };
    }
  }

  return {
    success: false,
    issue: (path: string[]) =>
      issue(path, 'Invalid date value. Expected ISO string, unix timestamp, or Date instance.', 'invalid_date', undefined, value)
  };
}
