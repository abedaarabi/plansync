using Autodesk.Revit.DB;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.Services
{
    internal static class PrintableViewCollector
    {
        public static List<ViewItemViewModel> CollectPrintable(Document doc)
        {
            var items = new List<ViewItemViewModel>();

            foreach (ViewSheet sheet in new FilteredElementCollector(doc)
                         .OfClass(typeof(ViewSheet))
                         .Cast<ViewSheet>()
                         .Where(s => !s.IsTemplate && s.CanBePrinted))
            {
                items.Add(new ViewItemViewModel
                {
                    Id = sheet.Id.Value,
                    Name = $"{sheet.SheetNumber} - {sheet.Name}",
                    Category = "Sheet",
                    ViewTypeName = "Sheet",
                    SheetNumber = sheet.SheetNumber,
                    SheetName = sheet.Name
                });
            }

            foreach (View view in new FilteredElementCollector(doc)
                         .OfClass(typeof(View))
                         .Cast<View>()
                         .Where(v => v is not ViewSheet
                                     && !v.IsTemplate
                                     && v.CanBePrinted
                                     && v.ViewType != ViewType.DrawingSheet
                                     && v.ViewType != ViewType.Internal
                                     && v.ViewType != ViewType.ProjectBrowser
                                     && v.ViewType != ViewType.SystemBrowser))
            {
                items.Add(new ViewItemViewModel
                {
                    Id = view.Id.Value,
                    Name = view.Name,
                    Category = "View",
                    ViewTypeName = view.ViewType.ToString(),
                    SheetNumber = string.Empty,
                    SheetName = view.Name
                });
            }

            return items
                .OrderBy(i => i.Category)
                .ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public static List<ViewItemViewModel> CollectIfcFilterViews(Document doc)
        {
            var items = new List<ViewItemViewModel>();
            var seen = new HashSet<long>();

            // Collect View3D explicitly — OfClass(typeof(View)) can miss 3D views in some models.
            foreach (View3D view3D in new FilteredElementCollector(doc)
                         .OfClass(typeof(View3D))
                         .Cast<View3D>()
                         .Where(v => !v.IsTemplate && !v.IsPerspective))
            {
                AddIfcView(items, seen, view3D, "3D");
            }

            // Also include orthographic/perspective 3D and other common IFC filter views.
            foreach (View view in new FilteredElementCollector(doc)
                         .OfClass(typeof(View))
                         .Cast<View>()
                         .Where(IsIfcFilterCandidate))
            {
                AddIfcView(items, seen, view, FormatViewType(view));
            }

            return items
                .OrderBy(v => v.ViewTypeName == "3D" ? 0 : 1)
                .ThenBy(v => v.ViewTypeName, StringComparer.OrdinalIgnoreCase)
                .ThenBy(v => v.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static bool IsIfcFilterCandidate(View view)
        {
            if (view.IsTemplate || view is ViewSheet)
            {
                return false;
            }

            return view.ViewType is ViewType.ThreeD
                or ViewType.FloorPlan
                or ViewType.CeilingPlan
                or ViewType.Elevation
                or ViewType.Section
                or ViewType.EngineeringPlan
                or ViewType.AreaPlan;
        }

        private static void AddIfcView(
            ICollection<ViewItemViewModel> items,
            ISet<long> seen,
            View view,
            string typeLabel)
        {
            long id = view.Id.Value;
            if (!seen.Add(id))
            {
                return;
            }

            items.Add(new ViewItemViewModel
            {
                Id = id,
                Name = view.Name,
                Category = "View",
                ViewTypeName = typeLabel,
                SheetName = view.Name
            });
        }

        private static string FormatViewType(View view) => view.ViewType switch
        {
            ViewType.ThreeD => "3D",
            ViewType.FloorPlan => "Floor Plan",
            ViewType.CeilingPlan => "Ceiling Plan",
            ViewType.Elevation => "Elevation",
            ViewType.Section => "Section",
            ViewType.EngineeringPlan => "Engineering Plan",
            ViewType.AreaPlan => "Area Plan",
            _ => view.ViewType.ToString()
        };
    }
}
