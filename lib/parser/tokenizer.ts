import type { T3DNode } from "./types";
import { parsePinLine } from "./pins";
import { parseValue, stripQuotes } from "./properties";

interface RawBlock {
  header: string;
  bodyLines: string[];
  subBlocks: RawBlock[];
  raw: string;
}

const BEGIN_RE = /^\s*Begin\s+Object\b(.*)$/i;
const END_RE = /^\s*End\s+Object\s*$/i;

function splitBlocks(lines: string[], startIndex: number): {
  blocks: RawBlock[];
  consumed: number;
} {
  const blocks: RawBlock[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (END_RE.test(line)) {
      return { blocks, consumed: i - startIndex };
    }
    const m = line.match(BEGIN_RE);
    if (!m) {
      i++;
      continue;
    }
    const header = m[1].trim();
    const bodyStart = i + 1;
    const bodyLines: string[] = [];
    const subBlocks: RawBlock[] = [];
    let j = bodyStart;
    while (j < lines.length) {
      const inner = lines[j];
      if (END_RE.test(inner)) break;
      const innerBegin = inner.match(BEGIN_RE);
      if (innerBegin) {
        const sub = splitBlocks(lines, j);
        if (sub.blocks.length === 0) {
          // malformed — skip line
          j++;
          continue;
        }
        subBlocks.push(...sub.blocks);
        j += sub.consumed;
        // sub.consumed brings us to the End Object of the sub; consume it
        if (j < lines.length && END_RE.test(lines[j])) j++;
        continue;
      }
      bodyLines.push(inner);
      j++;
    }
    const endIdx = j;
    const raw = lines.slice(i, Math.min(endIdx + 1, lines.length)).join("\n");
    blocks.push({ header, bodyLines, subBlocks, raw });
    i = endIdx + 1; // skip past End Object
  }
  return { blocks, consumed: i - startIndex };
}

function parseHeader(header: string): { className: string; name: string } {
  // Header is the part after "Begin Object", e.g.
  //   Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
  const props: Record<string, string> = {};
  // tokenize by top-level whitespace, respecting quotes and parens
  let i = 0;
  while (i < header.length) {
    while (i < header.length && /\s/.test(header[i])) i++;
    if (i >= header.length) break;
    // read key
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

function blockToNode(block: RawBlock): T3DNode {
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
  const { blocks } = splitBlocks(lines, 0);
  return blocks.map(blockToNode);
}
