using System.Windows;
using System.Windows.Input;
using PlansyncRevitPlugin.Services;

namespace PlansyncRevitPlugin.UI
{
    public partial class NewFolderWindow : Window
    {
        public NewFolderWindow(string parentLabel)
        {
            InitializeComponent();
            WindowOwnerHelper.SetRevitAsOwner(this);
            ParentHint.Text = string.IsNullOrWhiteSpace(parentLabel)
                ? "Inside project root"
                : $"Inside: {parentLabel}";
            NameBox.Focus();
        }

        public string FolderName => NameBox.Text.Trim();

        private void Create_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(FolderName))
            {
                MessageBox.Show(this, "Enter a folder name.", "Plansync");
                return;
            }

            DialogResult = true;
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
