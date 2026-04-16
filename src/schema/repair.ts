export interface RepairResult {
  repaired: string;
  steps: string[];
}

export interface RepairFailure {
  steps: string[];
  error: string;
}

const CODE_FENCE_RE = /^```(?:json|javascript|ts|typescript)?\s*([\s\S]*?)```$/m;

function stripCodeFences(input: string, steps: string[]): string {
  const trimmed = input.trim();
  const match = trimmed.match(CODE_FENCE_RE);
  if (match) {
    steps.push('stripped code fence');
    return match[1].trim();
  }
  return trimmed;
}

function extractJsonBlock(input: string, steps: string[]): string {
  let source = input;
  const firstBrace = source.search(/[{[]/);
  if (firstBrace > 0) {
    source = source.slice(firstBrace);
    steps.push('trimmed prose prefix');
  }

  const opener = source[0];
  if (opener !== '{' && opener !== '[') {
    return source;
  }

  const closer = opener === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === opener) depth += 1;
    else if (ch === closer) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end > -1 && end < source.length - 1) {
    steps.push('trimmed trailing prose');
    return source.slice(0, end + 1);
  }
  return source;
}

function removeTrailingCommas(input: string, steps: string[]): string {
  const next = input.replace(/,(\s*[}\]])/g, '$1');
  if (next !== input) steps.push('removed trailing commas');
  return next;
}

function convertSmartQuotes(input: string, steps: string[]): string {
  const next = input
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
  if (next !== input) steps.push('normalized smart quotes');
  return next;
}

function quoteUnquotedKeys(input: string, steps: string[]): string {
  const next = input.replace(/([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)(\s*:)/g, '$1"$2"$3');
  if (next !== input) steps.push('quoted bare keys');
  return next;
}

function singleToDoubleQuotes(input: string, steps: string[]): string {
  let result = '';
  let inDouble = false;
  let inSingle = false;
  let escape = false;
  let changed = false;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (escape) {
      result += ch;
      escape = false;
      continue;
    }
    if (ch === '\\') {
      result += ch;
      escape = true;
      continue;
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      result += ch;
      continue;
    }
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      result += '"';
      changed = true;
      continue;
    }
    result += ch;
  }

  if (changed) steps.push('converted single quotes');
  return result;
}

export function repairJsonString(input: string): RepairResult | RepairFailure {
  const steps: string[] = [];

  let source = input;

  try {
    JSON.parse(source);
    return { repaired: source, steps };
  } catch {
    // continue repair
  }

  source = stripCodeFences(source, steps);
  source = convertSmartQuotes(source, steps);
  source = extractJsonBlock(source, steps);
  source = removeTrailingCommas(source, steps);

  try {
    JSON.parse(source);
    return { repaired: source, steps };
  } catch {
    // try more aggressive passes
  }

  source = quoteUnquotedKeys(source, steps);
  source = singleToDoubleQuotes(source, steps);
  source = removeTrailingCommas(source, steps);

  try {
    JSON.parse(source);
    return { repaired: source, steps };
  } catch (error) {
    return { steps, error: (error as Error).message };
  }
}
