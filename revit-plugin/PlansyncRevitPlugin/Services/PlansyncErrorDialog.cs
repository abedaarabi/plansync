using Autodesk.Revit.UI;

namespace PlansyncRevitPlugin.Services
{
    internal static class PlansyncErrorDialog
    {
        public static void Show(string mainInstruction, string context, Exception ex)
        {
            TaskDialog.Show("Plansync", $"{mainInstruction}\n\n{ex.Message}");
        }
    }
}
