import type { Edge, ParsedGraph, T3DNode } from "./types";
import { tokenize } from "./tokenizer";
import { detectKind } from "./detect";

export function resolveEdges(nodes: T3DNode[]): {
  edges: Edge[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const byName = new Map<string, T3DNode>();
  for (const n of nodes) byName.set(n.name, n);

  const edges: Edge[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    for (const pin of node.pins) {
      if (pin.direction !== "output") continue;
      for (const link of pin.linkedTo) {
        const target = byName.get(link.nodeName);
        if (!target) {
          warnings.push(
            `Dangling LinkedTo: ${node.name}.${pin.name} -> ${link.nodeName} (not in selection)`,
          );
          continue;
        }
        const targetPin = target.pins.find((p) => p.id === link.pinId);
        if (!targetPin) {
          warnings.push(
            `Dangling pin: ${node.name}.${pin.name} -> ${link.nodeName}.<unknown pin ${link.pinId.slice(0, 8)}>`,
          );
          continue;
        }
        const key = `${node.name}|${pin.id}->${target.name}|${targetPin.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push({
          from: { nodeName: node.name, pinId: pin.id, pinName: pin.name },
          to: {
            nodeName: target.name,
            pinId: targetPin.id,
            pinName: targetPin.name,
          },
        });
      }
    }
  }
  return { edges, warnings };
}

export function parse(input: string, kindOverride?: ParsedGraph["kind"]): ParsedGraph {
  const nodes = tokenize(input);
  const { edges, warnings } = resolveEdges(nodes);
  const kind = kindOverride ?? detectKind(nodes);
  return { kind, nodes, edges, warnings };
}
