import type { ParsedGraph, Pin, T3DNode } from "../../parser/types";
import { parseStructFields, stripQuotes } from "../../parser/properties";

export interface FormatContext {
  resolveInput: (pin: Pin) => string;
  outputPinName?: string;
  /** Names of macros/functions whose body the user has also pasted, so we
   * shouldn't warn about them being missing. */
  knownDefinitions?: Set<string>;
}

export interface FormattedNode {
  statement: string;
  expression?: string;
  heading?: string;
  branches?: { pinName: string; label: string }[];
  warnings?: string[];
}

export function isExecPin(pin: Pin): boolean {
  return pin.type.category === "exec";
}

export function shortClassName(node: T3DNode): string {
  const cls = node.className.split(".").pop() ?? node.className;
  return cls.replace(/^K2Node_/, "");
}

function extractMemberRef(raw: string): { parent?: string; name?: string } {
  if (!raw) return {};
  const fields = parseStructFields(raw.replace(/^\(/, "").replace(/\)$/, ""));
  const memberName = fields.MemberName ? stripQuotes(fields.MemberName) : undefined;
  const selfContext =
    fields.bSelfContext && stripQuotes(fields.bSelfContext) === "True";
  let parent: string | undefined;
  if (selfContext) {
    parent = "self";
  } else if (fields.MemberParent) {
    parent = parseClassPathTail(fields.MemberParent);
  }
  return { parent, name: memberName };
}

/**
 * Pulls the trailing identifier out of a UE class reference like:
 *   Class'"/Script/Engine.KismetSystemLibrary"'
 *   BlueprintGeneratedClass'/Game/Blueprints/BP_Foo.BP_Foo_C'
 *   "/Script/Engine.Actor"
 * Returns just `KismetSystemLibrary`, `BP_Foo_C`, `Actor`. Avoids returning
 * the wrapping `Class` token by preferring path-like substrings.
 */
function parseClassPathTail(raw: string): string | undefined {
  const stripped = raw.replace(/['"]/g, "");
  // Prefer the segment after the last `.`, `/`, or `:` separator.
  const m = stripped.match(/[\/.:]([A-Za-z0-9_]+)\s*$/);
  if (m) return m[1];
  const tokens = stripped.split(/[\s/.:]+/).filter(Boolean);
  return tokens[tokens.length - 1];
}

/**
 * Parses a `MacroGraphReference=(MacroGraph=...,GraphBlueprint=...)` value
 * into its macro name and owning-asset path. Handles both shapes UE has
 * emitted over the years:
 *
 *   MacroGraph=EdGraph'"/Engine/.../StandardMacros.StandardMacros:ForEachLoop"'
 *   MacroGraph="/Script/Engine.EdGraph'MacroName'"
 *
 * In the second form the asset path lives on the sibling `GraphBlueprint`
 * field instead of being suffixed onto the MacroGraph value.
 */
export function extractGraphRef(
  raw: string,
): { assetPath?: string; graphName?: string; isEngine?: boolean } {
  if (!raw) return {};
  const fields = parseStructFields(raw.replace(/^\(/, "").replace(/\)$/, ""));
  const graphRef = fields.MacroGraph ?? fields.GraphReference;
  if (!graphRef) return {};

  // Peel off a single layer of outer double quotes if present.
  let working = graphRef.trim();
  if (working.startsWith('"') && working.endsWith('"')) {
    working = working.slice(1, -1);
  }

  // The innermost reference is whatever sits between the deepest quote pair.
  const innerDouble = working.match(/"([^"]+)"/)?.[1];
  const innerSingle = working.match(/'([^']+)'/)?.[1];
  const inner = innerDouble ?? innerSingle ?? working;

  let assetPath: string | undefined;
  let graphName: string | undefined;
  if (inner.includes(":")) {
    const colonIdx = inner.lastIndexOf(":");
    assetPath = inner.slice(0, colonIdx);
    graphName = inner.slice(colonIdx + 1);
  } else if (inner.startsWith("/")) {
    assetPath = inner;
  } else {
    graphName = inner;
    // Asset path lives on the GraphBlueprint sibling in this format.
    const bpRaw = fields.GraphBlueprint;
    if (bpRaw) {
      let bp = bpRaw.trim();
      if (bp.startsWith('"') && bp.endsWith('"')) bp = bp.slice(1, -1);
      assetPath =
        bp.match(/'([^']+)'/)?.[1] ?? bp.match(/"([^"]+)"/)?.[1] ?? bp;
    }
  }

  return {
    assetPath,
    graphName,
    isEngine: assetPath?.startsWith("/Engine/") ?? false,
  };
}

function inputPins(node: T3DNode, opts?: { skipFirstExec?: boolean; skipSelf?: boolean }): Pin[] {
  const result: Pin[] = [];
  let execSkipped = false;
  for (const pin of node.pins) {
    if (pin.direction !== "input") continue;
    if (isExecPin(pin)) {
      if (opts?.skipFirstExec && !execSkipped) {
        execSkipped = true;
        continue;
      }
      continue;
    }
    if (opts?.skipSelf && pin.name === "self") continue;
    result.push(pin);
  }
  return result;
}

function argList(node: T3DNode, ctx: FormatContext): string {
  const args = inputPins(node, { skipFirstExec: true, skipSelf: true }).map(
    (p) => `${p.name}=${ctx.resolveInput(p)}`,
  );
  return args.join(", ");
}

export function formatBlueprintNode(node: T3DNode, ctx: FormatContext): FormattedNode {
  const cls = node.className;

  if (cls.includes("K2Node_Event")) {
    const ref = extractMemberRef(node.properties.EventReference ?? "");
    const name = ref.name ?? "Event";
    return {
      statement: `Event ${name}`,
      heading: `Event ${name}${ref.parent ? ` (from ${ref.parent})` : ""}`,
      expression: ctx.outputPinName ? `${name}.${ctx.outputPinName}` : name,
    };
  }
  if (cls.includes("K2Node_CustomEvent")) {
    const name = stripQuotes(node.properties.CustomFunctionName ?? "CustomEvent");
    return {
      statement: `CustomEvent ${name}`,
      heading: `CustomEvent ${name}`,
      expression: ctx.outputPinName ? `${name}.${ctx.outputPinName}` : name,
    };
  }
  if (cls.includes("K2Node_FunctionEntry")) {
    const ref = extractMemberRef(node.properties.FunctionReference ?? "");
    const name = ref.name ?? "Function";
    return {
      statement: `function ${name}()`,
      heading: `function ${name}`,
      expression: ctx.outputPinName ? `${name}.${ctx.outputPinName}` : name,
    };
  }
  if (cls.includes("K2Node_Tunnel")) {
    const isEntry =
      stripQuotes(node.properties.bCanHaveOutputs ?? "False") === "True";
    const label = isEntry ? "entry" : "exit";
    return {
      statement: label,
      heading: isEntry ? "Entry" : "Exit",
      expression: ctx.outputPinName ? `${label}.${ctx.outputPinName}` : label,
    };
  }
  if (cls.includes("K2Node_Knot")) {
    // Reroute / passthrough — just forward the input value through.
    const dataIn = node.pins.find(
      (p) => p.direction === "input" && !isExecPin(p),
    );
    if (dataIn) {
      const value = ctx.resolveInput(dataIn);
      return { statement: value, expression: value };
    }
    return { statement: "(knot)", expression: "" };
  }
  if (cls.includes("K2Node_BreakStruct") || cls.includes("K2Node_BreakStructure")) {
    const structInput = node.pins.find(
      (p) => p.direction === "input" && !isExecPin(p),
    );
    const structValue = structInput ? ctx.resolveInput(structInput) : "?";
    return {
      statement: `break ${structValue}`,
      expression: ctx.outputPinName
        ? `${structValue}.${ctx.outputPinName}`
        : `break(${structValue})`,
    };
  }
  if (cls.includes("K2Node_CallFunction")) {
    const ref = extractMemberRef(node.properties.FunctionReference ?? "");
    const target = ref.parent ?? "self";
    const fn = ref.name ?? shortClassName(node);
    const stmt = `${target}.${fn}(${argList(node, ctx)})`;
    const outputs = node.pins.filter(
      (p) => p.direction === "output" && !isExecPin(p),
    );
    const out = outputs.find((p) => p.name === ctx.outputPinName) ?? outputs[0];
    return {
      statement: stmt,
      expression: out ? `${target}.${fn}(${argList(node, ctx)})` : stmt,
    };
  }
  if (cls.includes("K2Node_IfThenElse") || cls.includes("K2Node_Branch")) {
    const cond = node.pins.find((p) => p.direction === "input" && p.name === "Condition");
    const condText = cond ? ctx.resolveInput(cond) : "?";
    return {
      statement: `if (${condText})`,
      branches: [
        { pinName: "then", label: "then" },
        { pinName: "else", label: "else" },
      ],
    };
  }
  if (cls.includes("K2Node_ExecutionSequence")) {
    const branches = node.pins
      .filter((p) => p.direction === "output" && isExecPin(p))
      .map((p) => ({ pinName: p.name, label: p.name }));
    return { statement: `sequence`, branches };
  }
  if (cls.includes("K2Node_MacroInstance")) {
    const ref = extractGraphRef(node.properties.MacroGraphReference ?? "");
    const macroName = ref.graphName ?? "Macro";
    const args = inputPins(node, { skipFirstExec: true, skipSelf: true }).map(
      (p) => `${p.name}=${ctx.resolveInput(p)}`,
    );
    const execOutputs = node.pins.filter(
      (p) => p.direction === "output" && isExecPin(p),
    );
    return {
      statement: `${macroName}(${args.join(", ")})`,
      expression: ctx.outputPinName
        ? `${macroName}.${ctx.outputPinName}`
        : macroName,
      branches:
        execOutputs.length >= 2
          ? execOutputs.map((p) => ({ pinName: p.name, label: p.name }))
          : undefined,
    };
  }
  if (cls.includes("K2Node_VariableGet")) {
    const ref = extractMemberRef(node.properties.VariableReference ?? "");
    const name = ref.name ?? "Var";
    return {
      statement: `get ${name}`,
      expression: name,
    };
  }
  if (cls.includes("K2Node_VariableSet")) {
    const ref = extractMemberRef(node.properties.VariableReference ?? "");
    const name = ref.name ?? "Var";
    const valuePin = node.pins.find(
      (p) => p.direction === "input" && !isExecPin(p) && p.name !== "self",
    );
    const value = valuePin ? ctx.resolveInput(valuePin) : "?";
    return { statement: `set ${name} = ${value}` };
  }
  if (cls.includes("K2Node_Literal") || cls.includes("K2Node_Self")) {
    return { statement: `self`, expression: "self" };
  }
  if (cls.includes("K2Node_DynamicCast")) {
    const targetType = stripQuotes(node.properties.TargetType ?? "");
    const objPin = node.pins.find((p) => p.direction === "input" && p.name === "Object");
    const obj = objPin ? ctx.resolveInput(objPin) : "?";
    return {
      statement: `cast<${targetType.split(".").pop() ?? "?"}>(${obj})`,
      expression: `cast<${targetType.split(".").pop() ?? "?"}>(${obj})`,
      branches: [
        { pinName: "then", label: "Cast Succeeded" },
        { pinName: "CastFailed", label: "Cast Failed" },
      ],
    };
  }
  if (cls.includes("K2Node_MakeArray")) {
    const items = node.pins
      .filter((p) => p.direction === "input" && !isExecPin(p))
      .map((p) => ctx.resolveInput(p));
    return {
      statement: `[${items.join(", ")}]`,
      expression: `[${items.join(", ")}]`,
    };
  }
  if (cls.includes("K2Node_MakeStruct") || cls.includes("K2Node_MakeStructure")) {
    const items = inputPins(node, { skipFirstExec: true, skipSelf: true }).map(
      (p) => `${p.name}=${ctx.resolveInput(p)}`,
    );
    return {
      statement: `make_struct(${items.join(", ")})`,
      expression: `{${items.join(", ")}}`,
    };
  }
  if (cls.includes("K2Node_MathExpression")) {
    const rawExpr = stripQuotes(node.properties.Expression ?? "").trim();
    const inputs = inputPins(node, { skipFirstExec: true, skipSelf: true });
    const resolved = inputs.map((p) => ({ name: p.name, value: ctx.resolveInput(p) }));
    let body = rawExpr || inputs.map((p) => p.name).join(" ? ");
    // Substitute each named input variable with its resolved expression. Sort
    // by descending name length so a variable like `A` doesn't clobber `Abs`.
    const sorted = [...resolved].sort((a, b) => b.name.length - a.name.length);
    for (const { name, value } of sorted) {
      if (!name) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(`\\b${escaped}\\b`, "g");
      body = body.replace(re, `(${value})`);
    }
    return {
      statement: body,
      expression: body,
    };
  }
  if (cls.includes("K2Node_CommutativeAssociativeBinaryOperator") || cls.includes("K2Node_PromotableOperator")) {
    const ref = extractMemberRef(node.properties.FunctionReference ?? "");
    const op = ref.name ?? "op";
    const args = inputPins(node, { skipFirstExec: true, skipSelf: true }).map((p) =>
      ctx.resolveInput(p),
    );
    return {
      statement: `${op}(${args.join(", ")})`,
      expression: `${op}(${args.join(", ")})`,
    };
  }
  // Fallback
  const args = argList(node, ctx);
  const short = shortClassName(node);
  return {
    statement: args ? `${short}(${args})` : short,
    expression: args ? `${short}(${args})` : short,
  };
}

/** Walks the graph for warnings that should surface regardless of which
 * output format the user picks — currently just "custom macro body not in
 * paste". Independent of the per-node formatter pass so YAML/JSON output
 * gets the same warnings as Markdown. */
export function collectMacroWarnings(
  graph: ParsedGraph,
  knownDefinitions: Set<string>,
): string[] {
  const out = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.className.includes("K2Node_MacroInstance")) continue;
    const ref = extractGraphRef(node.properties.MacroGraphReference ?? "");
    const macroName = ref.graphName ?? "Macro";
    if (!ref.assetPath || ref.isEngine || knownDefinitions.has(macroName))
      continue;
    out.add(
      `Macro \`${macroName}\` is custom (${ref.assetPath}) — its body is not in the paste; only the call site is shown. Paste its graph separately to include the body.`,
    );
  }
  return [...out];
}
