using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.IssueReview;
using PlansyncRevitPlugin.UI;

namespace PlansyncRevitPlugin
{
    public class PlansyncApp : IExternalApplication
    {
        private const string TabName = "Plansync";
        private const string PanelName = "Plansync Tools";

        public Result OnStartup(UIControlledApplication application)
        {
            PlansyncLog.Write("OnStartup begin");

            // Ribbon first: a failure in host/pane wiring must not remove the toolbar.
            try
            {
                BuildRibbon(application);
                PlansyncLog.Write("Ribbon created");
            }
            catch (Exception ex)
            {
                PlansyncLog.Write("BuildRibbon failed", ex);
            }

            TryStep("RevitUiHost.Attach", () => RevitUiHost.Attach(application));
            TryStep("IssueReviewService.EnsureInitialized", IssueReviewService.EnsureInitialized);
            TryStep(
                "RegisterDockablePane",
                () => application.RegisterDockablePane(
                    PlansyncPaneProvider.PaneId,
                    "Plansync",
                    new PlansyncPaneProvider()));

            PlansyncLog.Write("OnStartup end");
            return Result.Succeeded;
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            TryStep("RevitUiHost.Detach", RevitUiHost.Detach);
            return Result.Succeeded;
        }

        private static void BuildRibbon(UIControlledApplication application)
        {
            try
            {
                application.CreateRibbonTab(TabName);
            }
            catch
            {
                // Tab may already exist.
            }

            RibbonPanel panel = GetOrCreatePanel(application, TabName, PanelName);
            string assemblyPath = typeof(PlansyncApp).Assembly.Location;

            AddButton(
                panel,
                new PushButtonData(
                    "PlansyncHub",
                    "Plansync",
                    assemblyPath,
                    "PlansyncRevitPlugin.PlansyncHubCommand")
                {
                    ToolTip = "Sign in and publish IFC/PDF to Plansync (cloud upload)",
                    LargeImage = LoadIcon("icon-180.png", "plansync_32.png"),
                    Image = LoadIcon("icon-180.png", "plansync_16.png")
                });

            AddButton(
                panel,
                new PushButtonData(
                    "PlansyncExport",
                    "Export",
                    assemblyPath,
                    "PlansyncRevitPlugin.ExportCommand")
                {
                    ToolTip = "Export IFC and/or PDF — save to your computer or publish to Plansync cloud",
                    LargeImage = LoadIcon("fluent_export_32.png", "ifc_32.png"),
                    Image = LoadIcon("fluent_export_16.png", "ifc_16.png")
                });

            AddButton(
                panel,
                new PushButtonData(
                    "PlansyncShowPanel",
                    "Status\nPanel",
                    assemblyPath,
                    "PlansyncRevitPlugin.ShowPlansyncPanelCommand")
                {
                    ToolTip = "Show the Plansync status panel",
                    LargeImage = LoadIcon("fluent_status_32.png", "logo_app_40.png"),
                    Image = LoadIcon("fluent_status_16.png", "plansync_16.png")
                });

            AddButton(
                panel,
                new PushButtonData(
                    "PlansyncIssues",
                    "Issues",
                    assemblyPath,
                    "PlansyncRevitPlugin.ShowIssuesPanelCommand")
                {
                    ToolTip = "Review Plansync issues in Revit — open in 3D, edit status, sync to the web app",
                    LargeImage = LoadIcon("fluent_issues_32.png", "plansync_32.png"),
                    Image = LoadIcon("fluent_issues_16.png", "plansync_16.png")
                });
        }

        private static System.Windows.Media.ImageSource? LoadIcon(string primary, string fallback)
        {
            try
            {
                return IconLoader.Load(primary) ?? IconLoader.Load(fallback);
            }
            catch (Exception ex)
            {
                PlansyncLog.Write($"Icon load failed ({primary})", ex);
                return null;
            }
        }

        private static void TryStep(string name, Action step)
        {
            try
            {
                step();
                PlansyncLog.Write($"{name} ok");
            }
            catch (Exception ex)
            {
                PlansyncLog.Write($"{name} failed", ex);
            }
        }

        private static RibbonPanel GetOrCreatePanel(
            UIControlledApplication application,
            string tabName,
            string panelName)
        {
            try
            {
                foreach (RibbonPanel existing in application.GetRibbonPanels(tabName))
                {
                    if (string.Equals(existing.Name, panelName, StringComparison.OrdinalIgnoreCase))
                    {
                        return existing;
                    }
                }
            }
            catch (Exception ex)
            {
                PlansyncLog.Write("GetRibbonPanels failed", ex);
            }

            return application.CreateRibbonPanel(tabName, panelName);
        }

        private static void AddButton(RibbonPanel panel, PushButtonData data)
        {
            try
            {
                foreach (RibbonItem item in panel.GetItems())
                {
                    if (string.Equals(item.Name, data.Name, StringComparison.OrdinalIgnoreCase))
                    {
                        return;
                    }
                }

                panel.AddItem(data);
            }
            catch (Exception ex)
            {
                PlansyncLog.Write($"AddButton {data.Name} failed", ex);
            }
        }
    }
}
