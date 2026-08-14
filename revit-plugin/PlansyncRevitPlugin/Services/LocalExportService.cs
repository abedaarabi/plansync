using System.IO;
using Autodesk.Revit.DB;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.Services
{
    internal sealed class ExportedFile
    {
        public required string Path { get; init; }
        public required string FileName { get; init; }
        public required string ContentType { get; init; }
        public string Kind { get; init; } = "file";
    }

    internal delegate void ExportProgressCallback(string status, string? detail, double? percent);

    internal static class LocalExportService
    {
        public static ExportedFile ExportIfc(
            Document doc,
            IfcExportSettings settings,
            string outputDirectory,
            string? fileNameWithoutExtension = null,
            ExportProgressCallback? progress = null)
        {
            string fileName = FileNameSanitizer.Sanitize(
                string.IsNullOrWhiteSpace(fileNameWithoutExtension) ? doc.Title : fileNameWithoutExtension);
            string? psetPath = null;

            try
            {
                progress?.Invoke("Preparing IFC export…", fileName + ".ifc", 8);
                ProgressWindowPump();

                var options = BuildIfcExportOptions(doc, settings, out psetPath, progress);

                Directory.CreateDirectory(outputDirectory);

                progress?.Invoke("Exporting IFC model…", "This can take a minute for large models", null);
                ProgressWindowPump();

                bool exported;
                using (var transaction = new Transaction(doc, "Export IFC"))
                {
                    transaction.Start();

                    if (settings.IncludeAllLevelsAsBuildingStories)
                    {
                        EnsureAllLevelsAreBuildingStories(doc);
                    }

                    exported = doc.Export(outputDirectory, fileName, options);
                    transaction.RollBack();
                }

                if (!exported)
                {
                    throw new InvalidOperationException("IFC export failed.");
                }

                progress?.Invoke("Finalizing IFC file…", null, 92);
                ProgressWindowPump();

                string exportedPath = Path.Combine(outputDirectory, fileName + ".ifc");
                if (!File.Exists(exportedPath))
                {
                    exportedPath = Directory.GetFiles(outputDirectory, "*.ifc").FirstOrDefault()
                                   ?? throw new InvalidOperationException("IFC export did not produce a file.");
                }

                progress?.Invoke("IFC export complete", Path.GetFileName(exportedPath), 100);
                ProgressWindowPump();

                return new ExportedFile
                {
                    Path = exportedPath,
                    FileName = Path.GetFileName(exportedPath),
                    ContentType = "model/ifc",
                    Kind = "ifc"
                };
            }
            finally
            {
                if (psetPath is not null)
                {
                    try { File.Delete(psetPath); } catch { /* ignore */ }
                }
            }
        }

        /// <summary>Turns on the "Building Story" checkbox for every Level so Revit's IFC exporter
        /// creates an IfcBuildingStorey for each one. Without this, levels created for reference
        /// purposes (sills, tops, grids, etc.) often have this flag unchecked and are silently
        /// dropped from the storey hierarchy. Must be called inside the export transaction, which
        /// is rolled back after export so the model is left untouched.</summary>
        private static void EnsureAllLevelsAreBuildingStories(Document doc)
        {
            var levels = new FilteredElementCollector(doc)
                .OfClass(typeof(Level))
                .Cast<Level>();

            foreach (Level level in levels)
            {
                Parameter? isBuildingStory = level.get_Parameter(BuiltInParameter.LEVEL_IS_BUILDING_STORY);
                if (isBuildingStory is { IsReadOnly: false } && isBuildingStory.AsInteger() != 1)
                {
                    isBuildingStory.Set(1);
                }
            }
        }

        private static IFCVersion ToRevitIfcVersion(IfcExportVersion version) => version switch
        {
            IfcExportVersion.Ifc4ReferenceView => IFCVersion.IFC4RV,
            IfcExportVersion.Ifc2x3CoordinationView2 => IFCVersion.IFC2x3CV2,
            IfcExportVersion.Ifc4x3 => IFCVersion.IFC4x3,
            IfcExportVersion.Ifc4x3ReferenceView => IFCVersion.IFC4x3RV,
            _ => IFCVersion.IFC4
        };

        private static IFCExportOptions BuildIfcExportOptions(
            Document doc,
            IfcExportSettings settings,
            out string? psetPath,
            ExportProgressCallback? progress)
        {
            psetPath = null;

            var options = new IFCExportOptions
            {
                FileVersion = ToRevitIfcVersion(settings.Version),
                ExportBaseQuantities = settings.ExportBaseQuantities,
                WallAndColumnSplitting = false,
                SpaceBoundaryLevel = 1
            };

            bool filterByView = settings.FilterByView && settings.FilterViewId is long;
            View? filterView = null;
            if (filterByView && settings.FilterViewId is long viewId)
            {
                filterView = doc.GetElement(new ElementId(viewId)) as View;
                options.FilterViewId = new ElementId(viewId);
                // Visibility filter only — keeps walls/floors/doors as solid IFC elements.
                options.AddOption("VisibleElementsOfCurrentView", "true");

                // Autodesk: UseActiveViewGeometry on non-3D views can produce unexpected
                // results (often spaces / 2D cuts instead of building elements).
                bool is3D = filterView is View3D || filterView?.ViewType == ViewType.ThreeD;
                options.AddOption("UseActiveViewGeometry", is3D ? "true" : "false");
            }
            else
            {
                options.FilterViewId = ElementId.InvalidElementId;
                options.AddOption("VisibleElementsOfCurrentView", "false");
                options.AddOption("UseActiveViewGeometry", "false");
            }

            // Always export solid building elements; rooms/2D are additive options.
            options.AddOption("ExportSolidModelRep", "true");
            options.AddOption("ExportPartsAsBuildingElements", "false");
            options.AddOption("ExportBoundingBox", "false");
            options.AddOption("IncludeSteelElements", "true");
            options.AddOption("IncludeSiteElevation", "true");
            options.AddOption("TessellationLevelOfDetail", "0.5");
            options.AddOption("Use2DRoomBoundaryForVolume", "false");

            options.AddOption(
                "ExportIFCCommonPropertySets",
                settings.ExportIfcCommonPropertySets ? "true" : "false");
            options.AddOption(
                "ExportBaseQuantities",
                settings.ExportBaseQuantities ? "true" : "false");

            // Rooms become IfcSpace — they are added on top of elements, not instead of them.
            options.AddOption(
                "ExportRoomsInView",
                settings.ExportRoomsInView ? "true" : "false");
            options.AddOption(
                "Export2DElements",
                settings.Export2DElements ? "true" : "false");

            if (settings.ParameterMode == IfcParameterMode.SelectedParametersOnly)
            {
                progress?.Invoke(
                    "Building parameter set…",
                    $"{settings.SelectedParameterNames.Count} parameters",
                    18);
                ProgressWindowPump();
                psetPath = UserDefinedPsetWriter.WriteTempFile(settings.SelectedParameterNames);
                options.AddOption("ExportInternalRevitPropertySets", "false");
                options.AddOption("ExportUserDefinedPsets", "true");
                options.AddOption("ExportUserDefinedPsetsFileName", psetPath);
            }
            else
            {
                options.AddOption("ExportInternalRevitPropertySets", "true");
                options.AddOption("ExportUserDefinedPsets", "false");
            }

            return options;
        }

        public static List<ExportedFile> ExportPdfs(
            Document doc,
            PdfExportSettings settings,
            IReadOnlyList<ViewItemViewModel> drawings,
            string tempDir,
            ExportProgressCallback? progress = null,
            string? combinedFileNameWithoutExtension = null)
        {
            var selected = drawings
                .Where(d => settings.SelectedViewIds.Contains(d.Id))
                .ToList();

            if (selected.Count == 0)
            {
                throw new InvalidOperationException("No sheets or views were selected for PDF export.");
            }

            var results = new List<ExportedFile>();
            Directory.CreateDirectory(tempDir);

            if (settings.Combine)
            {
                string fileName = FileNameSanitizer.Sanitize(
                    string.IsNullOrWhiteSpace(combinedFileNameWithoutExtension)
                        ? FileNameSanitizer.SuggestCombinedPdfFileName(doc.Title, selected)
                        : combinedFileNameWithoutExtension);
                progress?.Invoke(
                    "Exporting combined PDF…",
                    fileName + ".pdf",
                    null);
                ProgressWindowPump();

                var options = new PDFExportOptions
                {
                    FileName = fileName,
                    Combine = true
                };

                var viewIds = selected.Select(d => new ElementId(d.Id)).ToList();
                if (!doc.Export(tempDir, viewIds, options))
                {
                    throw new InvalidOperationException("PDF export failed.");
                }

                progress?.Invoke("Finalizing PDF…", null, 90);
                ProgressWindowPump();

                string path = Path.Combine(tempDir, fileName + ".pdf");
                if (!File.Exists(path))
                {
                    path = Directory.GetFiles(tempDir, "*.pdf").FirstOrDefault()
                           ?? throw new InvalidOperationException("PDF export did not produce a file.");
                }

                results.Add(new ExportedFile
                {
                    Path = path,
                    FileName = Path.GetFileName(path),
                    ContentType = "application/pdf",
                    Kind = "pdf"
                });

                progress?.Invoke("PDF export complete", Path.GetFileName(path), 100);
                ProgressWindowPump();
                return results;
            }

            var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (int i = 0; i < selected.Count; i++)
            {
                ViewItemViewModel drawing = selected[i];
                double percent = ((i) / (double)selected.Count) * 100.0;

                progress?.Invoke(
                    $"Exporting PDF {i + 1} of {selected.Count}",
                    drawing.Name,
                    percent);
                ProgressWindowPump();

                string baseName = FileNameSanitizer.ApplyPdfTemplate(
                    settings.NamingTemplate,
                    drawing.SheetNumber,
                    string.IsNullOrWhiteSpace(drawing.SheetName) ? drawing.Name : drawing.SheetName,
                    doc.Title);

                string unique = baseName;
                int suffix = 2;
                while (!usedNames.Add(unique))
                {
                    unique = $"{baseName}_{suffix++}";
                }

                string subDir = Path.Combine(tempDir, Guid.NewGuid().ToString("N"));
                Directory.CreateDirectory(subDir);

                var options = new PDFExportOptions
                {
                    FileName = unique,
                    Combine = true
                };

                if (!doc.Export(subDir, new List<ElementId> { new(drawing.Id) }, options))
                {
                    throw new InvalidOperationException($"PDF export failed for '{drawing.Name}'.");
                }

                string path = Path.Combine(subDir, unique + ".pdf");
                if (!File.Exists(path))
                {
                    path = Directory.GetFiles(subDir, "*.pdf").FirstOrDefault()
                           ?? throw new InvalidOperationException($"PDF export did not produce a file for '{drawing.Name}'.");
                }

                string finalPath = Path.Combine(tempDir, unique + ".pdf");
                File.Copy(path, finalPath, overwrite: true);

                results.Add(new ExportedFile
                {
                    Path = finalPath,
                    FileName = unique + ".pdf",
                    ContentType = "application/pdf",
                    Kind = "pdf"
                });
            }

            progress?.Invoke("PDF export complete", $"{results.Count} file(s)", 100);
            ProgressWindowPump();
            return results;
        }

        private static void ProgressWindowPump()
        {
            try
            {
                UI.ProgressWindow.Pump();
            }
            catch
            {
                // Ignore if no dispatcher is available.
            }
        }
    }
}
