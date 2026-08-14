using Autodesk.Revit.DB;

namespace PlansyncRevitPlugin.Services.IssueReview
{
    internal static class IfcGuidResolver
    {
        /// <summary>
        /// Find model elements whose IFC GlobalId matches any of the given GUIDs
        /// (case-insensitive). Searches the host document and loaded links.
        /// </summary>
        public static Dictionary<string, Element> FindByGuids(
            Document doc,
            IEnumerable<string> guids)
        {
            var wanted = new HashSet<string>(
                guids.Where(g => !string.IsNullOrWhiteSpace(g)).Select(Normalize),
                StringComparer.OrdinalIgnoreCase);
            var found = new Dictionary<string, Element>(StringComparer.OrdinalIgnoreCase);
            if (wanted.Count == 0)
            {
                return found;
            }

            ScanDocument(doc, wanted, found);

            var links = new FilteredElementCollector(doc)
                .OfClass(typeof(RevitLinkInstance))
                .Cast<RevitLinkInstance>();
            foreach (RevitLinkInstance link in links)
            {
                Document? linkDoc = link.GetLinkDocument();
                if (linkDoc is null)
                {
                    continue;
                }

                ScanDocument(linkDoc, wanted, found);
                if (found.Count >= wanted.Count)
                {
                    break;
                }
            }

            return found;
        }

        public static string? ReadIfcGuid(Element element)
        {
            Parameter? p = element.get_Parameter(BuiltInParameter.IFC_GUID);
            string? value = p?.AsString();
            if (!string.IsNullOrWhiteSpace(value))
            {
                return value.Trim();
            }

            p = element.LookupParameter("IfcGUID") ?? element.LookupParameter("IFC GUID");
            value = p?.AsString();
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }

        private static void ScanDocument(
            Document doc,
            HashSet<string> wanted,
            Dictionary<string, Element> found)
        {
            foreach (Element el in new FilteredElementCollector(doc)
                         .WhereElementIsNotElementType())
            {
                if (found.Count >= wanted.Count)
                {
                    return;
                }

                string? guid = ReadIfcGuid(el);
                if (guid is null)
                {
                    continue;
                }

                string key = Normalize(guid);
                if (wanted.Contains(key) && !found.ContainsKey(key))
                {
                    found[key] = el;
                }
            }
        }

        private static string Normalize(string guid) =>
            guid.Trim().Replace("-", string.Empty, StringComparison.Ordinal);
    }
}
