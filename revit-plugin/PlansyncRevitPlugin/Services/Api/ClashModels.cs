using System.Text.Json.Serialization;

namespace PlansyncRevitPlugin.Services.Api
{
    public sealed class ClashFileRef
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }

    public sealed class ClashTestRef
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }
    }

    public sealed class ClashElementRef
    {
        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("ifcType")]
        public string? IfcType { get; set; }

        [JsonPropertyName("ifcGuid")]
        public string? IfcGuid { get; set; }
    }

    public sealed class ClashTestInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("lastRunAt")]
        public string? LastRunAt { get; set; }

        [JsonPropertyName("clashCount")]
        public int? ClashCount { get; set; }
    }

    public sealed class ClashTestsResponse
    {
        [JsonPropertyName("tests")]
        public List<ClashTestInfo> Tests { get; set; } = new();
    }

    public sealed class ClashInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("testId")]
        public string TestId { get; set; } = string.Empty;

        [JsonPropertyName("guidA")]
        public string GuidA { get; set; } = string.Empty;

        [JsonPropertyName("guidB")]
        public string GuidB { get; set; } = string.Empty;

        [JsonPropertyName("clashType")]
        public string ClashType { get; set; } = "HARD";

        [JsonPropertyName("distanceMm")]
        public double DistanceMm { get; set; }

        [JsonPropertyName("point")]
        public IssuePoint3d? Point { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "NEW";

        [JsonPropertyName("elementA")]
        public ClashElementRef? ElementA { get; set; }

        [JsonPropertyName("elementB")]
        public ClashElementRef? ElementB { get; set; }

        [JsonPropertyName("test")]
        public ClashTestRef? Test { get; set; }

        [JsonPropertyName("fileA")]
        public ClashFileRef? FileA { get; set; }

        [JsonPropertyName("fileB")]
        public ClashFileRef? FileB { get; set; }

        public bool IsOpen =>
            string.Equals(Status, "NEW", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Status, "ACTIVE", StringComparison.OrdinalIgnoreCase);
    }

    public sealed class ProjectClashesResponse
    {
        [JsonPropertyName("clashes")]
        public List<ClashInfo> Clashes { get; set; } = new();

        [JsonPropertyName("truncated")]
        public bool Truncated { get; set; }
    }

    public sealed class ClashPatchRequest
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }
    }
}
