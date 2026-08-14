using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using PlansyncRevitPlugin.Services.Api;

namespace PlansyncRevitPlugin.Services.Auth
{
    internal sealed class PlansyncAuthClient
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        public async Task<MeResponse?> TryGetMeAsync(CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            using HttpResponseMessage response = await PlansyncHttp.Client
                .GetAsync("/api/v1/me", cancellationToken)
                .ConfigureAwait(false);

            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                return null;
            }

            if (response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                // Email unverified — treat as signed in but blocked.
                string text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                throw new PlansyncAuthException(
                    "Please verify your email before using Plansync.",
                    unverified: true,
                    details: text);
            }

            if (!response.IsSuccessStatusCode)
            {
                string text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                throw new PlansyncAuthException($"Could not load account ({(int)response.StatusCode}): {text}");
            }

            MeResponse? me = await response.Content
                .ReadFromJsonAsync<MeResponse>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return me;
        }

        public async Task<MeResponse> SignInAsync(
            string email,
            string password,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();

            using HttpResponseMessage response = await PlansyncHttp.Client
                .PostAsJsonAsync(
                    "/api/auth/sign-in/email",
                    new { email, password },
                    cancellationToken)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                string text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                string message = TryExtractError(text) ?? $"Sign in failed ({(int)response.StatusCode}).";
                throw new PlansyncAuthException(message);
            }

            PlansyncHttp.PersistCookies();

            MeResponse? me;
            try
            {
                me = await TryGetMeAsync(cancellationToken).ConfigureAwait(false);
            }
            catch (PlansyncAuthException)
            {
                PlansyncHttp.ClearSession();
                throw;
            }

            if (me?.User is null)
            {
                PlansyncHttp.ClearSession();
                throw new PlansyncAuthException(
                    "Signed in, but your session was not saved yet. Please try again.");
            }

            if (me.User.EmailVerified == false)
            {
                await SignOutAsync(cancellationToken).ConfigureAwait(false);
                throw new PlansyncAuthException(
                    "Please verify your email before signing in.",
                    unverified: true);
            }

            PlansyncHttp.PersistCookies();
            return me;
        }

        public Task SignOutAsync(CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            // Best-effort server sign-out; always clear local session.
            _ = PlansyncHttp.Client.PostAsync("/api/auth/sign-out", null, cancellationToken);
            PlansyncHttp.ClearSession();
            return Task.CompletedTask;
        }

        private static string? TryExtractError(string json)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("message", out JsonElement message)
                    && message.ValueKind == JsonValueKind.String)
                {
                    return NormalizeAuthMessage(message.GetString());
                }

                if (doc.RootElement.TryGetProperty("error", out JsonElement error))
                {
                    if (error.ValueKind == JsonValueKind.String)
                    {
                        return NormalizeAuthMessage(error.GetString());
                    }

                    if (error.ValueKind == JsonValueKind.Object
                        && error.TryGetProperty("message", out JsonElement nested)
                        && nested.ValueKind == JsonValueKind.String)
                    {
                        return NormalizeAuthMessage(nested.GetString());
                    }
                }

                if (doc.RootElement.TryGetProperty("code", out JsonElement code)
                    && code.ValueKind == JsonValueKind.String)
                {
                    return NormalizeAuthMessage(code.GetString());
                }
            }
            catch
            {
                // Fall through.
            }

            return NormalizeAuthMessage(json);
        }

        private static string? NormalizeAuthMessage(string? raw)
        {
            if (string.IsNullOrWhiteSpace(raw))
            {
                return null;
            }

            if (raw.Contains("ORIGIN", StringComparison.OrdinalIgnoreCase)
                || raw.Contains("Missing or null Origin", StringComparison.OrdinalIgnoreCase))
            {
                return "Plansync rejected the sign-in request (Origin). Update the plugin and try again.";
            }

            return raw.Trim();
        }
    }

    internal sealed class PlansyncAuthException : Exception
    {
        public PlansyncAuthException(string message, bool unverified = false, string? details = null)
            : base(message)
        {
            Unverified = unverified;
            Details = details;
        }

        public bool Unverified { get; }
        public string? Details { get; }
    }
}
