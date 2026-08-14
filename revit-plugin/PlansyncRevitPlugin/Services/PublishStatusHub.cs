namespace PlansyncRevitPlugin.Services
{
    internal sealed class PublishSnapshot
    {
        public DateTimeOffset? LastPublishAt { get; set; }
        public int LastUploadedCount { get; set; }
        public int LastQueuedCount { get; set; }
        public int LastFailedCount { get; set; }
        public string? LastDestination { get; set; }
        public List<string> LastFileNames { get; set; } = new();
        public string Status { get; set; } = "Ready to publish.";
    }

    internal static class PublishStatusHub
    {
        public static event Action? Changed;

        public static PublishSnapshot Snapshot { get; } = new();

        public static string LastStatus
        {
            get => Snapshot.Status;
            private set => Snapshot.Status = value;
        }

        public static void Notify(string status)
        {
            LastStatus = status;
            Changed?.Invoke();
        }

        public static void RecordPublish(
            string destination,
            IEnumerable<string> uploadedNames,
            int queuedCount,
            int failedCount)
        {
            var names = uploadedNames.ToList();
            Snapshot.LastPublishAt = DateTimeOffset.Now;
            Snapshot.LastUploadedCount = names.Count;
            Snapshot.LastQueuedCount = queuedCount;
            Snapshot.LastFailedCount = failedCount;
            Snapshot.LastDestination = destination;
            Snapshot.LastFileNames = names.Take(8).ToList();
            Snapshot.Status = names.Count > 0
                ? $"Published {names.Count} file(s)."
                : queuedCount > 0
                    ? $"{queuedCount} file(s) queued offline."
                    : "Publish finished with errors.";
            Changed?.Invoke();
        }
    }
}
