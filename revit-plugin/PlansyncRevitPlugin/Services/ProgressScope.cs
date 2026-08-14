using PlansyncRevitPlugin.UI;

namespace PlansyncRevitPlugin.Services
{
    internal sealed class ProgressScope : IDisposable
    {
        private readonly ProgressWindow _window;
        private bool _closed;

        public ProgressScope(string title)
        {
            _window = new ProgressWindow();
            _window.Configure(title);
            _window.Report("Starting…");

            try
            {
                _window.ShowAndActivate();
            }
            catch
            {
                // Progress UI is optional — never abort the export because of it.
            }
        }

        public void Report(string status, string? detail = null, double? percent = null)
        {
            if (_closed)
            {
                return;
            }

            _window.Report(status, detail, percent);
        }

        public void Pump() => ProgressWindow.Pump();

        public void Dispose()
        {
            if (_closed)
            {
                return;
            }

            _closed = true;
            try
            {
                _window.Close();
            }
            catch
            {
                // Ignore close races during Revit shutdown.
            }
        }
    }
}
