import type { T3DNode } from "./types";
import { parsePinLine } from "./pins";
import { parseValue, stripQuotes } from "./properties";

const BEGIN_RE = /^\s*Begin\s+Object\b(.*)$/i;
const END_RE = /^\s*End\s+Object\s*$/i;

interface ParsedBlock {
  header: string;
  bodyLines: string[];
  subBlocks: ParsedBlock[];
  raw: string;
}

/**
 * Parses a single `Begin Object` ... `End Object` block that starts at
 * `lines[startIdx]`. Returns the block and the index immediately after its
 * `End Object`. Properties and nested sub-blocks at the wrapper's level are
 * captured in `bodyLines` and `subBlocks` respectively.
 */
function parseBlockAt(
  lines: string[],
  startIdx: number,
): { block: ParsedBlock; endIdx: number } {
  const m = lines[startIdx].match(BEGIN_RE);
  if (!m) {
    throw new Error(`Expected 'Begin Object' at line ${startIdx + 1}`);
  }
  const header = m[1].trim();
  const bodyLines: string[] = [];
  const subBlocks: ParsedBlock[] = [];
  let i = startIdx + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (END_RE.test(line)) {
      const raw = lines.slice(startIdx, i + 1).join("\n");
      return {
        block: { header, bodyLines, subBlocks, raw },
        endIdx: i + 1,
      };
    }
    if (BEGIN_RE.test(line)) {
      const sub = parseBlockAt(lines, i);
      subBlocks.push(sub.block);
      i = sub.endIdx;
      continue;
    }
    bodyLines.push(line);
    i++;
  }
  // EOF without End Object — return what we have
  const raw = lines.slice(startIdx, i).join("\n");
  return {
    block: { header, bodyLines, subBlocks, raw },
    endIdx: i,
  };
}

function parseHeader(header: string): { className: string; name: string } {
  const props: Record<string, string> = {};
  let i = 0;
  while (i < header.length) {
    while (i < header.length && /\s/.test(header[i])) i++;
    if (i >= header.length) break;
    const keyStart = i;
    while (i < header.length && header[i] !== "=") i++;
    const key = header.slice(keyStart, i).trim();
    if (header[i] !== "=") break;
    i++;
    const { value, end } = parseValue(header, i);
    props[key] = value;
    i = end;
  }
  return {
    className: stripQuotes(props.Class ?? ""),
    name: stripQuotes(props.Name ?? ""),
  };
}

function isPinLine(line: string): boolean {
  return /^\s*CustomProperties\s+Pin\s*\(/i.test(line);
}

function blockToNode(block: ParsedBlock): T3DNode {
  const { className, name } = parseHeader(block.header);
  const properties: Record<string, string> = {};
  const pins = [];
  for (const line of block.bodyLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isPinLine(trimmed)) {
      const pin = parsePinLine(trimmed);
      if (pin) pins.push(pin);
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const rest = trimmed.slice(eq + 1);
    const { value } = parseValue(rest, 0);
    properties[key] = value;
  }
  const subObjects = block.subBlocks.map(blockToNode);
  return {
    name,
    className,
    properties,
    pins,
    subObjects,
    raw: block.raw,
  };
}

export function tokenize(input: string): T3DNode[] {
  const lines = input.replace(/\r\n/g, "\n").split("\n");
  const blocks: ParsedBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (BEGIN_RE.test(lines[i])) {
      const { block, endIdx } = parseBlockAt(lines, i);
      blocks.push(block);
      i = endIdx;
      continue;
    }
    i++;
  }
  return blocks.map(blockToNode);
}
