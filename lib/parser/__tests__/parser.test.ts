import { describe, expect, it } from "vitest";
import { parse } from "../graph";
import { parseValue, parseStructFields, stripQuotes } from "../properties";

const BP_SAMPLE = `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="K2Node_Event_0"
   EventReference=(MemberParent=Class'"/Script/Engine.Actor"',MemberName="ReceiveBeginPlay")
   NodePosX=0
   NodePosY=0
   NodeGuid=AAAA0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="then",PinType.PinCategory="exec",PinType.PinSubCategory="",PinType.PinSubCategoryObject=None,PinType.ContainerType=None,PinType.bIsReference=False,Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="PrintString")
   NodePosX=200
   NodePosY=0
   NodeGuid=AAAA0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",PinType.PinSubCategory="",PinType.PinSubCategoryObject=None,PinType.ContainerType=None,PinType.bIsReference=False,LinkedTo=(K2Node_Event_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="InString",PinType.PinCategory="string",PinType.PinSubCategory="",PinType.PinSubCategoryObject=None,PinType.ContainerType=None,PinType.bIsReference=False,DefaultValue="Hello")
End Object`;

describe("parseValue", () => {
  it("captures a balanced struct value", () => {
    const r = parseValue("(A=1,B=(X=2,Y=3))", 0);
    expect(r.value).toBe("(A=1,B=(X=2,Y=3))");
    expect(r.end).toBe(17);
  });
  it("captures a quoted string with spaces", () => {
    const r = parseValue('"hello world" rest', 0);
    expect(r.value).toBe('"hello world"');
  });
  it("stops at top-level whitespace", () => {
    const r = parseValue("Class=/Foo Name=Bar", 6);
    expect(r.value).toBe("/Foo");
  });
});

describe("parseStructFields", () => {
  it("parses comma-separated fields with nesting", () => {
    const fields = parseStructFields(
      'MemberParent=Class\'"/Script/Engine.Actor"\',MemberName="ReceiveBeginPlay"',
    );
    expect(stripQuotes(fields.MemberName)).toBe("ReceiveBeginPlay");
    expect(fields.MemberParent).toMatch(/Engine\.Actor/);
  });
});

describe("parse (full pipeline)", () => {
  it("parses two nodes and resolves the edge between them", () => {
    const g = parse(BP_SAMPLE);
    expect(g.nodes).toHaveLength(2);
    expect(g.nodes[0].name).toBe("K2Node_Event_0");
    expect(g.nodes[0].className).toBe("/Script/BlueprintGraph.K2Node_Event");
    expect(g.kind).toBe("blueprint");
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0].from.nodeName).toBe("K2Node_Event_0");
    expect(g.edges[0].to.nodeName).toBe("K2Node_CallFunction_0");
    expect(g.edges[0].from.pinName).toBe("then");
    expect(g.edges[0].to.pinName).toBe("execute");
    expect(g.warnings).toHaveLength(0);
  });

  it("warns on dangling LinkedTo references", () => {
    const partial = `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="K2Node_Event_X"
   NodeGuid=AAAA0003000000000000000000000003
   CustomProperties Pin (PinId=99999999999999999999999999999999,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_Missing 12345678123456781234567812345678,))
End Object`;
    const g = parse(partial);
    expect(g.warnings.length).toBeGreaterThan(0);
    expect(g.warnings[0]).toMatch(/Dangling/);
  });

  it("detects material kind", () => {
    const mat = `Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="Mul_0"
   MaterialExpressionGuid=AAAA1000000000000000000000000001
   CustomProperties Pin (PinId=AAAA1100000000000000000000000001,PinName="A",PinType.PinCategory="materialinput",Direction="EGPD_Input",LinkedTo=())
End Object`;
    const g = parse(mat);
    expect(g.kind).toBe("material");
  });

  it("respects kind override", () => {
    const g = parse(BP_SAMPLE, "material");
    expect(g.kind).toBe("material");
  });
});
