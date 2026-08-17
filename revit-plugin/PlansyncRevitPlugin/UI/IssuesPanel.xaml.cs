using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.UI
{
    public partial class IssuesPanel : UserControl
    {
        public IssuesPaneViewModel ViewModel { get; } = new();

        public IssuesPanel()
        {
            InitializeComponent();
            DataContext = ViewModel;
            Loaded += OnLoaded;
        }

        private void OnLoaded(object sender, RoutedEventArgs e)
        {
            Loaded -= OnLoaded;
            _ = ViewModel.RefreshAsync();
        }

        public void NotifySessionChanged()
        {
            _ = ViewModel.RefreshAsync();
        }

        private void Panel_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key == Key.Escape && ViewModel.IsDetailOpen)
            {
                ViewModel.BackToListCommand.Execute(null);
                e.Handled = true;
            }
        }

        private void List_PreviewKeyDown(object sender, KeyEventArgs e)
        {
            if (e.Key != Key.Enter)
            {
                return;
            }

            if (IssuesList.SelectedItem is IssueRowViewModel row)
            {
                ViewModel.Selected = row;
                e.Handled = true;
            }
        }
    }
}
