using System.IO;
using Autodesk.Revit.DB;
using System.Windows.Media.Imaging;

namespace PlansyncRevitPlugin.Services
{
    /// <summary>
    /// Exports a single view/sheet preview image for the Export dialog.
    /// Never throws to the UI — failures return null.
    /// </summary>
    internal static class DrawingPreviewService
    {
        public static BitmapImage? TryExportThumbnail(Document doc, long viewId, int pixelSize = 720)
        {
            try
            {
                if (doc.GetElement(new ElementId(viewId)) is not View view || view.IsTemplate)
                {
                    return null;
                }

                string folder = Path.Combine(Path.GetTempPath(), "PlansyncRevitPreview");
                Directory.CreateDirectory(folder);
                string basePath = Path.Combine(folder, $"view_{viewId}_{Guid.NewGuid():N}");

                var options = new ImageExportOptions
                {
                    ExportRange = ExportRange.SetOfViews,
                    FilePath = basePath,
                    FitDirection = FitDirectionType.Horizontal,
                    HLRandWFViewsFileType = ImageFileType.PNG,
                    ShadowViewsFileType = ImageFileType.PNG,
                    ImageResolution = ImageResolution.DPI_72,
                    ZoomType = ZoomFitType.FitToPage,
                    PixelSize = Math.Clamp(pixelSize, 240, 1600)
                };
                options.SetViewsAndSheets(new List<ElementId> { view.Id });

                doc.ExportImage(options);

                string? png = Directory.GetFiles(folder, Path.GetFileName(basePath) + "*.png")
                    .OrderByDescending(File.GetLastWriteTimeUtc)
                    .FirstOrDefault();
                if (png is null || !File.Exists(png))
                {
                    return null;
                }

                var bitmap = new BitmapImage();
                using (var stream = File.OpenRead(png))
                {
                    bitmap.BeginInit();
                    bitmap.CacheOption = BitmapCacheOption.OnLoad;
                    bitmap.StreamSource = stream;
                    bitmap.EndInit();
                    bitmap.Freeze();
                }

                try
                {
                    File.Delete(png);
                }
                catch
                {
                    // Temp cleanup is best-effort.
                }

                return bitmap;
            }
            catch
            {
                return null;
            }
        }
    }
}
