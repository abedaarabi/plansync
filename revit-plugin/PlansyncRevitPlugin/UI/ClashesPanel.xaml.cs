using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.UI
{
    public partial class ClashesPanel : UserControl
    {
        public ClashesPaneViewModel ViewModel { get; } = new();

        public ClashesPanel()
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

        private void Resolve_PreviewMouseLeftButtonDown(object sender, MouseButtonEventArgs e)
        {
            if (sender is not Button button)
            {
                return;
            }

            ICommand? command = button.Command;
            object? parameter = button.CommandParameter;
            if (command?.CanExecute(parameter) == true)
            {
                command.Execute(parameter);
            }

            e.Handled = true;
        }
    }
}
