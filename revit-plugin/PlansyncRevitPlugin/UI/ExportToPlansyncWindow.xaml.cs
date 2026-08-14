using System.Windows;
using System.Windows.Input;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.UI
{
    public partial class ExportToPlansyncWindow : Window
    {
        public ExportToPlansyncWindow(ExportToPlansyncViewModel viewModel)
        {
            InitializeComponent();
            DataContext = viewModel;
            ViewModel = viewModel;
            WindowOwnerHelper.SetRevitAsOwner(this);
        }

        public ExportToPlansyncViewModel ViewModel { get; }

        private void Export_Click(object sender, RoutedEventArgs e)
        {
            ViewModel.ConfirmCommand.Execute(null);
            if (ViewModel.DialogConfirmed)
            {
                DialogResult = true;
            }
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
