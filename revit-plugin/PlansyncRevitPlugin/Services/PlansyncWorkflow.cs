using System.Diagnostics;
using System.IO;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;
using PlansyncRevitPlugin.UI;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.Services
{
    internal static class PlansyncWorkflow
    {
        public static bool EnsureSignedIn()
        {
            var auth = new PlansyncAuthClient();
            try
            {
                MeResponse? me = auth.TryGetMeAsync().GetAwaiter().GetResult();
                if (me?.User is not null)
                {
                    PlansyncSessionState.Me = me;
                    PublishStatusHub.Notify($"Signed in as {me.User.Email}");
                    return true;
                }

                PlansyncSessionState.ClearUser();
            }
            catch (PlansyncAuthException ex)
            {
                TaskDialog.Show("Plansync", ex.Message);
            }
            catch (Exception ex)
            {
                TaskDialog.Show("Plansync", $"Could not reach Plansync:\n{ex.Message}");
            }

            var login = new LoginWindow();
            if (login.ShowDialog() == true && login.SignedInMe?.User is not null)
            {
                PlansyncSessionState.Me = login.SignedInMe;
                return true;
            }

            return false;
        }

        /// <summary>
        /// Ensures auth + destination. Returns requested export action from hub ("ifc"/"pdf") or null if only destination was set.
        /// </summary>
        public static bool EnsureDestination(out string? requestedExport)
        {
            requestedExport = null;
            if (!EnsureSignedIn())
            {
                return false;
            }

            RestoreDestinationFromSettings();

            if (PlansyncSessionState.HasDestination && PlansyncSessionState.Me is not null)
            {
                return true;
            }

            return ShowBrowser(out requestedExport);
        }

        public static bool ShowBrowser(out string? requestedExport)
        {
            requestedExport = null;
            if (!EnsureSignedIn() || PlansyncSessionState.Me is null)
            {
                return false;
            }

            var vm = new PlansyncBrowserViewModel(PlansyncSessionState.Me);
            var window = new PlansyncBrowserWindow(vm);
            if (window.ShowDialog() != true)
            {
                return false;
            }

            requestedExport = window.RequestedExport;
            return PlansyncSessionState.HasDestination;
        }

        public static void UploadExportedFile(string filePath, string contentType)
        {
            if (!PlansyncSessionState.HasDestination
                || PlansyncSessionState.WorkspaceId is null
                || PlansyncSessionState.ProjectId is null)
            {
                throw new InvalidOperationException("No Plansync destination is selected.");
            }

            using (var progressWindow = new ProgressScope("Uploading to Plansync"))
            {
                progressWindow.Report(
                    "Uploading…",
                    PlansyncSessionState.DestinationLabel,
                    5);

                var api = new PlansyncApiClient();
                var progress = new Progress<double>(value =>
                {
                    progressWindow.Report(
                        "Uploading…",
                        Path.GetFileName(filePath),
                        value);
                });

                api.UploadFileAsync(
                        PlansyncSessionState.WorkspaceId,
                        PlansyncSessionState.ProjectId,
                        PlansyncSessionState.FolderId,
                        filePath,
                        contentType,
                        progress)
                    .GetAwaiter()
                    .GetResult();

                progressWindow.Report("Upload complete", Path.GetFileName(filePath), 100);
            }

            string url = PlansyncConfig.ProjectFilesUrl(PlansyncSessionState.ProjectId);
            var dialog = new TaskDialog("Plansync")
            {
                MainInstruction = "Upload complete",
                MainContent = $"Uploaded to:\n{PlansyncSessionState.DestinationLabel}",
                CommonButtons = TaskDialogCommonButtons.Close
            };
            dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Open in Plansync");
            TaskDialogResult result = dialog.Show();
            if (result == TaskDialogResult.CommandLink1)
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
        }

        public static string CreateTempExportDirectory()
        {
            string path = Path.Combine(Path.GetTempPath(), "PlansyncRevit", Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(path);
            return path;
        }

        public static void TryDeleteDirectory(string? path)
        {
            if (string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            try
            {
                if (Directory.Exists(path))
                {
                    Directory.Delete(path, recursive: true);
                }
            }
            catch
            {
                // Ignore temp cleanup failures.
            }
        }

        /// <summary>
        /// Loads a previously saved destination into the session without requiring sign-in,
        /// so the unified Export dialog can show/reuse it before the user confirms Cloud.
        /// </summary>
        public static void RestoreDestinationFromSettings()
        {
            Models.DestinationSettings saved = ExportSettingsStore.Load().Destination;
            if (string.IsNullOrWhiteSpace(saved.WorkspaceId) || string.IsNullOrWhiteSpace(saved.ProjectId))
            {
                return;
            }

            PlansyncSessionState.WorkspaceId = saved.WorkspaceId;
            PlansyncSessionState.WorkspaceName = saved.WorkspaceName;
            PlansyncSessionState.ProjectId = saved.ProjectId;
            PlansyncSessionState.ProjectName = saved.ProjectName;
            PlansyncSessionState.FolderId = saved.FolderId;
            PlansyncSessionState.FolderName = saved.FolderName;
        }
    }
}
