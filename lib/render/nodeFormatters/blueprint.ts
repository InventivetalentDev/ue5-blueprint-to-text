import type { Pin, T3DNode } from "../../parser/types";
import { parseStructFields, stripQuotes } from "../../parser/properties";

export interface FormatContext {
  resolveInput: (pin: Pin) => string;
  outputPinName?: string;
}

export interface FormattedNode {
  statement: string;
  expression?: string;
  heading?: string;
  branches?: { pinName: string; label: string }[];
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
  const parentRaw = fields.MemberParent;
  let parent: string | undefined;
  if (parentRaw) {
    const m = parentRaw.match(/['"]([^'"]+)['"]/);
    if (m) {
      const last = m[1].split(/[\/.]/).pop();
      parent = last;
    }
  }
  return { parent, name: memberName };
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
    };
  }
  if (cls.includes("K2Node_CustomEvent")) {
    const name = stripQuotes(node.properties.CustomFunctionName ?? "CustomEvent");
    return {
      statement: `CustomEvent ${name}`,
      heading: `CustomEvent ${name}`,
    };
  }
  if (cls.includes("K2Node_FunctionEntry")) {
    const ref = extractMemberRef(node.properties.FunctionReference ?? "");
    const name = ref.name ?? "Function";
    return {
      statement: `function ${name}()`,
      heading: `function ${name}`,
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
