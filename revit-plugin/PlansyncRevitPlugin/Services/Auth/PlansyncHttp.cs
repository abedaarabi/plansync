using System.Net;
using System.Net.Http;

namespace PlansyncRevitPlugin.Services.Auth
{
    internal static class PlansyncHttp
    {
        private static readonly object Gate = new();
        private static HttpClient? _client;
        private static CookieContainer? _cookies;

        public static HttpClient Client
        {
            get
            {
                EnsureInitialized();
                return _client!;
            }
        }

        public static CookieContainer Cookies
        {
            get
            {
                EnsureInitialized();
                return _cookies!;
            }
        }

        public static void EnsureInitialized()
        {
            lock (Gate)
            {
                if (_client is not null)
                {
                    return;
                }

                _cookies = new CookieContainer();
                foreach (StoredCookie stored in SecureSessionStore.LoadCookies())
                {
                    try
                    {
                        var cookie = new Cookie(stored.Name, stored.Value, stored.Path, stored.Domain)
                        {
                            HttpOnly = stored.HttpOnly,
                            Secure = stored.Secure
                        };
                        if (stored.Expires is DateTimeOffset expires)
                        {
                            cookie.Expires = expires.UtcDateTime;
                        }

                        _cookies.Add(cookie);
                    }
                    catch
                    {
                        // Skip malformed stored cookies.
                    }
                }

                var handler = new HttpClientHandler
                {
                    CookieContainer = _cookies,
                    UseCookies = true,
                    AllowAutoRedirect = true
                };

                _client = new HttpClient(handler)
                {
                    BaseAddress = PlansyncConfig.BaseUri,
                    Timeout = TimeSpan.FromMinutes(30)
                };
                // Better Auth CSRF checks require a trusted Origin (browser-like).
                // Desktop HttpClient sends none by default → "MISSING_OR_NULL_ORIGIN".
                _client.DefaultRequestHeaders.TryAddWithoutValidation("Accept", "application/json");
                _client.DefaultRequestHeaders.TryAddWithoutValidation("Origin", PlansyncConfig.BaseUrl);
                _client.DefaultRequestHeaders.TryAddWithoutValidation("Referer", PlansyncConfig.BaseUrl + "/");
            }
        }

        public static void PersistCookies()
        {
            EnsureInitialized();
            var list = new List<StoredCookie>();
            foreach (Cookie cookie in Cookies.GetCookies(PlansyncConfig.BaseUri).Cast<Cookie>())
            {
                list.Add(new StoredCookie
                {
                    Name = cookie.Name,
                    Value = cookie.Value,
                    Domain = string.IsNullOrWhiteSpace(cookie.Domain)
                        ? PlansyncConfig.BaseUri.Host
                        : cookie.Domain,
                    Path = string.IsNullOrWhiteSpace(cookie.Path) ? "/" : cookie.Path,
                    Expires = cookie.Expires == DateTime.MinValue
                        ? null
                        : new DateTimeOffset(DateTime.SpecifyKind(cookie.Expires, DateTimeKind.Utc)),
                    HttpOnly = cookie.HttpOnly,
                    Secure = cookie.Secure
                });
            }

            SecureSessionStore.SaveCookies(list);
        }

        public static void ClearSession()
        {
            EnsureInitialized();
            foreach (Cookie cookie in Cookies.GetCookies(PlansyncConfig.BaseUri).Cast<Cookie>())
            {
                cookie.Expired = true;
            }

            SecureSessionStore.Clear();
        }
    }
}
