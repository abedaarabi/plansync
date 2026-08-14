using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.UI;

namespace PlansyncRevitPlugin
{
    [Transaction(TransactionMode.Manual)]
    public class ShowPlansyncPanelCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                var pane = commandData.Application.GetDockablePane(PlansyncPaneProvider.PaneId);
                pane.Show();
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                TaskDialog.Show("Plansync", $"Could not show status panel:\n{ex.Message}");
                return Result.Failed;
            }
        }
    }
}
