using Autodesk.Revit.UI;
using PlansyncRevitPlugin.UI;

namespace PlansyncRevitPlugin
{
    public class PlansyncApp : IExternalApplication
    {
        public Result OnStartup(UIControlledApplication application)
        {
            const string tabName = "Plansync";
            const string panelName = "Plansync Tools";

            try
            {
                application.CreateRibbonTab(tabName);
            }
            catch
            {
                // Tab may already exist.
            }

            try
            {
                application.RegisterDockablePane(
                    PlansyncPaneProvider.PaneId,
                    "Plansync",
                    new PlansyncPaneProvider());
            }
            catch
            {
                // Pane may already be registered 
            }

            RibbonPanel panel = application.CreateRibbonPanel(tabName, panelName);
            string assemblyPath = typeof(PlansyncApp).Assembly.Location;

            var hubButtonData = new PushButtonData(
                "PlansyncHub",
                "Plansync",
                assemblyPath,
                "PlansyncRevitPlugin.PlansyncHubCommand")
            {
                ToolTip = "Sign in and publish IFC/PDF to Plansync (cloud upload)",
                LargeImage = IconLoader.Load("plansync_32.png"),
                Image = IconLoader.Load("plansync_16.png")
            };

            var exportButtonData = new PushButtonData(
                "PlansyncExport",
                "Export",
                assemblyPath,
                "PlansyncRevitPlugin.ExportCommand")
            {
                ToolTip = "Export IFC and/or PDF — save to your computer or publish to Plansync cloud",
                LargeImage = IconLoader.Load("ifc_32.png") ?? IconLoader.Load("plansync_32.png"),
                Image = IconLoader.Load("ifc_16.png") ?? IconLoader.Load("plansync_16.png")
            };

            var panelButtonData = new PushButtonData(
                "PlansyncShowPanel",
                "Status\nPanel",
                assemblyPath,
                "PlansyncRevitPlugin.ShowPlansyncPanelCommand")
            {
                ToolTip = "Show the Plansync status panel",
                LargeImage = IconLoader.Load("logo_app_40.png") ?? IconLoader.Load("plansync_32.png"),
                Image = IconLoader.Load("plansync_16.png")
            };

            panel.AddItem(hubButtonData);
            panel.AddItem(exportButtonData);
            panel.AddItem(panelButtonData);

            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            return Result.Succeeded;
        }
    }
}
