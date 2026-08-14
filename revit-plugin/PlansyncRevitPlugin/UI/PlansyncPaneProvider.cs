using System.Windows;
using System.Windows.Controls;
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
            try
            {
                var pane = new PlansyncStatusPane();
                CurrentPane = pane;
                data.FrameworkElement = pane;
            }
            catch (Exception ex)
            {
                CurrentPane = null;
                Services.PlansyncLog.Write("PlansyncStatusPane creation failed", ex);
                data.FrameworkElement = CreateFallbackPane(ex);
            }

            var state = new DockablePaneState
            {
                DockPosition = DockPosition.Right
            };

            try
            {
                state.MinimumWidth = 380;
            }
            catch
            {
                // Older hosts may ignore or reject MinimumWidth.
            }

            data.InitialState = state;
        }

        private static FrameworkElement CreateFallbackPane(Exception ex)
        {
            return new TextBlock
            {
                Text = "Plansync panel failed to load:\n\n" + ex.Message,
                Margin = new Thickness(16),
                TextWrapping = TextWrapping.Wrap
            };
        }
    }
}
