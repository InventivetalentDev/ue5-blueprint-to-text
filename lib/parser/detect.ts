import type { GraphKind, T3DNode } from "./types";

const MATERIAL_PREFIXES = [
  "/Script/Engine.MaterialExpression",
  "/Script/UnrealEd.MaterialGraphNode",
  "MaterialGraphNode",
  "MaterialExpression",
];

const BLUEPRINT_PREFIXES = [
  "/Script/BlueprintGraph.",
  "/Script/UnrealEd.EdGraphNode",
  "/Script/AnimGraph.",
  "K2Node_",
];

function classMatches(className: string, prefixes: string[]): boolean {
  return prefixes.some((p) => className.startsWith(p) || className.includes(p));
}

export function detectKind(nodes: T3DNode[]): GraphKind {
  if (nodes.length === 0) return "unknown";
  let material = 0;
  let blueprint = 0;
  for (const n of nodes) {
    if (classMatches(n.className, MATERIAL_PREFIXES)) material++;
    else if (classMatches(n.className, BLUEPRINT_PREFIXES)) blueprint++;
  }
  if (material > 0 && material >= blueprint) return "material";
  if (blueprint > 0) return "blueprint";
  return "unknown";
}
