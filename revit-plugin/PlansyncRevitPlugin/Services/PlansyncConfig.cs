namespace PlansyncRevitPlugin.Services
{
    internal static class PlansyncConfig
    {
        public const string BaseUrl = "https://plansync.dev";

        public static Uri BaseUri { get; } = new(BaseUrl);

        public static string ProjectFilesUrl(string projectId) =>
            $"{BaseUrl}/projects/{projectId}/files";

        public static string ProjectIssuesUrl(string projectId) =>
            $"{BaseUrl}/projects/{projectId}/issues";

        public static string IssueUrl(string projectId, string issueId) =>
            $"{BaseUrl}/projects/{projectId}/issues?issue={issueId}";
    }
}
