using System.IO;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.Services
{
    internal static class FileNameSanitizer
    {
        public static string Sanitize(string name)
        {
            foreach (char c in Path.GetInvalidFileNameChars())
            {
                name = name.Replace(c, '_');
            }

            return string.IsNullOrWhiteSpace(name) ? "export" : name.Trim();
        }

        public static string SuggestIfcFileName(string documentTitle, bool filterByView, string? viewName)
        {
            string title = Sanitize(documentTitle);
            if (filterByView && !string.IsNullOrWhiteSpace(viewName))
            {
                return Sanitize($"{title}_{viewName}");
            }

            return Sanitize($"{title}_Model");
        }

        public static string SuggestCombinedPdfFileName(
            string documentTitle,
            IReadOnlyList<ViewItemViewModel> selected)
        {
            if (selected.Count == 0)
            {
                return Sanitize(documentTitle);
            }

            if (selected.Count == 1)
            {
                return GetDrawingExportName(selected[0], "{SheetNumber}_{SheetName}", documentTitle);
            }

            var sheetNumbers = selected
                .Where(d => d.Category.Equals("Sheet", StringComparison.OrdinalIgnoreCase)
                            && !string.IsNullOrWhiteSpace(d.SheetNumber))
                .Select(d => d.SheetNumber.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .Take(4)
                .ToList();

            if (sheetNumbers.Count > 0)
            {
                string joined = string.Join("-", sheetNumbers);
                string suffix = selected.Count > sheetNumbers.Count
                    ? $"_{selected.Count}drawings"
                    : string.Empty;
                return Sanitize($"{Sanitize(documentTitle)}_{joined}{suffix}");
            }

            return Sanitize($"{documentTitle}_{selected.Count}drawings");
        }

        public static string GetDrawingExportName(
            ViewItemViewModel drawing,
            string template,
            string documentTitle)
        {
            if (drawing.Category.Equals("Sheet", StringComparison.OrdinalIgnoreCase))
            {
                return ApplyPdfTemplate(
                    template,
                    drawing.SheetNumber,
                    string.IsNullOrWhiteSpace(drawing.SheetName) ? drawing.Name : drawing.SheetName,
                    documentTitle);
            }

            // Printable views: prefer view name, still honor template tokens.
            return ApplyPdfTemplate(
                string.IsNullOrWhiteSpace(template) ? "{SheetName}" : template,
                drawing.SheetNumber,
                string.IsNullOrWhiteSpace(drawing.SheetName) ? drawing.Name : drawing.SheetName,
                documentTitle);
        }

        public static string ApplyPdfTemplate(
            string template,
            string sheetNumber,
            string sheetName,
            string documentTitle)
        {
            string result = (template ?? "{SheetNumber}_{SheetName}")
                .Replace("{SheetNumber}", sheetNumber ?? string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("{SheetName}", sheetName ?? string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("{ViewName}", sheetName ?? string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("{DocumentTitle}", documentTitle ?? string.Empty, StringComparison.OrdinalIgnoreCase)
                .Replace("{Date}", DateTime.Now.ToString("yyyy-MM-dd"), StringComparison.OrdinalIgnoreCase);

            result = result.Trim('_', ' ', '-');
            while (result.Contains("__", StringComparison.Ordinal))
            {
                result = result.Replace("__", "_", StringComparison.Ordinal);
            }

            return Sanitize(string.IsNullOrWhiteSpace(result) ? (documentTitle ?? "export") : result);
        }
    }
}
