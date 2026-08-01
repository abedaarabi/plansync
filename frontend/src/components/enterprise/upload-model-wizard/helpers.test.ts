import { describe, expect, it } from "vitest";
import { confidenceFromScore, disciplineFromFileName, estimateGpuMb } from "./helpers";
import { analyzeIfcClient } from "./ifcClientAnalysis";

describe("upload-model-wizard helpers", () => {
  it("maps match scores to confidence percent", () => {
    expect(confidenceFromScore(0.96)).toBe(96);
    expect(confidenceFromScore(96)).toBe(96);
  });

  it("infers disciplines from filenames", () => {
    expect(disciplineFromFileName("Office_HVAC.ifc")).toContain("HVAC");
    expect(disciplineFromFileName("Tower_Structural.ifc")).toContain("Structure");
  });

  it("estimates GPU memory", () => {
    expect(estimateGpuMb(15 * 1024 * 1024, 147_221)).toBeGreaterThan(20);
  });
});

describe("analyzeIfcClient", () => {
  it("reads schema and storeys from a minimal IFC header", async () => {
    const body = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');
FILE_NAME('Office.ifc','2026-01-01T00:00:00',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('2O2Fr$t4X7Zf8NOew3FLOH',#2,'Office Tower',$,$,$,$,(#3),#4);
#10=IFCBUILDING('2O2Fr$t4X7Zf8NOew3FLOI',#2,'Main Building',$,$,$,$,$,.ELEMENT.,$,$,$);
#20=IFCBUILDINGSTOREY('2O2Fr$t4X7Zf8NOew3FLOJ',#2,'Level 01',$,$,$,$,$,.ELEMENT.,0.);
#21=IFCBUILDINGSTOREY('2O2Fr$t4X7Zf8NOew3FLOK',#2,'Level 02',$,$,$,$,$,.ELEMENT.,3.5);
#30=IFCWALL('2O2Fr$t4X7Zf8NOew3FLOL',#2,'Wall',$,$,$,$,$);
#31=IFCMATERIAL('Concrete');
ENDSEC;
END-ISO-10303-21;
`;
    const file = new File([body], "Office_Architecture.ifc", { type: "application/octet-stream" });
    const result = await analyzeIfcClient(file);
    expect(result.schema).toBe("IFC4");
    expect(result.storeyCount).toBe(2);
    expect(result.projectName).toBe("Office Tower");
    expect(result.buildingName).toBe("Main Building");
    expect(result.hasMaterials).toBe(true);
    expect(result.disciplines).toContain("Architecture");
  });
});
