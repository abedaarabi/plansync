using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace PlansyncRevitPlugin
{
    [Transaction(TransactionMode.Manual)]
    public class PlansyncCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            TaskDialog.Show("Plansync", "It works!");
            return Result.Succeeded;
        }
    }
}