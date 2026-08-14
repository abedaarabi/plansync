using System.Diagnostics;
using System.IO;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.Services
{
    internal sealed class PublishRequest
    {
        public bool IncludeIfc { get; init; }
        public bool IncludePdf { get; init; }
        public IfcExportSettings Ifc { get; init; } = new();
        public PdfExportSettings Pdf { get; init; } = new();
        public PublishOptions Options { get; init; } = new();
        public IReadOnlyList<ViewItemViewModel> PdfDrawings { get; init; } = Array.Empty<ViewItemViewModel>();
    }

    internal sealed class PublishFileResult
    {
        public required string FileName { get; init; }
        public bool Succeeded { get; init; }
        public bool QueuedOffline { get; init; }
        public string? Error { get; init; }
        public string? VersionNote { get; init; }
    }

    internal static class PublishCoordinator
    {
        public static Result Run(Document doc, PublishRequest request, ref string message)
        {
            if (!request.IncludeIfc && !request.IncludePdf)
            {
                TaskDialog.Show("Plansync", "Select IFC and/or PDF to export.");
                return Result.Cancelled;
            }

            if (!PlansyncSessionState.HasDestination
                || PlansyncSessionState.WorkspaceId is null
                || PlansyncSessionState.ProjectId is null)
            {
                TaskDialog.Show("Plansync", "Choose a Plansync destination folder first.");
                return Result.Cancelled;
            }

            if (request.IncludeIfc && !RunParamQa(doc, request))
            {
                return Result.Cancelled;
            }

            string tempDir = PlansyncWorkflow.CreateTempExportDirectory();
            var exported = new List<ExportedFile>();

            try
            {
                PublishStatusHub.Notify("Exporting…");

                List<UploadPreviewRow> previewRows;
                List<PublishFileResult> results;

                using (var progress = new ProgressScope("Publishing to Plansync"))
                {
                    if (request.IncludeIfc)
                    {
                        string? viewName = null;
                        if (request.Ifc.FilterByView && request.Ifc.FilterViewId is long viewId)
                        {
                            viewName = (doc.GetElement(new ElementId(viewId)) as Autodesk.Revit.DB.View)?.Name;
                        }

                        string ifcName = FileNameSanitizer.SuggestIfcFileName(
                            doc.Title,
                            request.Ifc.FilterByView,
                            viewName);

                        progress.Report("Exporting IFC…", ifcName + ".ifc", 5);

                        exported.Add(LocalExportService.ExportIfc(
                            doc,
                            request.Ifc,
                            tempDir,
                            ifcName,
                            progress: (status, detail, percent) =>
                                progress.Report(
                                    status,
                                    detail,
                                    percent is null ? 20 : 5 + (percent.Value / 100.0 * 35))));
                    }

                    if (request.IncludePdf)
                    {
                        var selectedPdf = request.PdfDrawings
                            .Where(d => request.Pdf.SelectedViewIds.Contains(d.Id))
                            .ToList();
                        string combinedName = FileNameSanitizer.SuggestCombinedPdfFileName(doc.Title, selectedPdf);

                        progress.Report("Exporting PDF…", combinedName + ".pdf", request.IncludeIfc ? 45 : 10);

                        exported.AddRange(LocalExportService.ExportPdfs(
                            doc,
                            request.Pdf,
                            request.PdfDrawings,
                            tempDir,
                            (status, detail, percent) =>
                            {
                                double basePct = request.IncludeIfc ? 45 : 10;
                                double span = request.IncludeIfc ? 35 : 55;
                                progress.Report(
                                    status,
                                    detail,
                                    percent is null ? basePct : basePct + (percent.Value / 100.0 * span));
                            },
                            combinedFileNameWithoutExtension: combinedName));
                    }

                    if (exported.Count == 0)
                    {
                        TaskDialog.Show("Plansync", "Nothing was exported.");
                        return Result.Cancelled;
                    }

                    progress.Report("Checking versions…", PlansyncSessionState.DestinationLabel, 82);
                    var apiForPreview = new PlansyncApiClient();
                    previewRows = apiForPreview.PreviewUploadsAsync(
                            PlansyncSessionState.ProjectId,
                            PlansyncSessionState.FolderId,
                            exported.Select(f => f.FileName))
                        .GetAwaiter()
                        .GetResult();

                    if (!ConfirmConflicts(previewRows))
                    {
                        return Result.Cancelled;
                    }

                    var api = new PlansyncApiClient();
                    results = UploadBatch(api, exported, previewRows, progress);
                    progress.Report("Done", $"{results.Count(r => r.Succeeded)} uploaded", 100);
                }

                RecordHistory(doc, request, results);

                PublishStatusHub.RecordPublish(
                    PlansyncSessionState.DestinationLabel,
                    results.Where(r => r.Succeeded).Select(r => r.FileName),
                    results.Count(r => r.QueuedOffline),
                    results.Count(r => !r.Succeeded && !r.QueuedOffline));

                ShowSummary(results);

                return results.Any(r => r.Succeeded) ? Result.Succeeded : Result.Failed;
            }
            catch (PlansyncAuthException ex)
            {
                PlansyncHttp.ClearSession();
                PlansyncSessionState.ClearUser();
                message = ex.Message;
                TaskDialog.Show("Plansync", ex.Message);
                PublishStatusHub.Notify("Signed out — session expired.");
                return Result.Failed;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                PlansyncErrorDialog.Show("Publish failed", "PublishCoordinator.Run", ex);
                PublishStatusHub.Notify($"Publish failed: {ex.Message}");
                return Result.Failed;
            }
            finally
            {
                // Keep queued files; delete only if not referenced by offline queue.
                HashSet<string> queued = OfflineQueueStore.GetAll()
                    .Select(q => q.FilePath)
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);

                if (!queued.Any(p => p.StartsWith(tempDir, StringComparison.OrdinalIgnoreCase)))
                {
                    PlansyncWorkflow.TryDeleteDirectory(tempDir);
                }
            }
        }

        private static bool RunParamQa(Document doc, PublishRequest request)
        {
            if (!request.Options.WarnOnParamQa && !request.Options.BlockOnParamQa)
            {
                return true;
            }

            ParamQaResult qa = ParamQaService.Evaluate(doc, request.Ifc);
            if (!qa.HasIssues)
            {
                return true;
            }

            if (request.Options.BlockOnParamQa)
            {
                TaskDialog.Show("Plansync — Parameter QA", qa.Summary + "\n\nPublish blocked by QA settings.");
                return false;
            }

            var dialog = new TaskDialog("Plansync — Parameter QA")
            {
                MainInstruction = "Parameter QA warnings",
                MainContent = qa.Summary + "\n\nContinue publishing?",
                CommonButtons = TaskDialogCommonButtons.None
            };
            dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Continue");
            dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Cancel");
            return dialog.Show() == TaskDialogResult.CommandLink1;
        }

        private static bool ConfirmConflicts(IReadOnlyList<UploadPreviewRow> rows)
        {
            var conflicts = rows
                .Where(r => !string.IsNullOrWhiteSpace(r.MatchedFile?.Name)
                            || string.Equals(r.Kind, "version", StringComparison.OrdinalIgnoreCase)
                            || (r.NextVersion is > 1))
                .ToList();

            if (conflicts.Count == 0)
            {
                return true;
            }

            string body = string.Join(
                "\n",
                conflicts.Take(12).Select(r =>
                {
                    string version = r.NextVersion is int v ? $" → v{v}" : string.Empty;
                    string match = r.MatchedFile?.Name is string n ? $" (matches {n})" : string.Empty;
                    return $"• {r.ClientName}{version}{match}";
                }));

            if (conflicts.Count > 12)
            {
                body += "\n…";
            }

            var dialog = new TaskDialog("Plansync — Version preview")
            {
                MainInstruction = "Some files already exist in this folder",
                MainContent = body + "\n\nUpload will create new versions where applicable.",
                CommonButtons = TaskDialogCommonButtons.None
            };
            dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Upload anyway");
            dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Cancel");
            return dialog.Show() == TaskDialogResult.CommandLink1;
        }

        private static List<PublishFileResult> UploadBatch(
            PlansyncApiClient api,
            IReadOnlyList<ExportedFile> files,
            IReadOnlyList<UploadPreviewRow> previewRows,
            ProgressScope progressWindow)
        {
            var results = new List<PublishFileResult>();

            for (int i = 0; i < files.Count; i++)
            {
                ExportedFile file = files[i];
                double basePct = (i / (double)files.Count) * 100.0;
                progressWindow.Report(
                    $"Uploading {i + 1} of {files.Count}",
                    file.FileName,
                    basePct);

                UploadPreviewRow? preview = previewRows.FirstOrDefault(r =>
                    string.Equals(r.ClientName, file.FileName, StringComparison.OrdinalIgnoreCase));
                string? versionNote = preview?.NextVersion is int v ? $"v{v}" : null;

                try
                {
                    var progress = new Progress<double>(value =>
                    {
                        double overall = ((i + (value / 100.0)) / files.Count) * 100.0;
                        progressWindow.Report(
                            $"Uploading {i + 1} of {files.Count}",
                            file.FileName,
                            overall);
                    });

                    api.UploadFileAsync(
                            PlansyncSessionState.WorkspaceId!,
                            PlansyncSessionState.ProjectId!,
                            PlansyncSessionState.FolderId,
                            file.Path,
                            file.ContentType,
                            progress)
                        .GetAwaiter()
                        .GetResult();

                    results.Add(new PublishFileResult
                    {
                        FileName = file.FileName,
                        Succeeded = true,
                        VersionNote = versionNote
                    });
                }
                catch (Exception ex)
                {
                    string persistDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                        "Plansync",
                        "RevitPlugin",
                        "offline-queue");
                    Directory.CreateDirectory(persistDir);
                    string persistPath = Path.Combine(persistDir, file.FileName);
                    File.Copy(file.Path, persistPath, overwrite: true);

                    OfflineQueueStore.Enqueue(new OfflineQueueItem
                    {
                        FilePath = persistPath,
                        ContentType = file.ContentType,
                        FileName = file.FileName,
                        WorkspaceId = PlansyncSessionState.WorkspaceId!,
                        ProjectId = PlansyncSessionState.ProjectId!,
                        FolderId = PlansyncSessionState.FolderId,
                        LastError = ex.Message
                    });

                    results.Add(new PublishFileResult
                    {
                        FileName = file.FileName,
                        Succeeded = false,
                        QueuedOffline = true,
                        Error = ex.Message,
                        VersionNote = versionNote
                    });
                }
            }

            return results;
        }

        private static void RecordHistory(Document doc, PublishRequest request, IReadOnlyList<PublishFileResult> results)
        {
            if (!results.Any(r => r.Succeeded))
            {
                return;
            }

            string key = PublishHistoryStore.MakeKey(PlansyncSessionState.ProjectId, doc.Title);
            PublishHistoryStore.Record(
                key,
                PlansyncSessionState.ProjectId,
                doc.Title,
                request.Pdf.SelectedViewIds,
                results.Where(r => r.Succeeded).Select(r => r.FileName));
        }

        private static void ShowSummary(IReadOnlyList<PublishFileResult> results)
        {
            int ok = results.Count(r => r.Succeeded);
            int queued = results.Count(r => r.QueuedOffline);
            int failed = results.Count(r => !r.Succeeded && !r.QueuedOffline);

            string lines = string.Join(
                "\n",
                results.Select(r =>
                {
                    string mark = r.Succeeded ? "✓" : (r.QueuedOffline ? "… queued" : "✗");
                    string ver = r.VersionNote is null ? string.Empty : $" ({r.VersionNote})";
                    string err = r.Error is null ? string.Empty : $" — {r.Error}";
                    return $"{mark} {r.FileName}{ver}{err}";
                }));

            var dialog = new TaskDialog("Plansync — Publish summary")
            {
                MainInstruction = $"{ok} uploaded, {queued} queued, {failed} failed",
                MainContent = lines + $"\n\nDestination:\n{PlansyncSessionState.DestinationLabel}",
                CommonButtons = TaskDialogCommonButtons.Close
            };

            if (PlansyncSessionState.ProjectId is not null)
            {
                dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "Open in Plansync");
            }

            if (queued > 0)
            {
                dialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "Retry offline queue");
            }

            TaskDialogResult result = dialog.Show();
            if (result == TaskDialogResult.CommandLink1 && PlansyncSessionState.ProjectId is not null)
            {
                Process.Start(new ProcessStartInfo(PlansyncConfig.ProjectFilesUrl(PlansyncSessionState.ProjectId))
                {
                    UseShellExecute = true
                });
            }
            else if (result == TaskDialogResult.CommandLink2)
            {
                RetryOfflineQueue();
            }
        }

        public static void RetryOfflineQueue()
        {
            IReadOnlyList<OfflineQueueItem> queue = OfflineQueueStore.GetAll();
            if (queue.Count == 0)
            {
                TaskDialog.Show("Plansync", "Offline queue is empty.");
                return;
            }

            if (!PlansyncWorkflow.EnsureSignedIn())
            {
                return;
            }

            var api = new PlansyncApiClient();
            int ok = 0;
            foreach (OfflineQueueItem item in queue.ToList())
            {
                try
                {
                    if (!File.Exists(item.FilePath))
                    {
                        OfflineQueueStore.Remove(item.Id);
                        continue;
                    }

                    api.UploadFileAsync(
                            item.WorkspaceId,
                            item.ProjectId,
                            item.FolderId,
                            item.FilePath,
                            item.ContentType)
                        .GetAwaiter()
                        .GetResult();

                    try { File.Delete(item.FilePath); } catch { /* ignore */ }
                    OfflineQueueStore.Remove(item.Id);
                    ok++;
                }
                catch (Exception ex)
                {
                    OfflineQueueStore.UpdateError(item.Id, ex.Message);
                }
            }

            PublishStatusHub.Notify($"Offline retry: {ok} uploaded, {OfflineQueueStore.GetAll().Count} remaining.");
            TaskDialog.Show("Plansync", $"Offline retry finished.\nUploaded: {ok}\nRemaining: {OfflineQueueStore.GetAll().Count}");
        }
    }
}
