using Autodesk.Revit.DB;
using PlansyncRevitPlugin.Services.Api;

namespace PlansyncRevitPlugin.Services.IssueReview
{
    internal static class ClashFormat
    {
        public static string StatusLabel(string status) => status switch
        {
            "NEW" => "New",
            "ACTIVE" => "Active",
            "RESOLVED" => "Resolved",
            "IGNORED" => "Ignored",
            _ => status
        };

        public static string TypeLabel(string type) => type switch
        {
            "HARD" => "Hard",
            "CLEARANCE" => "Clearance",
            "DUPLICATE" => "Duplicate",
            _ => type
        };

        public static string ElementLabel(ClashElementRef? element, string guid)
        {
            if (!string.IsNullOrWhiteSpace(element?.Name))
            {
                return element!.Name!;
            }

            if (!string.IsNullOrWhiteSpace(element?.IfcType))
            {
                return ShortType(element!.IfcType);
            }

            return string.IsNullOrWhiteSpace(guid) ? "Element" : guid;
        }

        public static string ShortType(string? ifcType)
        {
            if (string.IsNullOrWhiteSpace(ifcType))
            {
                return "Element";
            }

            return ifcType.StartsWith("Ifc", StringComparison.Ordinal)
                ? ifcType[3..]
                : ifcType;
        }

        public static string DistanceDetail(string clashType, double distanceMm)
        {
            string value = Distance(distanceMm);
            return clashType switch
            {
                "HARD" => $"Penetration {value}",
                "CLEARANCE" => $"Gap {value}",
                _ => value
            };
        }

        public static string Distance(double distanceMm)
        {
            if (!double.IsFinite(distanceMm))
            {
                return "—";
            }

            Document? doc = PlansyncRevitPlugin.Services.RevitUiHost.UiApp?.ActiveUIDocument?.Document;
            if (doc is not null)
            {
                try
                {
                    double feet = distanceMm / 304.8;
                    return UnitFormatUtils
                        .Format(doc.GetUnits(), SpecTypeId.Length, feet, false)
                        .Trim();
                }
                catch
                {
                    // Fall through to millimetres.
                }
            }

            if (Math.Abs(distanceMm) < 0.05)
            {
                return "0 mm";
            }

            return $"{Math.Round(Math.Abs(distanceMm), 1)} mm";
        }
    }
}
