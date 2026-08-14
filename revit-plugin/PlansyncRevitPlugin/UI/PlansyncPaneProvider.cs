using Autodesk.Revit.UI;

namespace PlansyncRevitPlugin.UI
{
    public sealed class PlansyncPaneProvider : IDockablePaneProvider
    {
        public static readonly DockablePaneId PaneId =
            new(new Guid("A7C3E9B1-4D2F-4A8E-9C11-2B6F8D0E5A31"));

        /// <summary>Last created pane instance (for ribbon commands to switch tabs).</summary>
        public static PlansyncStatusPane? CurrentPane { get; private set; }

        public void SetupDockablePane(DockablePaneProviderData data)
        {
            var pane = new PlansyncStatusPane();
            CurrentPane = pane;
            data.FrameworkElement = pane;
            data.InitialState = new DockablePaneState
            {
                DockPosition = DockPosition.Right
            };
        }
    }
}
