using System.ComponentModel;
using System.Windows;
using System.Windows.Input;
using System.Windows.Threading;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.UI
{
    public partial class ExportToPlansyncWindow : Window
    {
        private readonly Document? _document;
        private readonly DispatcherTimer _previewDebounce;
        private long? _pendingPreviewId;

        public ExportToPlansyncWindow(ExportToPlansyncViewModel viewModel, UIDocument? uiDocument = null)
        {
            InitializeComponent();
            DataContext = viewModel;
            ViewModel = viewModel;
            _document = uiDocument?.Document;
            WindowOwnerHelper.SetRevitAsOwner(this);

            LogoImage.Source = IconLoader.Load("icon-180.png")
                ?? IconLoader.Load("logo_mark_48.png");

            PreviewPanel.Bind(uiDocument);

            _previewDebounce = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(300)
            };
            _previewDebounce.Tick += (_, _) =>
            {
                _previewDebounce.Stop();
                LoadThumbnail(_pendingPreviewId);
            };

            viewModel.Pdf.PropertyChanged += OnPdfPropertyChanged;
            Loaded += (_, _) => RefreshPreview(viewModel.Pdf.FocusedDrawing);
            Closed += (_, _) => viewModel.Pdf.PropertyChanged -= OnPdfPropertyChanged;
        }

        public ExportToPlansyncViewModel ViewModel { get; }

        private void OnPdfPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(PdfExportViewModel.FocusedDrawing))
            {
                RefreshPreview(ViewModel.Pdf.FocusedDrawing);
            }
            else if (e.PropertyName == nameof(PdfExportViewModel.NamingTemplate)
                     || e.PropertyName == nameof(ViewItemViewModel.ExportFileName))
            {
                PreviewPanel.ShowDrawing(ViewModel.Pdf.FocusedDrawing);
            }
        }

        private void RefreshPreview(ViewItemViewModel? drawing)
        {
            PreviewPanel.ShowDrawing(drawing);
            _pendingPreviewId = drawing?.Id;
            if (drawing is null || _document is null)
            {
                PreviewPanel.SetThumbnail(null);
                return;
            }

            PreviewPanel.SetLoading(true);
            _previewDebounce.Stop();
            _previewDebounce.Start();
        }

        private void LoadThumbnail(long? viewId)
        {
            if (viewId is null || _document is null)
            {
                PreviewPanel.SetThumbnail(null);
                return;
            }

            // Only apply if focus hasn't moved on.
            if (ViewModel.Pdf.FocusedDrawing?.Id != viewId)
            {
                return;
            }

            var image = DrawingPreviewService.TryExportThumbnail(_document, viewId.Value);
            if (ViewModel.Pdf.FocusedDrawing?.Id == viewId)
            {
                PreviewPanel.SetThumbnail(image);
            }
        }

        private void DrawingsList_MouseDoubleClick(object sender, MouseButtonEventArgs e)
        {
            PreviewPanel.PromptOpenInRevit();
        }

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
