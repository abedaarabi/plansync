using Autodesk.Revit.DB;
using PlansyncRevitPlugin.Models;

namespace PlansyncRevitPlugin.Services
{
    internal sealed class ParamQaResult
    {
        public List<string> MissingOrEmpty { get; } = new();
        public int SampledElements { get; set; }
        public bool HasIssues => MissingOrEmpty.Count > 0;

        public string Summary =>
            HasIssues
                ? $"{MissingOrEmpty.Count} selected parameter(s) appear empty on sampled elements:\n• "
                  + string.Join("\n• ", MissingOrEmpty.Take(12))
                  + (MissingOrEmpty.Count > 12 ? "\n…" : string.Empty)
                : "Parameter QA passed.";
    }

    internal static class ParamQaService
    {
        public static ParamQaResult Evaluate(Document doc, IfcExportSettings settings)
        {
            var result = new ParamQaResult();
            if (settings.ParameterMode != IfcParameterMode.SelectedParametersOnly
                || settings.SelectedParameterNames.Count == 0)
            {
                return result;
            }

            var names = new HashSet<string>(settings.SelectedParameterNames, StringComparer.OrdinalIgnoreCase);
            var foundNonEmpty = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var elements = new FilteredElementCollector(doc)
                .WhereElementIsNotElementType()
                .Take(400)
                .ToList();

            result.SampledElements = elements.Count;

            foreach (Element element in elements)
            {
                foreach (Parameter parameter in element.Parameters)
                {
                    string? name = parameter.Definition?.Name;
                    if (name is null || !names.Contains(name))
                    {
                        continue;
                    }

                    seen.Add(name);
                    if (!parameter.HasValue || string.IsNullOrWhiteSpace(parameter.AsValueString()))
                    {
                        continue;
                    }

                    foundNonEmpty.Add(name);
                }
            }

            foreach (string name in names)
            {
                if (!foundNonEmpty.Contains(name))
                {
                    result.MissingOrEmpty.Add(name);
                }
            }

            return result;
        }
    }
}
