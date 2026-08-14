using System.Windows;
using System.Windows.Threading;
using PlansyncRevitPlugin.Services;

namespace PlansyncRevitPlugin.UI
{
    public partial class ProgressWindow : Window
    {
        private bool _closed;

        public ProgressWindow()
        {
            InitializeComponent();
            WindowOwnerHelper.SetRevitAsOwner(this);
            Closed += (_, _) => _closed = true;
        }

        public void Configure(string title)
        {
            TitleText.Text = title;
            Title = title;
        }

        public void Report(string status, string? detail = null, double? percent = null)
        {
            if (_closed)
            {
                return;
            }

            void Apply()
            {
                if (_closed)
                {
                    return;
                }

                StatusText.Text = status;
                DetailText.Text = detail ?? string.Empty;

                if (percent is double value)
                {
                    double clamped = Math.Max(0, Math.Min(100, value));
                    Progress.IsIndeterminate = false;
                    Progress.Value = clamped;
                    PercentText.Text = $"{clamped:0}%";
                }
                else
                {
                    Progress.IsIndeterminate = true;
                    PercentText.Text = string.Empty;
                }

                // Paint without Dispatcher.PushFrame — nested pumps crash Revit during API calls.
                InvalidateVisual();
                UpdateLayout();
            }

            try
            {
                if (Dispatcher.CheckAccess())
                {
                    Apply();
                }
                else
                {
                    Dispatcher.Invoke(Apply, DispatcherPriority.Render);
                }
            }
            catch
            {
                // Window may already be closing while upload callbacks still fire.
            }
        }

        public void ShowAndActivate()
        {
            Show();
            try
            {
                Activate();
            }
            catch
            {
                // Owned modeless windows sometimes reject Activate under Revit.
            }

            UpdateLayout();
        }

        public static void Pump()
        {
            // Intentionally empty: PushFrame/DoEvents reentrancy freezes or kills Revit.
        }
    }
}
