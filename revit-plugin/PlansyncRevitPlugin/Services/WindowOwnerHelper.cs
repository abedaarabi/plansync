using System.Diagnostics;
using System.Windows;
using System.Windows.Interop;

namespace PlansyncRevitPlugin.Services
{
    internal static class WindowOwnerHelper
    {
        public static void SetRevitAsOwner(Window window)
        {
            try
            {
                IntPtr handle = Process.GetCurrentProcess().MainWindowHandle;
                if (handle != IntPtr.Zero)
                {
                    _ = new WindowInteropHelper(window) { Owner = handle };
                }
            }
            catch
            {
                // Non-fatal: dialog still works without an owner.
            }

            window.WindowStartupLocation = WindowStartupLocation.CenterOwner;
        }
    }
}
