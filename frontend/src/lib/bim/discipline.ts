/** Maps IFC type names to discipline folders (mirrors backend). */
// fallow-ignore-next-line complexity
export function disciplineForIfcType(ifcType: string): string {
  const n = ifcType.toLowerCase();
  if (/beam|column|footing|pile|member|plate|reinfor|struct|foundation/.test(n)) return "Structure";
  if (/electric|cable|light|lamp|switch|outlet|panel|transform|conduit/.test(n))
    return "Electrical";
  if (/duct|hvac|fan|chiller|boiler|mech|pipe|flow|pump|valve|air/.test(n)) return "Mechanical";
  if (/distribution|terminal|sanitary|plumb|sprinkler|fire|drain|sewer/.test(n)) return "MEP";
  if (/wall|door|window|slab|roof|stair|ramp|covering|furniture|space|room|curtain|railing/.test(n))
    return "Architecture";
  return "Other";
}
