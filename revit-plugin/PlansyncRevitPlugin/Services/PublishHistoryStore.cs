using System.IO;
using PlansyncRevitPlugin.Models;

namespace PlansyncRevitPlugin.Services
{
    internal static class PublishHistoryStore
    {
        public static string MakeKey(string? projectId, string documentTitle) =>
            $"{projectId ?? "none"}|{Sanitize(documentTitle)}";

        public static HashSet<long> GetLastPdfViewIds(string key)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            PublishHistoryEntry? entry = settings.History
                .OrderByDescending(h => h.PublishedAt)
                .FirstOrDefault(h => h.Key == key);
            return entry is null
                ? new HashSet<long>()
                : new HashSet<long>(entry.PdfViewIds);
        }

        /// <summary>Most recent publish recorded for a given destination project, across any
        /// document — used to show "last published" info even before this Revit session has
        /// published anything itself.</summary>
        public static PublishHistoryEntry? GetLastForProject(string? projectId)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            return settings.History
                .Where(h => string.Equals(h.ProjectId, projectId, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(h => h.PublishedAt)
                .FirstOrDefault();
        }

        public static void Record(
            string key,
            string? projectId,
            string documentTitle,
            IEnumerable<long> pdfViewIds,
            IEnumerable<string> fileNames)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            settings.History.RemoveAll(h => h.Key == key);
            settings.History.Add(new PublishHistoryEntry
            {
                Key = key,
                ProjectId = projectId,
                DocumentTitle = documentTitle,
                PublishedAt = DateTimeOffset.UtcNow,
                PdfViewIds = pdfViewIds.ToList(),
                FileNames = fileNames.ToList()
            });

            if (settings.History.Count > 40)
            {
                settings.History = settings.History
                    .OrderByDescending(h => h.PublishedAt)
                    .Take(40)
                    .ToList();
            }

            ExportSettingsStore.Save(settings);
        }

        private static string Sanitize(string value)
        {
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                value = value.Replace(c, '_');
            }

            return value;
        }
    }
}
