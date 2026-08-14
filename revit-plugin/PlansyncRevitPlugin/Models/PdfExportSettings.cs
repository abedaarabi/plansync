namespace PlansyncRevitPlugin.Models
{
    public sealed class PdfExportSettings
    {
        /// <summary>When true, one combined PDF. When false, one PDF per selected drawing.</summary>
        public bool Combine { get; set; } = true;
        public List<long> SelectedViewIds { get; set; } = new();
        public string NamingTemplate { get; set; } = "{SheetNumber}_{SheetName}";
    }
}