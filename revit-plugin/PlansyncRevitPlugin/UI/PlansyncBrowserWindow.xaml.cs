using System.Windows;
using System.Windows.Input;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.UI
{
    public partial class PlansyncBrowserWindow : Window
    {
        public PlansyncBrowserWindow(PlansyncBrowserViewModel viewModel)
        {
            InitializeComponent();
            DataContext = viewModel;
            ViewModel = viewModel;
            WindowOwnerHelper.SetRevitAsOwner(this);
            LogoImage.Source = IconLoader.Load("icon-180.png")
                ?? IconLoader.Load("logo_mark_48.png");
        }

        public PlansyncBrowserViewModel ViewModel { get; }

        /// <summary>null = just save destination; Ifc/Pdf = run that export after close.</summary>
        public string? RequestedExport { get; private set; }

        private void FolderTree_SelectedItemChanged(object sender, RoutedPropertyChangedEventArgs<object> e)
        {
            ViewModel.SelectedFolder = e.NewValue as FolderNodeViewModel;
        }

        private void UseFolder_Click(object sender, RoutedEventArgs e)
        {
            if (!ViewModel.CanExport)
            {
                return;
            }

            ViewModel.ApplySelectionToSession();
            RequestedExport = null;
            DialogResult = true;
        }

        private void Export_Click(object sender, RoutedEventArgs e)
        {
            if (!ViewModel.CanExport)
            {
                return;
            }

            ViewModel.ApplySelectionToSession();
            RequestedExport = "export";
            DialogResult = true;
        }

        private async void NewFolder_Click(object sender, RoutedEventArgs e)
        {
            if (!ViewModel.CanCreateFolder || ViewModel.SelectedFolder is null)
            {
                return;
            }

            var dialog = new NewFolderWindow(ViewModel.SelectedFolder.Name)
            {
                Owner = this
            };

            if (dialog.ShowDialog() != true)
            {
                return;
            }

            bool created = await ViewModel.CreateFolderAsync(dialog.FolderName).ConfigureAwait(true);
            if (!created)
            {
                System.Windows.MessageBox.Show(
                    this,
                    string.IsNullOrWhiteSpace(ViewModel.StatusText)
                        ? "Could not create folder."
                        : ViewModel.StatusText,
                    "Plansync");
            }
        }

        private async void SignOut_Click(object sender, RoutedEventArgs e)
        {
            await new PlansyncAuthClient().SignOutAsync().ConfigureAwait(true);
            PlansyncSessionState.ClearUser();
            PlansyncSessionState.ClearDestination();
            PublishStatusHub.Notify("Signed out.");
            DialogResult = false;
        }

        private void Cancel_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
        }

        private void Window_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape)
            {
                DialogResult = false;
                e.Handled = true;
            }
        }
    }
}
