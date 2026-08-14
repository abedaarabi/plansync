using System.IO;

namespace PlansyncRevitPlugin.Services
{
    /// <summary>Startup/diagnostic log — Revit hides add-in exceptions behind a generic dialog.</summary>
    internal static class PlansyncLog
    {
        private static readonly object Gate = new();

        public static string LogPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Plansync",
            "RevitPlugin",
            "plugin.log");

        public static void Write(string message)
        {
            try
            {
                lock (Gate)
                {
                    Directory.CreateDirectory(Path.GetDirectoryName(LogPath)!);
                    File.AppendAllText(LogPath, $"{DateTimeOffset.Now:u}  {message}{Environment.NewLine}");
                }
            }
            catch
            {
                // Logging must never break add-in startup.
            }
        }

        public static void Write(string context, Exception ex) =>
            Write($"{context}: {ex}");
    }
}
