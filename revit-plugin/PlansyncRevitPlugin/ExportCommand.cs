using System.IO;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Microsoft.Win32;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.UI;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin
{
    /// <summary>
    /// Single unified Export entry point: one dialog offering IFC and/or PDF plus a choice of
    /// destination (save to this computer, or publish to the Plansync cloud). Replaces the
    /// previous separate Export IFC / Export PDF / Export to Plansync ribbon commands.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class ExportCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            return Execute(commandData, ref message, preferIfc: true, preferPdf: true, forceCloud: false);
        }

        /// <summary>
        /// Used by the Plansync hub/browser quick actions, which already know which type(s) the
        /// user asked for and have just picked a cloud destination.
        /// </summary>
        public Result Execute(
            ExternalCommandData commandData,
            ref string message,
            bool preferIfc,
            bool preferPdf,
            bool forceCloud)
        {
            UIDocument? uiDoc = commandData.Application.ActiveUIDocument;
            if (uiDoc?.Document is null)
            {
                TaskDialog.Show("Plansync", "No active document is open.");
                return Result.Cancelled;
            }

            Document doc = uiDoc.Document;
            PersistedExportSettings persisted = ExportSettingsStore.Load();

            // Load any previously saved cloud destination without forcing sign-in yet, so it can
            // be shown/reused if the user picks the Plansync cloud destination.
            PlansyncWorkflow.RestoreDestinationFromSettings();

            List<ViewItemViewModel> ifcViews;
            List<ParameterItemViewModel> parameters;
            try
            {
                ifcViews = PrintableViewCollector.CollectIfcFilterViews(doc);
            }
            catch (Exception ex)
            {
                message = ex.Message;
                PlansyncErrorDialog.Show("Could not collect views", "ExportCommand.CollectIfcFilterViews", ex);
                return Result.Failed;
            }

            try
            {
                parameters = ParameterCollector.Collect(doc);
            }
            catch (Exception ex)
            {
                // Keep export usable even if parameter discovery fails.
                parameters = new List<ParameterItemViewModel>();
                TaskDialog.Show(
                    "Plansync",
                    $"Parameter list could not be loaded ({ex.Message}).\nContinuing with an empty parameter list — use “All Revit property sets”.");
            }

            var ifcVm = new IfcExportViewModel(
                ifcViews,
                parameters,
                persisted.Ifc,
                doc.ActiveView?.Id.Value,
                doc.Title);

            var pdfVm = new PdfExportViewModel(
                PrintableViewCollector.CollectPrintable(doc),
                persisted.Pdf,
                doc.ActiveView?.Id.Value,
                doc.Title);

            string destinationLabel = PlansyncSessionState.HasDestination
                ? PlansyncSessionState.DestinationLabel
                : string.Empty;

            bool isCloud = forceCloud || persisted.Options.PreferCloudDestination;

            var vm = new ExportToPlansyncViewModel(
                ifcVm,
                pdfVm,
                persisted,
                destinationLabel,
                isCloudDestination: isCloud,
                chooseDestination: () =>
                    PlansyncWorkflow.ShowBrowser(out _) && PlansyncSessionState.HasDestination
                        ? PlansyncSessionState.DestinationLabel
                        : null);

            // Ribbon IFC/PDF shortcuts force a single type; combined export keeps saved checkboxes.
            if (preferIfc && !preferPdf)
            {
                vm.IncludeIfc = true;
                vm.IncludePdf = false;
            }
            else if (!preferIfc && preferPdf)
            {
                vm.IncludeIfc = false;
                vm.IncludePdf = true;
            }

            string historyKey = PublishHistoryStore.MakeKey(PlansyncSessionState.ProjectId, doc.Title);
            vm.ApplyChangedSheetsFilter(historyKey);

            try
            {
                var window = new ExportToPlansyncWindow(vm);
                if (window.ShowDialog() != true || !vm.DialogConfirmed)
                {
                    return Result.Cancelled;
                }

                vm.Persist(persisted);

                return vm.IsCloudDestination
                    ? RunCloudExport(doc, vm, ref message)
                    : RunLocalExport(doc, vm, ref message);
            }
            catch (Exception ex)
            {
                message = ex.Message;
                PlansyncErrorDialog.Show("Export failed", "ExportCommand.Execute", ex);
                return Result.Failed;
            }
        }

        private static Result RunCloudExport(Document doc, ExportToPlansyncViewModel vm, ref string message)
        {
            if (!PlansyncWorkflow.EnsureDestination(out _))
            {
                return Result.Cancelled;
            }

            var request = new PublishRequest
            {
                IncludeIfc = vm.IncludeIfc,
                IncludePdf = vm.IncludePdf,
                Ifc = vm.Ifc.ToSettings(),
                Pdf = vm.Pdf.ToSettings(),
                Options = vm.ToOptions(),
                PdfDrawings = vm.Pdf.Drawings.ToList()
            };

            return PublishCoordinator.Run(doc, request, ref message);
        }

        private static Result RunLocalExport(Document doc, ExportToPlansyncViewModel vm, ref string message)
        {
            bool includeIfc = vm.IncludeIfc;
            bool includePdf = vm.IncludePdf;

            if (!includeIfc && !includePdf)
            {
                TaskDialog.Show("Plansync", "Select IFC and/or PDF to export.");
                return Result.Cancelled;
            }

            IfcExportSettings ifcSettings = vm.Ifc.ToSettings();
            PdfExportSettings pdfSettings = vm.Pdf.ToSettings();
            List<ViewItemViewModel> pdfDrawings = vm.Pdf.Drawings.ToList();

            string? folder;
            string? ifcFileName = null;
            string? combinedPdfName = null;

            if (includeIfc && !includePdf)
            {
                // Single file — let the user pick the exact name/location, as before.
                string? viewName = GetFilterViewName(doc, ifcSettings);
                string suggested = FileNameSanitizer.SuggestIfcFileName(doc.Title, ifcSettings.FilterByView, viewName);

                var dialog = new SaveFileDialog
                {
                    Title = "Export IFC",
                    Filter = "IFC files (*.ifc)|*.ifc",
                    FileName = suggested + ".ifc",
                    AddExtension = true,
                    DefaultExt = ".ifc"
                };

                if (dialog.ShowDialog() != true)
                {
                    return Result.Cancelled;
                }

                folder = Path.GetDirectoryName(dialog.FileName);
                ifcFileName = Path.GetFileNameWithoutExtension(dialog.FileName);
            }
            else if (includePdf && !includeIfc && pdfSettings.Combine)
            {
                var selected = pdfDrawings.Where(d => pdfSettings.SelectedViewIds.Contains(d.Id)).ToList();
                string suggested = FileNameSanitizer.SuggestCombinedPdfFileName(doc.Title, selected);

                var dialog = new SaveFileDialog
                {
                    Title = "Export PDF",
                    Filter = "PDF files (*.pdf)|*.pdf",
                    FileName = suggested + ".pdf",
                    AddExtension = true,
                    DefaultExt = ".pdf"
                };

                if (dialog.ShowDialog() != true)
                {
                    return Result.Cancelled;
                }

                folder = Path.GetDirectoryName(dialog.FileName);
                combinedPdfName = Path.GetFileNameWithoutExtension(dialog.FileName);
            }
            else
            {
                // Multiple output files (both types, and/or one-PDF-per-sheet) — pick a folder.
                var folderDialog = new OpenFolderDialog
                {
                    Title = "Choose a folder to save the exported file(s)"
                };

                if (folderDialog.ShowDialog() != true)
                {
                    return Result.Cancelled;
                }

                folder = folderDialog.FolderName;
            }

            if (string.IsNullOrWhiteSpace(folder))
            {
                TaskDialog.Show("Plansync", "Invalid export path.");
                return Result.Cancelled;
            }

            var exported = new List<ExportedFile>();

            try
            {
                using var progress = new ProgressScope("Exporting");

                if (includeIfc)
                {
                    exported.Add(LocalExportService.ExportIfc(
                        doc,
                        ifcSettings,
                        folder,
                        ifcFileName,
                        (status, detail, percent) => progress.Report(status, detail, percent)));
                }

                if (includePdf)
                {
                    exported.AddRange(LocalExportService.ExportPdfs(
                        doc,
                        pdfSettings,
                        pdfDrawings,
                        folder,
                        (status, detail, percent) => progress.Report(status, detail, percent),
                        combinedFileNameWithoutExtension: combinedPdfName));
                }

                progress.Report("Done", $"{exported.Count} file(s)", 100);
            }
            catch (Exception ex)
            {
                message = ex.Message;
                PlansyncErrorDialog.Show("Export failed", "ExportCommand.RunLocalExport", ex);
                return Result.Failed;
            }

            string summary = exported.Count == 1
                ? exported[0].Path
                : $"{exported.Count} file(s) in:\n{folder}\n\n"
                  + string.Join("\n", exported.Take(8).Select(f => "• " + f.FileName));
            TaskDialog.Show("Plansync", $"Export complete:\n{summary}");
            return Result.Succeeded;
        }

        private static string? GetFilterViewName(Document doc, IfcExportSettings settings)
        {
            if (!settings.FilterByView || settings.FilterViewId is not long viewId)
            {
                return null;
            }

            return (doc.GetElement(new ElementId(viewId)) as Autodesk.Revit.DB.View)?.Name;
        }
    }
}
