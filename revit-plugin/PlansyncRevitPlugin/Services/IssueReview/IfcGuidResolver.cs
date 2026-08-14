using Autodesk.Revit.DB;

namespace PlansyncRevitPlugin.Services.IssueReview
{
    /// <summary>An IFC GUID match in the host document or a loaded link.</summary>
    internal sealed class IfcGuidHit
    {
        public required Element Element { get; init; }

        /// <summary>Null when <see cref="Element"/> belongs to the host document.</summary>
        public RevitLinkInstance? LinkInstance { get; init; }

        public bool IsLinked => LinkInstance is not null;

        public Document HostDocument =>
            LinkInstance?.Document ?? Element.Document;

        /// <summary>Bounding box in host-document coordinates.</summary>
        public BoundingBoxXYZ? GetHostBoundingBox()
        {
            BoundingBoxXYZ? local = Element.get_BoundingBox(null);
            if (local is null)
            {
                return null;
            }

            if (LinkInstance is null)
            {
                return local;
            }

            return TransformBoundingBox(local, LinkInstance.GetTotalTransform());
        }

        private static BoundingBoxXYZ TransformBoundingBox(BoundingBoxXYZ box, Transform transform)
        {
            XYZ[] corners =
            [
                new(box.Min.X, box.Min.Y, box.Min.Z),
                new(box.Min.X, box.Min.Y, box.Max.Z),
                new(box.Min.X, box.Max.Y, box.Min.Z),
                new(box.Min.X, box.Max.Y, box.Max.Z),
                new(box.Max.X, box.Min.Y, box.Min.Z),
                new(box.Max.X, box.Min.Y, box.Max.Z),
                new(box.Max.X, box.Max.Y, box.Min.Z),
                new(box.Max.X, box.Max.Y, box.Max.Z)
            ];

            XYZ min = new(double.MaxValue, double.MaxValue, double.MaxValue);
            XYZ max = new(double.MinValue, double.MinValue, double.MinValue);
            foreach (XYZ c in corners)
            {
                XYZ p = transform.OfPoint(c);
                min = new XYZ(Math.Min(min.X, p.X), Math.Min(min.Y, p.Y), Math.Min(min.Z, p.Z));
                max = new XYZ(Math.Max(max.X, p.X), Math.Max(max.Y, p.Y), Math.Max(max.Z, p.Z));
            }

            return new BoundingBoxXYZ { Min = min, Max = max };
        }
    }

    internal static class IfcGuidResolver
    {
        /// <summary>
        /// Find model elements whose IFC GlobalId matches any of the given GUIDs
        /// (case-insensitive). Searches the host document and loaded links.
        /// </summary>
        public static Dictionary<string, IfcGuidHit> FindByGuids(
            Document doc,
            IEnumerable<string> guids)
        {
            var wanted = new HashSet<string>(
                guids.Where(g => !string.IsNullOrWhiteSpace(g)).Select(Normalize),
                StringComparer.OrdinalIgnoreCase);
            var found = new Dictionary<string, IfcGuidHit>(StringComparer.OrdinalIgnoreCase);
            if (wanted.Count == 0)
            {
                return found;
            }

            ScanDocument(doc, linkInstance: null, wanted, found);

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

                ScanDocument(linkDoc, link, wanted, found);
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
            RevitLinkInstance? linkInstance,
            HashSet<string> wanted,
            Dictionary<string, IfcGuidHit> found)
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
                    found[key] = new IfcGuidHit
                    {
                        Element = el,
                        LinkInstance = linkInstance
                    };
                }
            }
        }

        private static string Normalize(string guid) =>
            guid.Trim().Replace("-", string.Empty, StringComparison.Ordinal);
    }
}
