using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.UI;

namespace PlansyncRevitPlugin
{
    [Transaction(TransactionMode.Manual)]
    public class ShowClashesPanelCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                var pane = commandData.Application.GetDockablePane(PlansyncPaneProvider.PaneId);
                pane.Show();

                if (PlansyncPaneProvider.CurrentPane is PlansyncStatusPane statusPane)
                {
                    statusPane.ShowClashesTab();
                }
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }

            return Result.Succeeded;
        }
    }
}
