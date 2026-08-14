using System.Text.Json.Serialization;

namespace PlansyncRevitPlugin.Services.Api
{
    public sealed class IssueUserRef
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("email")]
        public string? Email { get; set; }
    }

    public sealed class IssueBimAnchor
    {
        [JsonPropertyName("ifcGuid")]
        public string? IfcGuid { get; set; }

        [JsonPropertyName("name")]
        public string? Name { get; set; }

        [JsonPropertyName("ifcType")]
        public string? IfcType { get; set; }

        [JsonPropertyName("spatialPath")]
        public List<string>? SpatialPath { get; set; }

        [JsonPropertyName("position")]
        public IssuePoint3d? Position { get; set; }

        [JsonPropertyName("fileVersionId")]
        public string? FileVersionId { get; set; }

        [JsonPropertyName("modelFileName")]
        public string? ModelFileName { get; set; }

        [JsonPropertyName("ifcGuidB")]
        public string? IfcGuidB { get; set; }

        [JsonPropertyName("nameB")]
        public string? NameB { get; set; }

        [JsonPropertyName("ifcTypeB")]
        public string? IfcTypeB { get; set; }

        [JsonPropertyName("fileVersionIdB")]
        public string? FileVersionIdB { get; set; }

        [JsonPropertyName("modelFileNameB")]
        public string? ModelFileNameB { get; set; }

        public bool HasModelLink => !string.IsNullOrWhiteSpace(IfcGuid);
    }

    public sealed class IssuePoint3d
    {
        [JsonPropertyName("x")]
        public double X { get; set; }

        [JsonPropertyName("y")]
        public double Y { get; set; }

        [JsonPropertyName("z")]
        public double Z { get; set; }
    }

    public sealed class IssueInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("projectId")]
        public string ProjectId { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = "OPEN";

        [JsonPropertyName("priority")]
        public string? Priority { get; set; }

        [JsonPropertyName("dueDate")]
        public string? DueDate { get; set; }

        [JsonPropertyName("location")]
        public string? Location { get; set; }

        [JsonPropertyName("bimAnchor")]
        public IssueBimAnchor? BimAnchor { get; set; }

        [JsonPropertyName("assigneeId")]
        public string? AssigneeId { get; set; }

        [JsonPropertyName("assignee")]
        public IssueUserRef? Assignee { get; set; }

        [JsonPropertyName("creator")]
        public IssueUserRef? Creator { get; set; }

        [JsonPropertyName("createdAt")]
        public string? CreatedAt { get; set; }

        [JsonPropertyName("updatedAt")]
        public string? UpdatedAt { get; set; }

        [JsonPropertyName("issueKind")]
        public string? IssueKind { get; set; }

        public bool IsOpen =>
            string.Equals(Status, "OPEN", StringComparison.OrdinalIgnoreCase)
            || string.Equals(Status, "IN_PROGRESS", StringComparison.OrdinalIgnoreCase);
    }

    public sealed class IssuePatchRequest
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("priority")]
        public string? Priority { get; set; }

        [JsonPropertyName("description")]
        public string? Description { get; set; }

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("dueDate")]
        public string? DueDate { get; set; }

        [JsonPropertyName("location")]
        public string? Location { get; set; }
    }
}
