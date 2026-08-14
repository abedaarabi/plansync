namespace PlansyncRevitPlugin.Models
{
    public sealed class PersistedExportSettings
    {
        public IfcExportSettings Ifc { get; set; } = new();
        public PdfExportSettings Pdf { get; set; } = new();
        public DestinationSettings Destination { get; set; } = new();
        public PublishOptions Options { get; set; } = new();
        public List<PublishProfile> Profiles { get; set; } = new();
        public string? ActiveProfileName { get; set; }
        public List<PublishHistoryEntry> History { get; set; } = new();
        public List<OfflineQueueItem> OfflineQueue { get; set; } = new();
    }

    public sealed class DestinationSettings
    {
        public string? WorkspaceId { get; set; }
        public string? WorkspaceName { get; set; }
        public string? ProjectId { get; set; }
        public string? ProjectName { get; set; }
        public string? FolderId { get; set; }
        public string? FolderName { get; set; }
    }

    public sealed class PublishOptions
    {
        public bool IncludeIfc { get; set; } = true;
        public bool IncludePdf { get; set; } = true;
        public bool BlockOnParamQa { get; set; }
        public bool WarnOnParamQa { get; set; } = true;
        public bool ChangedSheetsOnly { get; set; }
        public string PdfNamingTemplate { get; set; } = "{SheetNumber}_{SheetName}";
        public bool PreferCloudDestination { get; set; } = true;
    }

    public sealed class PublishProfile
    {
        public string Name { get; set; } = "Default";
        public bool IncludeIfc { get; set; } = true;
        public bool IncludePdf { get; set; } = true;
        public IfcExportSettings Ifc { get; set; } = new();
        public PdfExportSettings Pdf { get; set; } = new();
        public PublishOptions Options { get; set; } = new();
    }

    public sealed class PublishHistoryEntry
    {
        public string Key { get; set; } = string.Empty;
        public string? ProjectId { get; set; }
        public string DocumentTitle { get; set; } = string.Empty;
        public DateTimeOffset PublishedAt { get; set; }
        public List<long> PdfViewIds { get; set; } = new();
        public List<string> FileNames { get; set; } = new();
    }

    public sealed class OfflineQueueItem
    {
        public string Id { get; set; } = Guid.NewGuid().ToString("N");
        public string FilePath { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string WorkspaceId { get; set; } = string.Empty;
        public string ProjectId { get; set; } = string.Empty;
        public string? FolderId { get; set; }
        public DateTimeOffset QueuedAt { get; set; } = DateTimeOffset.UtcNow;
        public string? LastError { get; set; }
    }
}
