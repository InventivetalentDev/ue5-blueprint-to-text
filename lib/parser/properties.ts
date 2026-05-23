export interface ParseValueResult {
  value: string;
  end: number;
}

/**
 * Parses a T3D value starting at `start`. Consumes balanced parens and
 * quoted strings. Stops at top-level whitespace or end of input.
 */
export function parseValue(input: string, start: number): ParseValueResult {
  let i = start;
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  while (i < input.length) {
    const c = input[i];
    if (inDouble) {
      if (c === "\\" && i + 1 < input.length) {
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      i++;
      continue;
    }
    if (inSingle) {
      if (c === "\\" && i + 1 < input.length) {
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === ")") {
      if (depth === 0) break;
      depth--;
      i++;
      continue;
    }
    if (depth === 0 && /\s/.test(c)) break;
    i++;
  }
  return { value: input.slice(start, i), end: i };
}

export function stripQuotes(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return t;
}

/**
 * Parses the inside of a struct value like `A=1,B="x",C=(D=2)` into
 * key/value pairs (values keep their raw T3D form so callers can re-parse).
 */
export function parseStructFields(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < input.length) {
    while (i < input.length && /[\s,]/.test(input[i])) i++;
    if (i >= input.length) break;
    const keyStart = i;
    while (i < input.length && input[i] !== "=" && input[i] !== ",") i++;
    if (i >= input.length || input[i] === ",") {
      // bare token, no key — skip
      continue;
    }
    const key = input.slice(keyStart, i).trim();
    i++; // skip =
    const { value, end } = parseStructValue(input, i);
    out[key] = value;
    i = end;
  }
  return out;
}

/**
 * Like parseValue but the top-level delimiter is `,` rather than whitespace.
 */
export function parseStructValue(
  input: string,
  start: number,
): ParseValueResult {
  let i = start;
  let depth = 0;
  let inDouble = false;
  let inSingle = false;
  while (i < input.length) {
    const c = input[i];
    if (inDouble) {
      if (c === "\\" && i + 1 < input.length) {
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      i++;
      continue;
    }
    if (inSingle) {
      if (c === "\\" && i + 1 < input.length) {
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      i++;
      continue;
    }
    if (c === "'") {
      inSingle = true;
      i++;
      continue;
    }
    if (c === "(") {
      depth++;
      i++;
      continue;
    }
    if (c === ")") {
      if (depth === 0) break;
      depth--;
      i++;
      continue;
    }
    if (depth === 0 && c === ",") break;
    i++;
  }
  return { value: input.slice(start, i).trim(), end: i };
}

/** Strip a single outer pair of parens if present. */
export function unwrapParens(s: string): string {
  const t = s.trim();
  if (t.startsWith("(") && t.endsWith(")")) return t.slice(1, -1);
  return t;
}
