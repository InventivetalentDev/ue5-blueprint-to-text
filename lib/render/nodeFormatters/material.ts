import type { T3DNode } from "../../parser/types";
import { stripQuotes } from "../../parser/properties";

type InputResolver = (pinName: string) => string | undefined;

function exprName(node: T3DNode): string {
  const cls = node.className.split(".").pop() ?? node.className;
  return cls.replace(/^MaterialExpression/, "").replace(/^MaterialGraphNode_/, "");
}

function constValue(node: T3DNode): string | undefined {
  const cls = node.className;
  if (cls.includes("MaterialExpressionConstant")) {
    if (cls.endsWith("Constant")) {
      return stripQuotes(node.properties.R ?? node.properties.Value ?? "0");
    }
    if (cls.endsWith("Constant2Vector")) {
      return `(${stripQuotes(node.properties.R ?? "0")}, ${stripQuotes(node.properties.G ?? "0")})`;
    }
    if (cls.endsWith("Constant3Vector")) {
      const c = node.properties.Constant ?? "";
      if (c) return c;
      return `(${stripQuotes(node.properties.R ?? "0")}, ${stripQuotes(node.properties.G ?? "0")}, ${stripQuotes(node.properties.B ?? "0")})`;
    }
    if (cls.endsWith("Constant4Vector")) {
      const c = node.properties.Constant ?? "";
      if (c) return c;
      return `(${stripQuotes(node.properties.R ?? "0")}, ${stripQuotes(node.properties.G ?? "0")}, ${stripQuotes(node.properties.B ?? "0")}, ${stripQuotes(node.properties.A ?? "0")})`;
    }
  }
  if (cls.includes("MaterialExpressionScalarParameter")) {
    const name = stripQuotes(node.properties.ParameterName ?? "Scalar");
    const def = stripQuotes(node.properties.DefaultValue ?? "0");
    return `Param("${name}", ${def})`;
  }
  if (cls.includes("MaterialExpressionVectorParameter")) {
    const name = stripQuotes(node.properties.ParameterName ?? "Vector");
    return `VectorParam("${name}")`;
  }
  if (cls.includes("MaterialExpressionTextureSampleParameter")) {
    const name = stripQuotes(node.properties.ParameterName ?? "Tex");
    return `TextureParam("${name}")`;
  }
  return undefined;
}

export function formatMaterialExpression(
  node: T3DNode,
  resolve: InputResolver,
): string | undefined {
  const cls = node.className;
  const c = constValue(node);
  if (c) return c;

  const fn = exprName(node);
  if (cls.includes("MaterialExpressionTextureSample")) {
    const tex = stripQuotes(node.properties.Texture ?? "Texture");
    const uvs = resolve("UVs") ?? resolve("Coordinates") ?? "UV";
    return `Texture("${tex.split(".").pop() ?? tex}", uv=${uvs})`;
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
  if (cls.includes("MaterialExpressionTextureCoordinate")) {
    const idx = stripQuotes(node.properties.CoordinateIndex ?? "0");
    return `UV${idx}`;
  }
  if (cls.includes("MaterialExpressionComponentMask")) {
    const mask =
      (node.properties.R === "True" ? "R" : "") +
      (node.properties.G === "True" ? "G" : "") +
      (node.properties.B === "True" ? "B" : "") +
      (node.properties.A === "True" ? "A" : "");
    return `${resolve("Input") ?? "0"}.${mask || "xyz"}`;
  }
  if (cls.includes("MaterialExpressionFunctionOutput")) {
    return resolve("A") ?? resolve("Input") ?? undefined;
  }

  // Fallback — generic call with whatever inputs the node declares
  const inputs = node.pins
    .filter((p) => p.direction === "input")
    .map((p) => `${p.name}=${resolve(p.name) ?? "0"}`);
  return `${fn}(${inputs.join(", ")})`;
}
