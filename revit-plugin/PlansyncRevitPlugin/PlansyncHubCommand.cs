using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Services;

namespace PlansyncRevitPlugin
{
    [Transaction(TransactionMode.Manual)]
    public class PlansyncHubCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            if (!PlansyncWorkflow.ShowBrowser(out string? requestedExport))
            {
                return Result.Cancelled;
            }

            if (requestedExport == "export" || requestedExport == "ifc" || requestedExport == "pdf")
            {
                bool preferIfc = requestedExport is "export" or "ifc";
                bool preferPdf = requestedExport is "export" or "pdf";
                if (requestedExport == "ifc")
                {
                    preferPdf = false;
                }

                if (requestedExport == "pdf")
                {
                    preferIfc = false;
                }

                return new ExportCommand().Execute(
                    commandData,
                    ref message,
                    preferIfc,
                    preferPdf,
                    forceCloud: true);
            }

            PublishStatusHub.Notify($"Destination saved: {PlansyncSessionState.DestinationLabel}");
            TaskDialog.Show(
                "Plansync",
                $"Destination saved:\n{PlansyncSessionState.DestinationLabel}\n\nOpen Plansync again and choose Export to Plansync to upload, or use Export IFC / Export PDF for local files.");
            return Result.Succeeded;
        }
    }
}
