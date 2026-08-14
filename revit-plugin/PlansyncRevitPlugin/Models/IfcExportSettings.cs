namespace PlansyncRevitPlugin.Models
{
    public sealed class IfcExportSettings
    {
        /// <summary>IFC schema/view the file is written against. Defaults to plain IFC4, which has
        /// the broadest support; switch to Coordination View 2.0 for legacy tools/portals or a
        /// Reference View for buildingSMART-certified coordination models.</summary>
        public IfcExportVersion Version { get; set; } = IfcExportVersion.Ifc4;
        public bool FilterByView { get; set; }
        public long? FilterViewId { get; set; }
        public bool ExportIfcCommonPropertySets { get; set; } = true;
        public bool ExportBaseQuantities { get; set; } = true;
        /// <summary>Export rooms (IfcSpace) visible in / intersecting the filter view.</summary>
        public bool ExportRoomsInView { get; set; } = true;
        /// <summary>Export 2D plan/floor-cut elements (annotations, filled regions) for sheet coordination.</summary>
        public bool Export2DElements { get; set; } = true;
        /// <summary>Forces every Revit Level's "Building Story" checkbox on for the duration of the
        /// export so every level becomes an IfcBuildingStorey, instead of silently dropping levels
        /// (e.g. sill/reference levels) that have the flag unchecked. The change is made inside the
        /// export transaction and rolled back afterwards, so the model itself is never modified.</summary>
        public bool IncludeAllLevelsAsBuildingStories { get; set; } = true;
        public IfcParameterMode ParameterMode { get; set; } = IfcParameterMode.AllRevitPropertySets;
        public List<string> SelectedParameterNames { get; set; } = new();
    }
}
