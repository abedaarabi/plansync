using System.IO;
using System.Windows.Media;
using System.Windows.Media.Imaging;

namespace PlansyncRevitPlugin.UI
{
    /// <summary>
    /// Builds avatar bitmaps for user images. Accepts http(s) URLs and `data:` URLs
    /// (the web account editor stores resized avatars inline), which WPF cannot bind directly.
    /// </summary>
    internal static class AvatarImage
    {
        private const int DecodeSize = 48;

        public static ImageSource? Load(string? url)
        {
            if (string.IsNullOrWhiteSpace(url))
            {
                return null;
            }

            string value = url.Trim();
            try
            {
                return value.StartsWith("data:", StringComparison.OrdinalIgnoreCase)
                    ? FromDataUrl(value)
                    : FromRemoteUrl(value);
            }
            catch
            {
                // Avatars are decorative; fall back to initials.
                return null;
            }
        }

        /// <summary>Initials fallback, matching the web app's user-initials rule.</summary>
        public static string Initials(string? name, string? email)
        {
            string source = !string.IsNullOrWhiteSpace(name) ? name!.Trim() : (email ?? string.Empty).Trim();
            if (source.Length == 0)
            {
                return "?";
            }

            string[] words = source
                .Split([' ', '.', '_', '-', '@'], StringSplitOptions.RemoveEmptyEntries);
            if (words.Length == 0)
            {
                return source[..1].ToUpperInvariant();
            }

            if (words.Length == 1)
            {
                string only = words[0];
                return (only.Length >= 2 ? only[..2] : only[..1]).ToUpperInvariant();
            }

            return $"{words[0][0]}{words[1][0]}".ToUpperInvariant();
        }

        private static ImageSource? FromDataUrl(string value)
        {
            int comma = value.IndexOf(',', StringComparison.Ordinal);
            if (comma < 0 || !value[..comma].Contains("base64", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            byte[] bytes = Convert.FromBase64String(value[(comma + 1)..]);
            using var stream = new MemoryStream(bytes);
            var image = new BitmapImage();
            image.BeginInit();
            image.CacheOption = BitmapCacheOption.OnLoad;
            image.DecodePixelWidth = DecodeSize;
            image.StreamSource = stream;
            image.EndInit();
            image.Freeze();
            return image;
        }

        private static ImageSource? FromRemoteUrl(string value)
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out Uri? uri))
            {
                return null;
            }

            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                return null;
            }

            // Downloads asynchronously; the Image/ImageBrush updates when decoding completes.
            var image = new BitmapImage();
            image.BeginInit();
            image.CacheOption = BitmapCacheOption.OnLoad;
            image.DecodePixelWidth = DecodeSize;
            image.UriSource = uri;
            image.EndInit();
            return image;
        }
    }
}
