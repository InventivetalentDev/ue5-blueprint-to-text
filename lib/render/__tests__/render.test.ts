import { describe, expect, it } from "vitest";
import { parse } from "../../parser/graph";
import { renderMarkdown } from "../markdown";
import { renderJson, renderYaml } from "../structured";

const BP = `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="K2Node_Event_0"
   EventReference=(MemberParent=Class'"/Script/Engine.Actor"',MemberName="ReceiveBeginPlay")
   NodeGuid=AAAA0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="PrintString")
   NodeGuid=AAAA0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_Event_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="InString",PinType.PinCategory="string",DefaultValue="Hello")
   CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="bPrintToScreen",PinType.PinCategory="bool",DefaultValue="true")
End Object`;

const MAT = `Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="Mul_0"
   MaterialExpressionGuid=AAAA1000000000000000000000000001
   CustomProperties Pin (PinId=10000000000000000000000000000001,PinName="A",PinType.PinCategory="materialinput",Direction="EGPD_Input",LinkedTo=(Const_0 10000000000000000000000000000003,))
   CustomProperties Pin (PinId=10000000000000000000000000000002,PinName="Output",PinType.PinCategory="materialoutput",Direction="EGPD_Output",LinkedTo=(Root_0 10000000000000000000000000000004,))
End Object
Begin Object Class=/Script/Engine.MaterialExpressionConstant3Vector Name="Const_0"
   Constant=(R=1.0,G=0.5,B=0.2)
   MaterialExpressionGuid=AAAA2000000000000000000000000002
   CustomProperties Pin (PinId=10000000000000000000000000000003,PinName="RGB",PinType.PinCategory="materialoutput",Direction="EGPD_Output",LinkedTo=(Mul_0 10000000000000000000000000000001,))
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="Root_0"
   MaterialExpressionGuid=AAAA3000000000000000000000000003
   CustomProperties Pin (PinId=10000000000000000000000000000004,PinName="BaseColor",PinType.PinCategory="materialinput",Direction="EGPD_Input",LinkedTo=(Mul_0 10000000000000000000000000000002,))
End Object`;

describe("renderMarkdown — blueprint", () => {
  it("renders the event header and call chain", () => {
    const g = parse(BP);
    const md = renderMarkdown(g);
    expect(md).toMatch(/# Blueprint Graph/);
    expect(md).toMatch(/Event ReceiveBeginPlay/);
    expect(md).toMatch(/PrintString/);
    expect(md).toMatch(/InString=/);
  });
});

describe("renderMarkdown — material", () => {
  it("emits a BaseColor = expression", () => {
    const g = parse(MAT);
    expect(g.kind).toBe("material");
    const md = renderMarkdown(g);
    expect(md).toMatch(/# Material Graph/);
    expect(md).toMatch(/BaseColor = /);
  });

  it("resolves MaterialGraphNode wrappers to their expression class", () => {
    const wrapped = `Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_0"
   Begin Object Class=/Script/Engine.MaterialExpressionMultiply Name="MaterialExpressionMultiply_0"
   End Object
   Begin Object Name="MaterialExpressionMultiply_0"
      MaterialExpressionGuid=BBBB0001000000000000000000000001
   End Object
   MaterialExpression=MaterialExpressionMultiply'"MaterialExpressionMultiply_0"'
   NodeGuid=CCCC0001000000000000000000000001
   CustomProperties Pin (PinId=10000000000000000000000000000001,PinName="A",PinType.PinCategory="materialinput",Direction="EGPD_Input",LinkedTo=(MaterialGraphNode_1 10000000000000000000000000000003,))
   CustomProperties Pin (PinId=10000000000000000000000000000002,PinName="Output",PinType.PinCategory="materialoutput",Direction="EGPD_Output",LinkedTo=(MaterialGraphNode_Root_0 10000000000000000000000000000004,))
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode Name="MaterialGraphNode_1"
   Begin Object Class=/Script/Engine.MaterialExpressionConstant3Vector Name="MaterialExpressionConstant3Vector_0"
   End Object
   Begin Object Name="MaterialExpressionConstant3Vector_0"
      Constant=(R=1.0,G=0.5,B=0.2)
      MaterialExpressionGuid=BBBB0002000000000000000000000002
   End Object
   MaterialExpression=MaterialExpressionConstant3Vector'"MaterialExpressionConstant3Vector_0"'
   NodeGuid=CCCC0002000000000000000000000002
   CustomProperties Pin (PinId=10000000000000000000000000000003,PinName="RGB",PinType.PinCategory="materialoutput",Direction="EGPD_Output",LinkedTo=(MaterialGraphNode_0 10000000000000000000000000000001,))
End Object
Begin Object Class=/Script/UnrealEd.MaterialGraphNode_Root Name="MaterialGraphNode_Root_0"
   NodeGuid=CCCC0003000000000000000000000003
   CustomProperties Pin (PinId=10000000000000000000000000000004,PinName="BaseColor",PinType.PinCategory="materialinput",Direction="EGPD_Input",LinkedTo=(MaterialGraphNode_0 10000000000000000000000000000002,))
End Object`;
    const g = parse(wrapped);
    expect(g.kind).toBe("material");
    const md = renderMarkdown(g);
    expect(md).toMatch(/# Material Graph/);
    expect(md).toMatch(/BaseColor = /);
    // The Multiply expression should appear, not the bare "MaterialGraphNode" wrapper
    expect(md).toMatch(/\*/);
    expect(md).not.toMatch(/MaterialGraphNode\(\)/);
    expect(md).toMatch(/R=1\.0/);
  });
});

describe("structured renderers", () => {
  it("renderYaml includes kind and nodes and edges", () => {
    const g = parse(BP);
    const y = renderYaml(g);
    expect(y).toMatch(/kind: blueprint/);
    expect(y).toMatch(/K2Node_Event_0/);
    expect(y).toMatch(/edges:/);
  });
  it("renderJson round-trips via JSON.parse", () => {
    const g = parse(BP);
    const j = renderJson(g);
    const obj = JSON.parse(j);
    expect(obj.kind).toBe("blueprint");
    expect(obj.nodes).toHaveLength(2);
    expect(obj.edges).toHaveLength(1);
  });
});
