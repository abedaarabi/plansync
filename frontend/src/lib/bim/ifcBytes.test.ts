import { describe, expect, it } from "vitest";
import { assertIfcBytesIntact } from "./ifcBytes";

const COMPLETE = new TextEncoder().encode(`ISO-10303-21;
HEADER;
FILE_DESCRIPTION((''),'2;1');
FILE_NAME('t.ifc','',(''),(''),'','','');
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCPROJECT('xxxxxxxxxxxxxxxxxxxxxx',$,'P',$,$,$,$,(),$);
ENDSEC;
END-ISO-10303-21;
`);

describe("assertIfcBytesIntact", () => {
  it("accepts a complete IFC", () => {
    expect(() => assertIfcBytesIntact(COMPLETE, "Tiny.ifc")).not.toThrow();
  });

  it("rejects a truncated IFC missing the end marker", () => {
    const truncated = COMPLETE.subarray(0, COMPLETE.byteLength - 40);
    expect(() => assertIfcBytesIntact(truncated, "Tiny.ifc")).toThrow(/incomplete|corrupted/i);
  });

  it("rejects non-IFC bytes", () => {
    const pdf = new TextEncoder().encode("%PDF-1.4\n" + "x".repeat(40));
    expect(() => assertIfcBytesIntact(pdf, "x.pdf")).toThrow(/not a valid IFC/i);
  });
});
