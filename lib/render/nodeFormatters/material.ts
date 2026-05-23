import type { T3DNode } from "../../parser/types";
import { stripQuotes } from "../../parser/properties";

type InputResolver = (pinName: string) => string | undefined;

/**
 * In UE Material paste data each visible node is a `MaterialGraphNode` wrapper
 * whose actual expression is one or two sub-objects (UE splits class
 * declaration and property assignment across two `Begin Object` blocks with
 * the same Name). This resolves the wrapper to a single effective expression
 * node — class from the declaration, properties merged from both.
 */
export function resolveExpression(node: T3DNode): T3DNode {
  if (node.className.includes("MaterialExpression")) {
    return mergeContinuations(node, node);
  }
  const decl = node.subObjects.find((s) =>
    s.className.includes("MaterialExpression"),
  );
  if (!decl) {
    // Try to derive the expression class from the MaterialExpression property:
    //   MaterialExpression=MaterialExpressionMultiply'"MaterialExpressionMultiply_0"'
    const me = node.properties.MaterialExpression;
    if (me) {
      const m = me.match(/^([A-Za-z0-9_]+)/);
      if (m) {
        const inferred: T3DNode = {
          ...node,
          className: `/Script/Engine.${m[1]}`,
        };
        return mergeContinuations(node, inferred);
      }
    }
    return node;
  }
  return mergeContinuations(node, decl);
}

function mergeContinuations(wrapper: T3DNode, base: T3DNode): T3DNode {
  const merged: Record<string, string> = { ...base.properties };
  for (const sub of wrapper.subObjects) {
    if (sub === base) continue;
    if (sub.name && base.name && sub.name !== base.name) continue;
    for (const [k, v] of Object.entries(sub.properties)) {
      if (!(k in merged)) merged[k] = v;
    }
  }
  // The wrapper's own pins live on the wrapper, not the expression — keep those.
  return {
    ...base,
    properties: merged,
    pins: wrapper.pins.length > 0 ? wrapper.pins : base.pins,
  };
}

/** Short, friendly name like `Multiply`, `TextureSample`, `Const3Vector`. */
export function exprFriendlyName(node: T3DNode): string {
  const expr = resolveExpression(node);
  const cls = expr.className.split(".").pop() ?? expr.className;
  return cls.replace(/^MaterialExpression/, "").replace(/^MaterialGraphNode_?/, "");
}

function constValue(expr: T3DNode): string | undefined {
  const cls = expr.className;
  if (cls.includes("MaterialExpressionConstant")) {
    if (cls.endsWith("Constant")) {
      return stripQuotes(expr.properties.R ?? expr.properties.Value ?? "0");
    }
    if (cls.endsWith("Constant2Vector")) {
      return `(${stripQuotes(expr.properties.R ?? "0")}, ${stripQuotes(expr.properties.G ?? "0")})`;
    }
    if (cls.endsWith("Constant3Vector")) {
      const c = expr.properties.Constant ?? "";
      if (c) return c;
      return `(${stripQuotes(expr.properties.R ?? "0")}, ${stripQuotes(expr.properties.G ?? "0")}, ${stripQuotes(expr.properties.B ?? "0")})`;
    }
    if (cls.endsWith("Constant4Vector")) {
      const c = expr.properties.Constant ?? "";
      if (c) return c;
      return `(${stripQuotes(expr.properties.R ?? "0")}, ${stripQuotes(expr.properties.G ?? "0")}, ${stripQuotes(expr.properties.B ?? "0")}, ${stripQuotes(expr.properties.A ?? "0")})`;
    }
  }
  if (cls.includes("MaterialExpressionScalarParameter")) {
    const name = stripQuotes(expr.properties.ParameterName ?? "Scalar");
    const def = stripQuotes(expr.properties.DefaultValue ?? "0");
    return `Param("${name}", ${def})`;
  }
  if (cls.includes("MaterialExpressionVectorParameter")) {
    const name = stripQuotes(expr.properties.ParameterName ?? "Vector");
    return `VectorParam("${name}")`;
  }
  if (cls.includes("MaterialExpressionStaticBoolParameter")) {
    const name = stripQuotes(expr.properties.ParameterName ?? "Bool");
    const def = stripQuotes(expr.properties.DefaultValue ?? "false");
    return `BoolParam("${name}", ${def})`;
  }
  return undefined;
}

export function formatMaterialExpression(
  node: T3DNode,
  resolve: InputResolver,
): string | undefined {
  const expr = resolveExpression(node);
  const cls = expr.className;
  const c = constValue(expr);
  if (c) return c;

  const fn = exprFriendlyName(node);

  if (cls.includes("MaterialExpressionTextureSampleParameter")) {
    const name = stripQuotes(expr.properties.ParameterName ?? "Tex");
    const uvs = resolve("UVs") ?? resolve("Coordinates");
    return `TextureParam("${name}"${uvs ? `, uv=${uvs}` : ""})`;
  }
  if (cls.includes("MaterialExpressionTextureSample")) {
    const tex = stripQuotes(expr.properties.Texture ?? "Texture");
    const uvs = resolve("UVs") ?? resolve("Coordinates");
    const texName = tex.split(/[\/.]/).pop() ?? tex;
    return `Texture("${texName}"${uvs ? `, uv=${uvs}` : ""})`;
  }
  if (cls.includes("MaterialExpressionAdd")) {
    return `(${resolve("A") ?? "0"} + ${resolve("B") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionSubtract")) {
    return `(${resolve("A") ?? "0"} - ${resolve("B") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionMultiply")) {
    return `(${resolve("A") ?? "0"} * ${resolve("B") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionDivide")) {
    return `(${resolve("A") ?? "0"} / ${resolve("B") ?? "1"})`;
  }
  if (cls.includes("MaterialExpressionPower")) {
    return `pow(${resolve("Base") ?? "0"}, ${resolve("Exponent") ?? "1"})`;
  }
  if (cls.includes("MaterialExpressionClamp")) {
    return `clamp(${resolve("Input") ?? "0"}, ${resolve("Min") ?? "0"}, ${resolve("Max") ?? "1"})`;
  }
  if (cls.includes("MaterialExpressionLinearInterpolate")) {
    return `lerp(${resolve("A") ?? "0"}, ${resolve("B") ?? "1"}, ${resolve("Alpha") ?? "0.5"})`;
  }
  if (cls.includes("MaterialExpressionOneMinus")) {
    return `(1 - ${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionSaturate")) {
    return `saturate(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionAbs")) {
    return `abs(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionFrac")) {
    return `frac(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionFloor")) {
    return `floor(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionCeil")) {
    return `ceil(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionSine")) {
    return `sin(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionCosine")) {
    return `cos(${resolve("Input") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionDotProduct")) {
    return `dot(${resolve("A") ?? "0"}, ${resolve("B") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionCrossProduct")) {
    return `cross(${resolve("A") ?? "0"}, ${resolve("B") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionNormalize")) {
    return `normalize(${resolve("Input") ?? resolve("VectorInput") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionAppendVector")) {
    return `append(${resolve("A") ?? "0"}, ${resolve("B") ?? "0"})`;
  }
  if (cls.includes("MaterialExpressionTextureCoordinate")) {
    const idx = stripQuotes(expr.properties.CoordinateIndex ?? "0");
    return `UV${idx}`;
  }
  if (cls.includes("MaterialExpressionComponentMask")) {
    const mask =
      (expr.properties.R === "True" ? "R" : "") +
      (expr.properties.G === "True" ? "G" : "") +
      (expr.properties.B === "True" ? "B" : "") +
      (expr.properties.A === "True" ? "A" : "");
    return `${resolve("Input") ?? "0"}.${mask || "xyz"}`;
  }
  if (cls.includes("MaterialExpressionIf")) {
    return `(${resolve("A") ?? "0"} <=> ${resolve("B") ?? "0"} ? ${resolve("AGreaterThanB") ?? resolve("A>B") ?? "?"} : ${resolve("ALessThanB") ?? resolve("A<B") ?? "?"})`;
  }
  if (cls.includes("MaterialExpressionFunctionOutput")) {
    return resolve("A") ?? resolve("Input") ?? undefined;
  }
  if (cls.includes("MaterialExpressionMaterialFunctionCall")) {
    const fnRef = stripQuotes(expr.properties.MaterialFunction ?? "");
    const fnName = fnRef.split(/[\/.]/).pop() ?? "MaterialFunction";
    const inputs = node.pins
      .filter((p) => p.direction === "input")
      .map((p) => `${p.name}=${resolve(p.name) ?? "0"}`);
    return `${fnName}(${inputs.join(", ")})`;
  }

  // Fallback — generic call with whatever inputs the wrapper exposes.
  const inputs = node.pins
    .filter((p) => p.direction === "input")
    .map((p) => `${p.name}=${resolve(p.name) ?? "0"}`);
  return `${fn}(${inputs.join(", ")})`;
}
