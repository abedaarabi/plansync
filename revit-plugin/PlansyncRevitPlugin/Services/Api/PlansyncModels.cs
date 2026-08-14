using System.Text.Json.Serialization;

namespace PlansyncRevitPlugin.Services.Api
{
    public sealed class MeResponse
    {
        [JsonPropertyName("user")]
        public PlansyncUser? User { get; set; }

        [JsonPropertyName("workspaces")]
        public List<WorkspaceMembership> Workspaces { get; set; } = new();
    }

    public sealed class PlansyncUser
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("email")]
        public string Email { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("emailVerified")]
        public bool? EmailVerified { get; set; }
    }

    public sealed class WorkspaceMembership
    {
        [JsonPropertyName("workspaceId")]
        public string WorkspaceId { get; set; } = string.Empty;

        [JsonPropertyName("role")]
        public string? Role { get; set; }

        [JsonPropertyName("workspace")]
        public WorkspaceInfo? Workspace { get; set; }

        public string DisplayName => Workspace?.Name ?? WorkspaceId;
    }

    public sealed class WorkspaceInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("slug")]
        public string? Slug { get; set; }
    }

    public sealed class ProjectInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("workspaceId")]
        public string WorkspaceId { get; set; } = string.Empty;

        [JsonPropertyName("folders")]
        public List<FolderInfo> Folders { get; set; } = new();
    }

    public sealed class FolderInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("parentId")]
        public string? ParentId { get; set; }

        [JsonPropertyName("canAccess")]
        public bool? CanAccess { get; set; }
    }

    public sealed class PresignUploadResponse
    {
        [JsonPropertyName("uploadUrl")]
        public string UploadUrl { get; set; } = string.Empty;

        [JsonPropertyName("key")]
        public string Key { get; set; } = string.Empty;

        [JsonPropertyName("fileId")]
        public string FileId { get; set; } = string.Empty;

        [JsonPropertyName("workspaceId")]
        public string WorkspaceId { get; set; } = string.Empty;
    }

    public sealed class UploadPreviewResponse
    {
        [JsonPropertyName("rows")]
        public List<UploadPreviewRow> Rows { get; set; } = new();
    }

    public sealed class UploadPreviewRow
    {
        [JsonPropertyName("clientName")]
        public string ClientName { get; set; } = string.Empty;

        [JsonPropertyName("kind")]
        public string Kind { get; set; } = string.Empty;

        [JsonPropertyName("nextVersion")]
        public int? NextVersion { get; set; }

        [JsonPropertyName("matchedFile")]
        public MatchedFileInfo? MatchedFile { get; set; }
    }

    public sealed class MatchedFileInfo
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;
    }
}
