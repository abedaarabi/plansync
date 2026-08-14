using Autodesk.Revit.UI;

namespace PlansyncRevitPlugin.Services
{
    /// <summary>
    /// Captures the live <see cref="UIApplication"/> so dockable WPF panes can
    /// raise ExternalEvents against the active document.
    /// </summary>
    internal static class RevitUiHost
    {
        private static UIControlledApplication? _controlled;
        private static bool _idlingHooked;

        public static UIApplication? UiApp { get; private set; }

        public static void Attach(UIControlledApplication application)
        {
            _controlled = application;
            if (_idlingHooked)
            {
                return;
            }

            application.Idling += OnIdling;
            _idlingHooked = true;
        }

        public static void Detach()
        {
            if (_controlled is not null && _idlingHooked)
            {
                _controlled.Idling -= OnIdling;
            }

            _idlingHooked = false;
            _controlled = null;
            UiApp = null;
        }

        private static void OnIdling(object? sender, Autodesk.Revit.UI.Events.IdlingEventArgs e)
        {
            if (UiApp is not null)
            {
                return;
            }

            if (sender is UIApplication uiApp)
            {
                UiApp = uiApp;
            }
        }
    }
}
