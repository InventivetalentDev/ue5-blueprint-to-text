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

describe("renderMarkdown — macros", () => {
  const macroBP = (assetPath: string, graphName: string) => `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="K2Node_Event_0"
   EventReference=(MemberParent=Class'"/Script/Engine.Actor"',MemberName="ReceiveBeginPlay")
   NodeGuid=AAAA0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_MacroInstance_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_MacroInstance Name="K2Node_MacroInstance_0"
   MacroGraphReference=(MacroGraph=EdGraph'"${assetPath}:${graphName}"',GraphBlueprint=Blueprint'"${assetPath}"',GraphGuid=DEAD0000000000000000000000000001)
   NodeGuid=AAAA0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_Event_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="Array",PinType.PinCategory="wildcard",PinType.ContainerType=Array,Direction="EGPD_Input")
   CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="LoopBody",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=())
   CustomProperties Pin (PinId=55555555555555555555555555555555,PinName="ArrayElement",PinType.PinCategory="wildcard",Direction="EGPD_Output")
   CustomProperties Pin (PinId=66666666666666666666666666666666,PinName="ArrayIndex",PinType.PinCategory="int",Direction="EGPD_Output")
   CustomProperties Pin (PinId=77777777777777777777777777777777,PinName="Completed",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=())
End Object`;

  it("renders engine macros with the macro name and exec branches", () => {
    const g = parse(
      macroBP(
        "/Engine/EditorBlueprintResources/StandardMacros.StandardMacros",
        "ForEachLoop",
      ),
    );
    const md = renderMarkdown(g);
    expect(md).toMatch(/ForEachLoop\(/);
    expect(md).toMatch(/LoopBody:/);
    expect(md).toMatch(/Completed:/);
    // No warning for engine macros
    expect(md).not.toMatch(/is custom/);
  });

  it("warns when a custom macro body is not in the paste", () => {
    const g = parse(macroBP("/Game/Blueprints/BP_MyLib.BP_MyLib", "MyCoolMacro"));
    const md = renderMarkdown(g);
    expect(md).toMatch(/MyCoolMacro\(/);
    expect(md).toMatch(/Warnings:/);
    expect(md).toMatch(/MyCoolMacro.*custom.*BP_MyLib/);
  });

  it("renders a supplied macro body in its own section and drops the warning", () => {
    const main = parse(macroBP("/Game/Blueprints/BP_MyLib.BP_MyLib", "MyCoolMacro"));
    const macroBody = parse(`Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_Entry"
   bCanHaveOutputs=True
   NodeGuid=BBBB0001000000000000000000000001
   CustomProperties Pin (PinId=EEEE1111111111111111111111111111,PinName="Array",PinType.PinCategory="wildcard",PinType.ContainerType=Array,Direction="EGPD_Output",LinkedTo=())
   CustomProperties Pin (PinId=EEEE2222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_Body 33334444555566667777888899990000,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_Body"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="PrintString")
   NodeGuid=BBBB0002000000000000000000000002
   CustomProperties Pin (PinId=33334444555566667777888899990000,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_Tunnel_Entry EEEE2222222222222222222222222222,))
   CustomProperties Pin (PinId=33334444555566667777888899990001,PinName="InString",PinType.PinCategory="string",DefaultValue="from macro body")
End Object`);
    const md = renderMarkdown(main, [
      { name: "MyCoolMacro", kind: "macro", graph: macroBody },
    ]);
    expect(md).toMatch(/## Macro: MyCoolMacro/);
    expect(md).toMatch(/from macro body/);
    expect(md).not.toMatch(/Warnings:[\s\S]*MyCoolMacro/);
  });
});

describe("renderMarkdown — tunnels", () => {
  it("does not treat an exit tunnel as its own root section", () => {
    const t3d = `Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_Entry"
   bCanHaveOutputs=True
   NodeGuid=BBBB0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="execute",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="PrintString")
   NodeGuid=BBBB0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_Tunnel_Entry 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_Tunnel_Exit 44444444444444444444444444444444,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_Tunnel Name="K2Node_Tunnel_Exit"
   bCanHaveInputs=True
   NodeGuid=BBBB0003000000000000000000000003
   CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_CallFunction_0 33333333333333333333333333333333,))
End Object`;
    const g = parse(t3d, "blueprint");
    const md = renderMarkdown(g);
    // The exit tunnel must not become its own heading
    expect(md.match(/## Exit/g)).toBeNull();
    expect(md.match(/loop back to K2Node_Tunnel_Exit/g)).toBeNull();
    // The entry chain still walks through to the exit
    expect(md).toMatch(/## Entry/);
    expect(md).toMatch(/PrintString/);
    expect(md).toMatch(/- exit/);
  });
});

describe("extractMemberRef robustness", () => {
  it("extracts the trailing class name even with Class' wrapper", () => {
    const t3d = `Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="PrintString")
   NodeGuid=CCCC0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="execute",PinType.PinCategory="exec")
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output")
End Object`;
    const g = parse(t3d, "blueprint");
    const md = renderMarkdown(g);
    expect(md).toMatch(/KismetSystemLibrary\.PrintString/);
  });

  it("renders bSelfContext=True calls as self.<name>", () => {
    const t3d = `Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberName="MyLocalFunc",bSelfContext=True)
   NodeGuid=CCCC0002000000000000000000000002
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="execute",PinType.PinCategory="exec")
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output")
End Object`;
    const g = parse(t3d, "blueprint");
    const md = renderMarkdown(g);
    expect(md).toMatch(/self\.MyLocalFunc/);
  });
});

describe("renderMarkdown — MacroGraphReference formats", () => {
  const bpWithRef = (ref: string) => `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="K2Node_Event_0"
   EventReference=(MemberParent=Class'"/Script/Engine.Actor"',MemberName="ReceiveBeginPlay")
   NodeGuid=DDDD0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_MacroInstance_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_MacroInstance Name="K2Node_MacroInstance_0"
   MacroGraphReference=${ref}
   NodeGuid=DDDD0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_Event_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=())
End Object`;

  it("parses inner-single-quote format with sibling GraphBlueprint", () => {
    const g = parse(
      bpWithRef(
        `(MacroGraph="/Script/Engine.EdGraph'DrawDebugArrowDown'",GraphBlueprint="/Script/Engine.Blueprint'/Game/BP_SnowManager.BP_SnowManager'",GraphGuid=FA23934F4198BC9F0A99B88D89B778FA)`,
      ),
    );
    const md = renderMarkdown(g);
    expect(md).toMatch(/DrawDebugArrowDown\(/);
    expect(md).toMatch(/BP_SnowManager/);
  });

  it("still parses the colon-suffix format used by engine macros", () => {
    const g = parse(
      bpWithRef(
        `(MacroGraph=EdGraph'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros:ForEachLoop"',GraphBlueprint=Blueprint'"/Engine/EditorBlueprintResources/StandardMacros.StandardMacros"',GraphGuid=DEAD)`,
      ),
    );
    const md = renderMarkdown(g);
    expect(md).toMatch(/ForEachLoop\(/);
    expect(md).not.toMatch(/Warnings:[\s\S]*ForEachLoop/);
  });
});

describe("renderMarkdown — Knot and BreakStruct transparency", () => {
  it("inlines K2Node_Knot value into downstream args", () => {
    const t3d = `Begin Object Class=/Script/BlueprintGraph.K2Node_VariableGet Name="K2Node_VariableGet_0"
   VariableReference=(MemberName="MyVar",bSelfContext=True)
   NodeGuid=AAAA0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="MyVar",PinType.PinCategory="int",Direction="EGPD_Output",LinkedTo=(K2Node_Knot_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_Knot Name="K2Node_Knot_0"
   NodeGuid=AAAA0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="InputPin",PinType.PinCategory="int",Direction="EGPD_Input",LinkedTo=(K2Node_VariableGet_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="OutputPin",PinType.PinCategory="int",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 44444444444444444444444444444444,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetMathLibrary"',MemberName="Add_IntInt")
   NodeGuid=AAAA0003000000000000000000000003
   CustomProperties Pin (PinId=55555555555555555555555555555555,PinName="execute",PinType.PinCategory="exec")
   CustomProperties Pin (PinId=66666666666666666666666666666666,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output")
   CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="A",PinType.PinCategory="int",Direction="EGPD_Input",LinkedTo=(K2Node_Knot_0 33333333333333333333333333333333,))
End Object`;
    const g = parse(t3d, "blueprint");
    const md = renderMarkdown(g);
    // The knot wrapper should not appear; the variable name shows through.
    expect(md).toMatch(/A=MyVar/);
    expect(md).not.toMatch(/Knot\(InputPin=/);
  });

  it("renders BreakStruct field access via the output pin name", () => {
    const t3d = `Begin Object Class=/Script/BlueprintGraph.K2Node_VariableGet Name="K2Node_VariableGet_0"
   VariableReference=(MemberName="MyVec",bSelfContext=True)
   NodeGuid=AAAA0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="MyVec",PinType.PinCategory="struct",Direction="EGPD_Output",LinkedTo=(K2Node_BreakStruct_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_BreakStruct Name="K2Node_BreakStruct_0"
   StructType=/Script/CoreUObject.Vector
   NodeGuid=AAAA0002000000000000000000000002
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="MyVec",PinType.PinCategory="struct",Direction="EGPD_Input",LinkedTo=(K2Node_VariableGet_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="X",PinType.PinCategory="real",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 44444444444444444444444444444444,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetMathLibrary"',MemberName="Abs_Double")
   NodeGuid=AAAA0003000000000000000000000003
   CustomProperties Pin (PinId=55555555555555555555555555555555,PinName="execute",PinType.PinCategory="exec")
   CustomProperties Pin (PinId=66666666666666666666666666666666,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output")
   CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="A",PinType.PinCategory="real",Direction="EGPD_Input",LinkedTo=(K2Node_BreakStruct_0 33333333333333333333333333333333,))
End Object`;
    const g = parse(t3d, "blueprint");
    const md = renderMarkdown(g);
    expect(md).toMatch(/A=MyVec\.X/);
  });
});

describe("Data nodes orphan filter", () => {
  it("does not list a data node that was already inlined in an exec line", () => {
    const t3d = `Begin Object Class=/Script/BlueprintGraph.K2Node_Event Name="K2Node_Event_0"
   EventReference=(MemberParent=Class'"/Script/Engine.Actor"',MemberName="ReceiveBeginPlay")
   NodeGuid=DDDD0001000000000000000000000001
   CustomProperties Pin (PinId=11111111111111111111111111111111,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 22222222222222222222222222222222,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_VariableGet Name="K2Node_VariableGet_Used"
   VariableReference=(MemberName="MyVar",bSelfContext=True)
   NodeGuid=DDDD0002000000000000000000000002
   CustomProperties Pin (PinId=33333333333333333333333333333333,PinName="MyVar",PinType.PinCategory="int",Direction="EGPD_Output",LinkedTo=(K2Node_CallFunction_0 44444444444444444444444444444444,))
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_VariableGet Name="K2Node_VariableGet_Stray"
   VariableReference=(MemberName="LooseVar",bSelfContext=True)
   NodeGuid=DDDD0003000000000000000000000003
   CustomProperties Pin (PinId=55555555555555555555555555555555,PinName="LooseVar",PinType.PinCategory="int",Direction="EGPD_Output",LinkedTo=())
End Object
Begin Object Class=/Script/BlueprintGraph.K2Node_CallFunction Name="K2Node_CallFunction_0"
   FunctionReference=(MemberParent=Class'"/Script/Engine.KismetSystemLibrary"',MemberName="PrintString")
   NodeGuid=DDDD0004000000000000000000000004
   CustomProperties Pin (PinId=22222222222222222222222222222222,PinName="execute",PinType.PinCategory="exec",LinkedTo=(K2Node_Event_0 11111111111111111111111111111111,))
   CustomProperties Pin (PinId=66666666666666666666666666666666,PinName="then",PinType.PinCategory="exec",Direction="EGPD_Output")
   CustomProperties Pin (PinId=44444444444444444444444444444444,PinName="InString",PinType.PinCategory="int",Direction="EGPD_Input",LinkedTo=(K2Node_VariableGet_Used 33333333333333333333333333333333,))
End Object`;
    const g = parse(t3d, "blueprint");
    const md = renderMarkdown(g);
    // Used variable was inlined into the call args, so the orphan list
    // shouldn't repeat it.
    expect(md).toMatch(/InString=MyVar/);
    expect(md).not.toMatch(/K2Node_VariableGet_Used/);
    // The stray variable still appears under Data nodes.
    expect(md).toMatch(/## Data nodes/);
    expect(md).toMatch(/LooseVar/);
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
