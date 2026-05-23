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

/**
 * Pulls a graph (macro/function) name out of the `ExportPath` carried on
 * `K2Node_Tunnel` or `K2Node_FunctionEntry` nodes. UE encodes the path as
 *   /Script/BlueprintGraph.K2Node_Tunnel'/Game/MyBP.MyBP:GraphName.K2Node_Tunnel_0'
 * — the segment between `:` and `.K2Node_(Tunnel|FunctionEntry)_N` is the
 * graph name the user can use to label a definition card.
 */
export function detectDefinitionInfo(t3d: string): {
  name?: string;
  kind?: "macro" | "function";
} {
  if (!t3d || !t3d.trim()) return {};
  // The ExportPath value itself contains single quotes (UObject ref syntax),
  // so we only treat the wrapping double quote as the value terminator.
  const tunnel = t3d.match(
    /ExportPath="[^"]*?:([A-Za-z_][A-Za-z0-9_]*)\.K2Node_Tunnel_\d+/,
  );
  if (tunnel) return { name: tunnel[1], kind: "macro" };
  const fnEntry = t3d.match(
    /ExportPath="[^"]*?:([A-Za-z_][A-Za-z0-9_]*)\.K2Node_FunctionEntry_\d+/,
  );
  if (fnEntry) return { name: fnEntry[1], kind: "function" };
  return {};
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
