using Autodesk.Revit.UI;

namespace PlansyncRevitPlugin.Services
{
    internal static class PlansyncErrorDialog
    {
        public static void Show(string mainInstruction, string context, Exception ex)
        {
            TaskDialog.Show("Plansync", $"{mainInstruction}\n\n{Format(ex)}");
        }

        public static string Format(Exception ex)
        {
            var parts = new List<string>();
            for (Exception? cur = ex; cur is not null; cur = cur.InnerException)
            {
                if (!string.IsNullOrWhiteSpace(cur.Message))
                {
                    parts.Add(cur.Message);
                }
            }

            return parts.Count == 0 ? ex.ToString() : string.Join("\n\n→ ", parts);
        }
    }
}
