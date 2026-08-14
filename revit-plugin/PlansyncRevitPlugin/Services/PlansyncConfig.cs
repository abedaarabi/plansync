namespace PlansyncRevitPlugin.Services
{
    internal static class PlansyncConfig
    {
        public const string BaseUrl = "https://plansync.dev";

        public static Uri BaseUri { get; } = new(BaseUrl);

        public static string ProjectFilesUrl(string projectId) =>
            $"{BaseUrl}/projects/{projectId}/files";
    }
}
