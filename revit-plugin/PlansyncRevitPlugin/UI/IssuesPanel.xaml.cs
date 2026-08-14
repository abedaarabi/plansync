using System.Windows;
using System.Windows.Controls;
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
    }
}
