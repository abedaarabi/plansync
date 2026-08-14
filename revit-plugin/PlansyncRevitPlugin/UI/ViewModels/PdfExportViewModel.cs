using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class PdfExportViewModel : ObservableObject
    {
        private bool _combine = true;
        private string _searchText = string.Empty;
        private bool _showSheets = true;
        private bool _showViews = true;
        private string _selectedCountText = "0 selected";
        private string _namingTemplate = "{SheetNumber}_{SheetName}";
        private bool _changedSheetsOnly;
        private ViewItemViewModel? _previewDrawing;
        private string _suggestedOutputName = string.Empty;
        private readonly string _documentTitle;

        public PdfExportViewModel(
            IEnumerable<ViewItemViewModel> drawings,
            PdfExportSettings? persisted,
            long? activeViewId,
            string documentTitle = "export")
        {
            _documentTitle = documentTitle;
            Drawings = new ObservableCollection<ViewItemViewModel>(drawings);
            DrawingsView = CollectionViewSource.GetDefaultView(Drawings);
            DrawingsView.Filter = FilterDrawing;

            foreach (ViewItemViewModel drawing in Drawings)
            {
                drawing.PropertyChanged += OnDrawingPropertyChanged;
            }

            SelectAllVisibleCommand = new RelayCommand(SelectAllVisible);
            SelectAllSheetsCommand = new RelayCommand(SelectAllSheets);
            ClearCommand = new RelayCommand(ClearAll);
            ExportCommand = new RelayCommand(() => { }, CanExport);

            ApplyPersisted(persisted, activeViewId);
            RefreshSelectedCount();
            RefreshExportNames();
            PreviewDrawing ??= Drawings.FirstOrDefault(d => d.IsSelected) ?? Drawings.FirstOrDefault();
            NotifyExportState();
        }

        public string DocumentTitle => _documentTitle;

        public ViewItemViewModel? PreviewDrawing
        {
            get => _previewDrawing;
            set => SetProperty(ref _previewDrawing, value);
        }

        public string SuggestedOutputName
        {
            get => _suggestedOutputName;
            private set => SetProperty(ref _suggestedOutputName, value);
        }

        public ObservableCollection<ViewItemViewModel> Drawings { get; }
        public ICollectionView DrawingsView { get; }

        public RelayCommand SelectAllVisibleCommand { get; }
        public RelayCommand SelectAllSheetsCommand { get; }
        public RelayCommand ClearCommand { get; }
        public RelayCommand ExportCommand { get; }

        public bool DialogConfirmed { get; private set; }

        public bool Combine
        {
            get => _combine;
            set
            {
                if (SetProperty(ref _combine, value))
                {
                    OnPropertyChanged(nameof(OneFilePerSheet));
                    RefreshExportNames();
                }
            }
        }

        public bool OneFilePerSheet
        {
            get => !_combine;
            set => Combine = !value;
        }

        public string NamingTemplate
        {
            get => _namingTemplate;
            set
            {
                if (SetProperty(ref _namingTemplate, value))
                {
                    RefreshExportNames();
                }
            }
        }

        public bool ChangedSheetsOnly
        {
            get => _changedSheetsOnly;
            set => SetProperty(ref _changedSheetsOnly, value);
        }

        public string SearchText
        {
            get => _searchText;
            set
            {
                SetProperty(ref _searchText, value);
                DrawingsView.Refresh();
            }
        }

        public bool ShowSheets
        {
            get => _showSheets;
            set
            {
                SetProperty(ref _showSheets, value);
                DrawingsView.Refresh();
            }
        }

        public bool ShowViews
        {
            get => _showViews;
            set
            {
                SetProperty(ref _showViews, value);
                DrawingsView.Refresh();
            }
        }

        public string SelectedCountText
        {
            get => _selectedCountText;
            private set => SetProperty(ref _selectedCountText, value);
        }

        public void ConfirmExport()
        {
            if (!CanExport())
            {
                return;
            }

            DialogConfirmed = true;
        }

        public PdfExportSettings ToSettings()
        {
            return new PdfExportSettings
            {
                Combine = Combine,
                NamingTemplate = string.IsNullOrWhiteSpace(NamingTemplate)
                    ? "{SheetNumber}_{SheetName}"
                    : NamingTemplate,
                SelectedViewIds = Drawings.Where(d => d.IsSelected).Select(d => d.Id).ToList()
            };
        }

        public void ApplyChangedSheetsFilter(IEnumerable<long> previouslyPublishedIds)
        {
            var previous = new HashSet<long>(previouslyPublishedIds);
            bool hasHistory = previous.Count > 0;

            if (!ChangedSheetsOnly || !hasHistory)
            {
                return;
            }

            foreach (ViewItemViewModel drawing in Drawings)
            {
                if (previous.Contains(drawing.Id))
                {
                    drawing.IsSelected = false;
                }
            }

            RefreshSelectedCount();
            NotifyExportState();
        }

        private void ApplyPersisted(PdfExportSettings? persisted, long? activeViewId)
        {
            if (persisted is not null)
            {
                Combine = persisted.Combine;
                NamingTemplate = persisted.NamingTemplate;
                var selected = new HashSet<long>(persisted.SelectedViewIds);
                foreach (ViewItemViewModel drawing in Drawings)
                {
                    drawing.IsSelected = selected.Contains(drawing.Id);
                }
            }

            if (!Drawings.Any(d => d.IsSelected) && activeViewId.HasValue)
            {
                ViewItemViewModel? active = Drawings.FirstOrDefault(d => d.Id == activeViewId.Value);
                if (active is not null)
                {
                    active.IsSelected = true;
                }
            }
        }

        private bool FilterDrawing(object obj)
        {
            if (obj is not ViewItemViewModel item)
            {
                return false;
            }

            bool categoryOk = item.Category.Equals("Sheet", StringComparison.OrdinalIgnoreCase)
                ? ShowSheets
                : ShowViews;

            if (!categoryOk)
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(SearchText))
            {
                return true;
            }

            return item.Name.Contains(SearchText, StringComparison.OrdinalIgnoreCase)
                   || item.Category.Contains(SearchText, StringComparison.OrdinalIgnoreCase)
                   || item.ViewTypeName.Contains(SearchText, StringComparison.OrdinalIgnoreCase);
        }

        private void SelectAllVisible()
        {
            foreach (ViewItemViewModel item in DrawingsView.Cast<ViewItemViewModel>())
            {
                item.IsSelected = true;
            }

            RefreshSelectedCount();
            NotifyExportState();
        }

        private void SelectAllSheets()
        {
            foreach (ViewItemViewModel item in Drawings.Where(d => d.Category == "Sheet"))
            {
                item.IsSelected = true;
            }

            RefreshSelectedCount();
            NotifyExportState();
        }

        private void ClearAll()
        {
            foreach (ViewItemViewModel item in Drawings)
            {
                item.IsSelected = false;
            }

            RefreshSelectedCount();
            NotifyExportState();
        }

        private void OnDrawingPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(ViewItemViewModel.IsSelected))
            {
                RefreshSelectedCount();
                RefreshExportNames();
                NotifyExportState();

                if (sender is ViewItemViewModel drawing && drawing.IsSelected)
                {
                    PreviewDrawing = drawing;
                }
            }
        }

        private void RefreshSelectedCount()
        {
            int count = Drawings.Count(d => d.IsSelected);
            SelectedCountText = $"{count} selected";
        }

        public void RefreshExportNames()
        {
            string template = string.IsNullOrWhiteSpace(NamingTemplate)
                ? "{SheetNumber}_{SheetName}"
                : NamingTemplate;

            foreach (ViewItemViewModel drawing in Drawings)
            {
                drawing.ExportFileName = FileNameSanitizer.GetDrawingExportName(
                    drawing,
                    template,
                    _documentTitle) + ".pdf";
            }

            var selected = Drawings.Where(d => d.IsSelected).ToList();
            SuggestedOutputName = Combine
                ? FileNameSanitizer.SuggestCombinedPdfFileName(_documentTitle, selected) + ".pdf"
                : selected.Count <= 1
                    ? (selected.FirstOrDefault()?.ExportFileName ?? "drawing.pdf")
                    : $"{selected.Count} files using template";
        }

        public IReadOnlyList<ViewItemViewModel> GetSelectedDrawings() =>
            Drawings.Where(d => d.IsSelected).ToList();

        private bool CanExport() => Drawings.Any(d => d.IsSelected);

        private void NotifyExportState()
        {
            ExportCommand.RaiseCanExecuteChanged();
        }
    }
}
