using PlansyncRevitPlugin.Services.Api;

namespace PlansyncRevitPlugin.Services
{
    internal static class PlansyncSessionState
    {
        public static MeResponse? Me { get; set; }

        public static string? WorkspaceId { get; set; }
        public static string? WorkspaceName { get; set; }
        public static string? ProjectId { get; set; }
        public static string? ProjectName { get; set; }
        public static string? FolderId { get; set; }
        public static string? FolderName { get; set; }

        public static bool HasDestination =>
            !string.IsNullOrWhiteSpace(WorkspaceId) && !string.IsNullOrWhiteSpace(ProjectId);

        public static string DestinationLabel
        {
            get
            {
                if (!HasDestination)
                {
                    return "No destination selected";
                }

                string folder = string.IsNullOrWhiteSpace(FolderId)
                    ? "(project root)"
                    : FolderName ?? FolderId!;
                return $"{WorkspaceName} / {ProjectName} / {folder}";
            }
        }

        public static void ClearUser()
        {
            Me = null;
        }

        public static void ClearDestination()
        {
            WorkspaceId = null;
            WorkspaceName = null;
            ProjectId = null;
            ProjectName = null;
            FolderId = null;
            FolderName = null;
        }
    }
}
