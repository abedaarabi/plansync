using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.UI.ViewModels;
using Vis = System.Windows.Visibility;

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
            OpenInRevitButton.IsEnabled = _uiDocument is not null && _viewId is not null;
        }

        public void ShowDrawing(ViewItemViewModel? drawing)
        {
            if (drawing is null)
            {
                _viewId = null;
                EmptyText.Visibility = Vis.Visible;
                EmptyText.Text = "Select a drawing to preview.";
                DetailsPanel.Visibility = Vis.Collapsed;
                PreviewImage.Visibility = Vis.Collapsed;
                PreviewImage.Source = null;
                LoadingText.Visibility = Vis.Collapsed;
                TypeBadge.Text = string.Empty;
                OpenInRevitButton.IsEnabled = false;
                return;
            }

            _viewId = drawing.Id;
            EmptyText.Visibility = Vis.Collapsed;
            DetailsPanel.Visibility = Vis.Visible;
            NameText.Text = drawing.Name;
            NumberText.Text = string.IsNullOrWhiteSpace(drawing.SheetNumber) ? "—" : drawing.SheetNumber;
            TypeText.Text = $"{drawing.Category} · {drawing.ViewTypeName}";
            TypeBadge.Text = drawing.Category;
            ExportNameText.Text = string.IsNullOrWhiteSpace(drawing.ExportFileName)
                ? drawing.Name
                : drawing.ExportFileName;
            OpenInRevitButton.IsEnabled = _uiDocument is not null;
        }

        public void SetLoading(bool loading)
        {
            LoadingText.Visibility = loading ? Vis.Visible : Vis.Collapsed;
            if (loading)
            {
                PreviewImage.Visibility = Vis.Collapsed;
                EmptyText.Visibility = Vis.Collapsed;
            }
        }

        public void SetThumbnail(BitmapImage? image)
        {
            LoadingText.Visibility = Vis.Collapsed;
            if (image is null)
            {
                PreviewImage.Source = null;
                PreviewImage.Visibility = Vis.Collapsed;
                if (DetailsPanel.Visibility == Vis.Visible)
                {
                    EmptyText.Text = "Preview unavailable for this view.";
                    EmptyText.Visibility = Vis.Visible;
                }

                return;
            }

            EmptyText.Visibility = Vis.Collapsed;
            PreviewImage.Source = image;
            PreviewImage.Visibility = Vis.Visible;
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

        public void PromptOpenInRevit()
        {
            OpenInRevit_Click(this, new RoutedEventArgs());
        }

        private void OpenInRevit_Click(object sender, RoutedEventArgs e)
        {
            if (_uiDocument?.Document is null || _viewId is null)
            {
                return;
            }

            // Changing ActiveView while a modal WPF dialog is open hard-crashes Revit.
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
