namespace PlansyncRevitPlugin.Models
{
    /// <summary>Schema/view the IFC file is written against. Maps to Revit's IFCVersion enum in
    /// <see cref="Services.LocalExportService"/>.</summary>
    public enum IfcExportVersion
    {
        /// <summary>IFC4 (default). Broad support in modern BIM tools.</summary>
        Ifc4,

        /// <summary>IFC4 Reference View — buildingSMART-certified subset for viewing/coordination.</summary>
        Ifc4ReferenceView,

        /// <summary>IFC2x3 Coordination View 2.0 — the legacy schema many government portals and
        /// older tools (Solibri, Navisworks, older BIMcollab/BCF pipelines) still require.</summary>
        Ifc2x3CoordinationView2,

        /// <summary>IFC4x3 — latest schema, adds infrastructure entities. Newer tool support only.</summary>
        Ifc4x3,

        /// <summary>IFC4x3 Reference View.</summary>
        Ifc4x3ReferenceView
    }
}
