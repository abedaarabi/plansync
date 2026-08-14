using System.IO;
using System.Text.Json;
using PlansyncRevitPlugin.Models;

namespace PlansyncRevitPlugin.Services
{
    internal static class ExportSettingsStore
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            WriteIndented = true
        };

        private static string SettingsDirectory =>
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Plansync",
                "RevitPlugin");

        private static string SettingsPath =>
            Path.Combine(SettingsDirectory, "export-settings.json");

        public static PersistedExportSettings Load()
        {
            try
            {
                if (!File.Exists(SettingsPath))
                {
                    return new PersistedExportSettings();
                }

                string json = File.ReadAllText(SettingsPath);
                return JsonSerializer.Deserialize<PersistedExportSettings>(json, JsonOptions)
                       ?? new PersistedExportSettings();
            }
            catch
            {
                return new PersistedExportSettings();
            }
        }

        public static void Save(PersistedExportSettings settings)
        {
            Directory.CreateDirectory(SettingsDirectory);
            string json = JsonSerializer.Serialize(settings, JsonOptions);
            File.WriteAllText(SettingsPath, json);
        }

        public static RevitModelBinding? GetModelBinding(string? projectId, string documentTitle)
        {
            if (string.IsNullOrWhiteSpace(projectId))
            {
                return null;
            }

            return Load().ModelBindings.FirstOrDefault(binding =>
                string.Equals(binding.ProjectId, projectId, StringComparison.Ordinal)
                && string.Equals(binding.DocumentTitle, documentTitle, StringComparison.OrdinalIgnoreCase));
        }

        public static RevitModelBinding? GetLatestModelBinding(string? projectId)
        {
            if (string.IsNullOrWhiteSpace(projectId))
            {
                return null;
            }

            return Load().ModelBindings
                .Where(binding => string.Equals(binding.ProjectId, projectId, StringComparison.Ordinal))
                .OrderByDescending(binding => binding.UpdatedAt)
                .FirstOrDefault();
        }

        public static void SaveModelBinding(RevitModelBinding binding)
        {
            PersistedExportSettings settings = Load();
            settings.ModelBindings.RemoveAll(existing =>
                string.Equals(existing.ProjectId, binding.ProjectId, StringComparison.Ordinal)
                && string.Equals(existing.DocumentTitle, binding.DocumentTitle, StringComparison.OrdinalIgnoreCase));
            settings.ModelBindings.Add(binding);
            Save(settings);
        }
    }
}
