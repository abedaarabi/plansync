using PlansyncRevitPlugin.Models;

namespace PlansyncRevitPlugin.Services
{
    internal static class OfflineQueueStore
    {
        public static IReadOnlyList<OfflineQueueItem> GetAll()
        {
            return ExportSettingsStore.Load().OfflineQueue;
        }

        public static void Enqueue(OfflineQueueItem item)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            settings.OfflineQueue.RemoveAll(q =>
                string.Equals(q.FilePath, item.FilePath, StringComparison.OrdinalIgnoreCase));
            settings.OfflineQueue.Add(item);
            ExportSettingsStore.Save(settings);
            PublishStatusHub.Notify($"Queued offline: {item.FileName}");
        }

        public static void Remove(string id)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            settings.OfflineQueue.RemoveAll(q => q.Id == id);
            ExportSettingsStore.Save(settings);
        }

        public static void UpdateError(string id, string error)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            OfflineQueueItem? item = settings.OfflineQueue.FirstOrDefault(q => q.Id == id);
            if (item is null)
            {
                return;
            }

            item.LastError = error;
            ExportSettingsStore.Save(settings);
        }
    }
}
