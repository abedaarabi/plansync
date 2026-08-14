using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace PlansyncRevitPlugin.Services.Auth
{
    internal static class SecureSessionStore
    {
        private static string StoreDirectory =>
            Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "Plansync",
                "RevitPlugin");

        private static string StorePath => Path.Combine(StoreDirectory, "session.bin");

        public static void SaveCookies(IReadOnlyList<StoredCookie> cookies)
        {
            Directory.CreateDirectory(StoreDirectory);
            byte[] json = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(cookies));
            byte[] protectedBytes = ProtectedData.Protect(json, null, DataProtectionScope.CurrentUser);
            File.WriteAllBytes(StorePath, protectedBytes);
        }

        public static List<StoredCookie> LoadCookies()
        {
            try
            {
                if (!File.Exists(StorePath))
                {
                    return new List<StoredCookie>();
                }

                byte[] protectedBytes = File.ReadAllBytes(StorePath);
                byte[] json = ProtectedData.Unprotect(protectedBytes, null, DataProtectionScope.CurrentUser);
                return JsonSerializer.Deserialize<List<StoredCookie>>(json) ?? new List<StoredCookie>();
            }
            catch
            {
                return new List<StoredCookie>();
            }
        }

        public static void Clear()
        {
            try
            {
                if (File.Exists(StorePath))
                {
                    File.Delete(StorePath);
                }
            }
            catch
            {
                // Ignore cleanup failures.
            }
        }
    }

    internal sealed class StoredCookie
    {
        public string Name { get; set; } = string.Empty;
        public string Value { get; set; } = string.Empty;
        public string Domain { get; set; } = string.Empty;
        public string Path { get; set; } = "/";
        public DateTimeOffset? Expires { get; set; }
        public bool HttpOnly { get; set; }
        public bool Secure { get; set; }
    }
}
