using System.Windows;
using System.Windows.Controls;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.UI
{
    public partial class DrawingPreviewPanel : UserControl
    {
        private UIDocument? _uiDocument;
        private long? _viewId;

        public DrawingPreviewPanel()
        {
            InitializeComponent();
        }

        public void Bind(UIDocument? uiDocument)
        {
            _uiDocument = uiDocument;
        }

        public void ShowDrawing(ViewItemViewModel? drawing)
        {
            if (drawing is null)
            {
                _viewId = null;
                EmptyText.Visibility = System.Windows.Visibility.Visible;
                DetailsPanel.Visibility = System.Windows.Visibility.Collapsed;
                OpenInRevitButton.IsEnabled = false;
                return;
            }

            _viewId = drawing.Id;
            EmptyText.Visibility = System.Windows.Visibility.Collapsed;
            DetailsPanel.Visibility = System.Windows.Visibility.Visible;
            NameText.Text = drawing.Name;
            NumberText.Text = string.IsNullOrWhiteSpace(drawing.SheetNumber) ? "—" : drawing.SheetNumber;
            TypeText.Text = $"{drawing.Category} · {drawing.ViewTypeName}";
            ExportNameText.Text = string.IsNullOrWhiteSpace(drawing.ExportFileName)
                ? drawing.Name
                : drawing.ExportFileName;
            OpenInRevitButton.IsEnabled = _uiDocument is not null;
        }

        public void ShowView(ViewItemViewModel? view, string? exportFileName = null)
        {
            if (view is null)
            {
                ShowDrawing(null);
                return;
            }

            view.ExportFileName = exportFileName ?? view.ExportFileName;
            ShowDrawing(view);
            NumberText.Text = "3D / model view";
        }

        private void OpenInRevit_Click(object sender, RoutedEventArgs e)
        {
            if (_uiDocument?.Document is null || _viewId is null)
            {
                return;
            }

            // Changing ActiveView while a modal WPF dialog is open hard-crashes Revit.
            // Tell the user what to open instead of forcing a view switch here.
            try
            {
                Element? element = _uiDocument.Document.GetElement(new ElementId(_viewId.Value));
                if (element is not View view || view.IsTemplate)
                {
                    return;
                }

                TaskDialog.Show(
                    "Plansync",
                    $"Drawing ready to open:\n{view.Name}\n\nClose this dialog, then open that view/sheet in the Project Browser.");
            }
            catch
            {
                // Ignore if Revit rejects the lookup.
            }
        }
    }
}
