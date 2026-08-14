using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PlansyncRevitPlugin.Services.Auth;

namespace PlansyncRevitPlugin.Services.Api
{
    internal sealed class PlansyncApiClient
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true
        };

        private static readonly JsonSerializerOptions PatchJsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
        };

        public async Task<List<ProjectInfo>> GetProjectsAsync(
            string workspaceId,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            using HttpResponseMessage response = await PlansyncHttp.Client
                .GetAsync($"/api/v1/workspaces/{workspaceId}/projects", cancellationToken)
                .ConfigureAwait(false);

            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);
            List<ProjectInfo>? projects = await response.Content
                .ReadFromJsonAsync<List<ProjectInfo>>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return projects ?? new List<ProjectInfo>();
        }

        public async Task<FolderInfo> CreateFolderAsync(
            string projectId,
            string name,
            string? parentId,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            var body = new Dictionary<string, object?>
            {
                ["name"] = name.Trim()
            };
            if (!string.IsNullOrWhiteSpace(parentId))
            {
                body["parentId"] = parentId;
            }

            using HttpResponseMessage response = await PlansyncHttp.Client
                .PostAsJsonAsync($"/api/v1/projects/{projectId}/folders", body, cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

            FolderInfo? folder = await response.Content
                .ReadFromJsonAsync<FolderInfo>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            if (folder is null || string.IsNullOrWhiteSpace(folder.Id))
            {
                throw new InvalidOperationException("Create folder did not return a folder.");
            }

            return folder;
        }

        public async Task PreviewUploadAsync(
            string projectId,
            string? folderId,
            string fileName,
            CancellationToken cancellationToken = default)
        {
            _ = await PreviewUploadsAsync(projectId, folderId, new[] { fileName }, cancellationToken)
                .ConfigureAwait(false);
        }

        public async Task<List<UploadPreviewRow>> PreviewUploadsAsync(
            string projectId,
            string? folderId,
            IEnumerable<string> fileNames,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            var candidates = fileNames
                .Where(n => !string.IsNullOrWhiteSpace(n))
                .Select(n => new { clientName = n })
                .ToArray();

            if (candidates.Length == 0)
            {
                return new List<UploadPreviewRow>();
            }

            var body = new { folderId, candidates };
            using HttpResponseMessage response = await PlansyncHttp.Client
                .PostAsJsonAsync($"/api/v1/projects/{projectId}/uploads/preview", body, cancellationToken)
                .ConfigureAwait(false);

            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                throw new PlansyncAuthException("Your Plansync session expired. Please sign in again.");
            }

            if (!response.IsSuccessStatusCode)
            {
                return new List<UploadPreviewRow>();
            }

            UploadPreviewResponse? parsed = await response.Content
                .ReadFromJsonAsync<UploadPreviewResponse>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return parsed?.Rows ?? new List<UploadPreviewRow>();
        }

        public async Task<List<IssueInfo>> GetProjectIssuesAsync(
            string projectId,
            string? fileId = null,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            string path = $"/api/v1/projects/{projectId}/issues";
            if (!string.IsNullOrWhiteSpace(fileId))
            {
                path += $"?fileId={Uri.EscapeDataString(fileId)}";
            }

            using HttpResponseMessage response = await PlansyncHttp.Client
                .GetAsync(path, cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

            List<IssueInfo>? issues = await response.Content
                .ReadFromJsonAsync<List<IssueInfo>>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return issues ?? new List<IssueInfo>();
        }

        public async Task<string> GetIssueReferencePhotoReadUrlAsync(
            string issueId,
            string photoId,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            using HttpResponseMessage response = await PlansyncHttp.Client
                .GetAsync(
                    $"/api/v1/issues/{issueId}/reference-photos/{photoId}/presign-read",
                    cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

            using JsonDocument payload = await response.Content
                .ReadFromJsonAsync<JsonDocument>(JsonOptions, cancellationToken)
                .ConfigureAwait(false)
                ?? throw new InvalidOperationException("Photo URL request returned no response.");
            string? url = payload.RootElement.TryGetProperty("url", out JsonElement value)
                ? value.GetString()
                : null;
            return !string.IsNullOrWhiteSpace(url)
                ? url
                : throw new InvalidOperationException("Photo URL request returned no URL.");
        }

        public async Task<List<IssueCommentInfo>> GetIssueCommentsAsync(
            string issueId,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            using HttpResponseMessage response = await PlansyncHttp.Client
                .GetAsync($"/api/v1/issues/{issueId}/comments", cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

            IssueCommentsResponse? payload = await response.Content
                .ReadFromJsonAsync<IssueCommentsResponse>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return payload?.Comments ?? new List<IssueCommentInfo>();
        }

        public async Task<IssueCommentInfo> CreateIssueCommentAsync(
            string issueId,
            string body,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            using HttpResponseMessage response = await PlansyncHttp.Client
                .PostAsJsonAsync(
                    $"/api/v1/issues/{issueId}/comments",
                    new { body },
                    cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

            IssueCommentInfo? comment = await response.Content
                .ReadFromJsonAsync<IssueCommentInfo>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            if (comment is null || string.IsNullOrWhiteSpace(comment.Id))
            {
                throw new InvalidOperationException("Comment create did not return a row.");
            }

            return comment;
        }

        public async Task<IssueInfo> PatchIssueAsync(
            string issueId,
            IssuePatchRequest patch,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            using HttpResponseMessage response = await PlansyncHttp.Client
                .PatchAsJsonAsync($"/api/v1/issues/{issueId}", patch, PatchJsonOptions, cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(response, cancellationToken).ConfigureAwait(false);

            IssueInfo? issue = await response.Content
                .ReadFromJsonAsync<IssueInfo>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            if (issue is null || string.IsNullOrWhiteSpace(issue.Id))
            {
                throw new InvalidOperationException("Issue update did not return a row.");
            }

            return issue;
        }

        public async Task<CompleteUploadResponse> UploadFileAsync(
            string workspaceId,
            string projectId,
            string? folderId,
            string filePath,
            string contentType,
            IProgress<double>? progress = null,
            CancellationToken cancellationToken = default)
        {
            PlansyncHttp.EnsureInitialized();
            var fileInfo = new FileInfo(filePath);
            if (!fileInfo.Exists)
            {
                throw new InvalidOperationException("Export file was not found.");
            }

            string fileName = fileInfo.Name;
            await PreviewUploadAsync(projectId, folderId, fileName, cancellationToken).ConfigureAwait(false);

            var presignBody = new Dictionary<string, object?>
            {
                ["workspaceId"] = workspaceId,
                ["projectId"] = projectId,
                ["fileName"] = fileName,
                ["contentType"] = contentType,
                ["sizeBytes"] = fileInfo.Length
            };
            if (!string.IsNullOrWhiteSpace(folderId))
            {
                presignBody["folderId"] = folderId;
            }

            using HttpResponseMessage presignResponse = await PlansyncHttp.Client
                .PostAsJsonAsync("/api/v1/files/presign-upload", presignBody, cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(presignResponse, cancellationToken).ConfigureAwait(false);

            PresignUploadResponse? presign = await presignResponse.Content
                .ReadFromJsonAsync<PresignUploadResponse>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);

            if (presign is null || string.IsNullOrWhiteSpace(presign.UploadUrl))
            {
                throw new InvalidOperationException("Presign upload did not return an upload URL.");
            }

            await PutFileAsync(presign.UploadUrl, filePath, contentType, progress, cancellationToken)
                .ConfigureAwait(false);

            var completeBody = new Dictionary<string, object?>
            {
                ["workspaceId"] = workspaceId,
                ["projectId"] = projectId,
                ["fileName"] = fileName,
                ["fileId"] = presign.FileId,
                ["s3Key"] = presign.Key,
                ["sizeBytes"] = fileInfo.Length,
                ["mimeType"] = contentType
            };
            if (!string.IsNullOrWhiteSpace(folderId))
            {
                completeBody["folderId"] = folderId;
            }

            using HttpResponseMessage completeResponse = await PlansyncHttp.Client
                .PostAsJsonAsync("/api/v1/files/complete-upload", completeBody, cancellationToken)
                .ConfigureAwait(false);
            await EnsureSuccessAsync(completeResponse, cancellationToken).ConfigureAwait(false);
            CompleteUploadResponse? completed = await completeResponse.Content
                .ReadFromJsonAsync<CompleteUploadResponse>(JsonOptions, cancellationToken)
                .ConfigureAwait(false);
            return completed ?? throw new InvalidOperationException("Upload completion returned no file.");
        }

        private static async Task PutFileAsync(
            string uploadUrl,
            string filePath,
            string contentType,
            IProgress<double>? progress,
            CancellationToken cancellationToken)
        {
            progress?.Report(5);

            byte[] bytes = await File.ReadAllBytesAsync(filePath, cancellationToken).ConfigureAwait(false);
            using var content = new ByteArrayContent(bytes);
            content.Headers.ContentType = new MediaTypeHeaderValue(contentType);

            progress?.Report(15);

            using var putClient = new HttpClient { Timeout = TimeSpan.FromMinutes(60) };
            using HttpResponseMessage response = await putClient
                .PutAsync(uploadUrl, content, cancellationToken)
                .ConfigureAwait(false);

            if (!response.IsSuccessStatusCode)
            {
                string text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
                throw new InvalidOperationException(
                    $"S3 upload failed ({(int)response.StatusCode}): {text}");
            }

            progress?.Report(100);
        }

        private static async Task EnsureSuccessAsync(
            HttpResponseMessage response,
            CancellationToken cancellationToken)
        {
            if (response.IsSuccessStatusCode)
            {
                return;
            }

            string text = await response.Content.ReadAsStringAsync(cancellationToken).ConfigureAwait(false);
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
            {
                throw new PlansyncAuthException("Your Plansync session expired. Please sign in again.");
            }

            string message = TryExtractError(text) ?? $"Request failed ({(int)response.StatusCode}).";
            throw new InvalidOperationException(message);
        }

        private static string? TryExtractError(string json)
        {
            try
            {
                using JsonDocument doc = JsonDocument.Parse(json);
                if (doc.RootElement.TryGetProperty("error", out JsonElement error))
                {
                    if (error.ValueKind == JsonValueKind.String)
                    {
                        return error.GetString();
                    }

                    return error.ToString();
                }

                if (doc.RootElement.TryGetProperty("message", out JsonElement message)
                    && message.ValueKind == JsonValueKind.String)
                {
                    return message.GetString();
                }
            }
            catch
            {
                // Fall through.
            }

            return string.IsNullOrWhiteSpace(json) ? null : json;
        }
    }
}
