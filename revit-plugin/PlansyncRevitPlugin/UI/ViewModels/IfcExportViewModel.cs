using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    /// <summary>Display item for the IFC schema/version picker ComboBox.</summary>
    public sealed class IfcVersionOption
    {
        public required IfcExportVersion Value { get; init; }
        public required string Label { get; init; }
        public string? SubLabel { get; init; }
    }

    public sealed class IfcExportViewModel : ObservableObject
    {
        public IReadOnlyList<IfcVersionOption> VersionOptions { get; } = new List<IfcVersionOption>
        {
            new() { Value = IfcExportVersion.Ifc4, Label = "IFC4", SubLabel = "Default — broadest tool support" },
            new() { Value = IfcExportVersion.Ifc4ReferenceView, Label = "IFC4 Reference View", SubLabel = "buildingSMART-certified coordination subset" },
            new() { Value = IfcExportVersion.Ifc2x3CoordinationView2, Label = "IFC2x3 Coordination View 2.0", SubLabel = "Legacy — required by some portals / older tools" },
            new() { Value = IfcExportVersion.Ifc4x3, Label = "IFC4x3", SubLabel = "Latest schema — newer tool support only" },
            new() { Value = IfcExportVersion.Ifc4x3ReferenceView, Label = "IFC4x3 Reference View", SubLabel = "Latest schema, certified coordination subset" }
        };

        private IfcVersionOption _selectedVersionOption;
        private bool _filterByView;
        private ViewItemViewModel? _selectedView;
        private bool _exportIfcCommonPropertySets = true;
        private bool _exportBaseQuantities = true;
        private bool _exportRoomsInView = true;
        private bool _export2DElements = true;
        private bool _includeAllLevelsAsBuildingStories = true;
        private bool _selectedParametersOnly;
        private string _searchText = string.Empty;
        private bool _showShared = true;
        private bool _showProject = true;
        private bool _showBuiltIn = true;
        private string _selectedCountText = "0 selected";
        private string _suggestedFileName = string.Empty;
        private readonly string _documentTitle;

        public IfcExportViewModel(
            IEnumerable<ViewItemViewModel> views,
            IEnumerable<ParameterItemViewModel> parameters,
            IfcExportSettings? persisted,
            long? activeViewId,
            string documentTitle = "export")
        {
            _documentTitle = documentTitle;
            _selectedVersionOption = VersionOptions[0];
            Views = new ObservableCollection<ViewItemViewModel>(views);
            Parameters = new ObservableCollection<ParameterItemViewModel>(parameters);
            ParametersView = CollectionViewSource.GetDefaultView(Parameters);
            ParametersView.Filter = FilterParameter;

            foreach (ParameterItemViewModel parameter in Parameters)
            {
                parameter.PropertyChanged += OnParameterPropertyChanged;
            }

            SelectAllVisibleCommand = new RelayCommand(SelectAllVisible, () => SelectedParametersOnly);
            ClearVisibleCommand = new RelayCommand(ClearVisible, () => SelectedParametersOnly);
            ExportCommand = new RelayCommand(() => { }, CanExport);

            ApplyPersisted(persisted, activeViewId);
            RefreshSelectedCount();
            RefreshSuggestedFileName();
            NotifyExportState();
        }

        public string SuggestedFileName
        {
            get => _suggestedFileName;
            private set => SetProperty(ref _suggestedFileName, value);
        }

        public IfcVersionOption SelectedVersionOption
        {
            get => _selectedVersionOption;
            set => SetProperty(ref _selectedVersionOption, value);
        }

        public ObservableCollection<ViewItemViewModel> Views { get; }
        public ObservableCollection<ParameterItemViewModel> Parameters { get; }
        public ICollectionView ParametersView { get; }

        public RelayCommand SelectAllVisibleCommand { get; }
        public RelayCommand ClearVisibleCommand { get; }
        public RelayCommand ExportCommand { get; }

        public bool DialogConfirmed { get; private set; }

        public bool WholeModel
        {
            get => !_filterByView;
            set
            {
                if (value)
                {
                    FilterByView = false;
                }
            }
        }

        public bool FilterByView
        {
            get => _filterByView;
            set
            {
                SetProperty(ref _filterByView, value);
                OnPropertyChanged(nameof(WholeModel));
                OnPropertyChanged(nameof(IsViewListEnabled));
                RefreshSuggestedFileName();
                NotifyExportState();
            }
        }

        public bool IsViewListEnabled => FilterByView;

        public ViewItemViewModel? SelectedView
        {
            get => _selectedView;
            set
            {
                SetProperty(ref _selectedView, value);
                RefreshSuggestedFileName();
                NotifyExportState();
            }
        }

        public bool ExportIfcCommonPropertySets
        {
            get => _exportIfcCommonPropertySets;
            set => SetProperty(ref _exportIfcCommonPropertySets, value);
        }

        public bool ExportBaseQuantities
        {
            get => _exportBaseQuantities;
            set => SetProperty(ref _exportBaseQuantities, value);
        }

        public bool ExportRoomsInView
        {
            get => _exportRoomsInView;
            set => SetProperty(ref _exportRoomsInView, value);
        }

        public bool Export2DElements
        {
            get => _export2DElements;
            set => SetProperty(ref _export2DElements, value);
        }

        /// <summary>When true, every Level is exported as an IfcBuildingStorey regardless of its
        /// "Building Story" checkbox in Revit, so reference/sill levels aren't silently missing
        /// from the IFC storey hierarchy.</summary>
        public bool IncludeAllLevelsAsBuildingStories
        {
            get => _includeAllLevelsAsBuildingStories;
            set => SetProperty(ref _includeAllLevelsAsBuildingStories, value);
        }

        public bool AllRevitPropertySets
        {
            get => !_selectedParametersOnly;
            set
            {
                if (value)
                {
                    SelectedParametersOnly = false;
                }
            }
        }

        public bool SelectedParametersOnly
        {
            get => _selectedParametersOnly;
            set
            {
                SetProperty(ref _selectedParametersOnly, value);
                OnPropertyChanged(nameof(AllRevitPropertySets));
                OnPropertyChanged(nameof(IsParameterListEnabled));
                SelectAllVisibleCommand.RaiseCanExecuteChanged();
                ClearVisibleCommand.RaiseCanExecuteChanged();
                NotifyExportState();
            }
        }

        public bool IsParameterListEnabled => SelectedParametersOnly;

        public string SearchText
        {
            get => _searchText;
            set
            {
                SetProperty(ref _searchText, value);
                ParametersView.Refresh();
            }
        }

        public bool ShowShared
        {
            get => _showShared;
            set
            {
                SetProperty(ref _showShared, value);
                ParametersView.Refresh();
            }
        }

        public bool ShowProject
        {
            get => _showProject;
            set
            {
                SetProperty(ref _showProject, value);
                ParametersView.Refresh();
            }
        }

        public bool ShowBuiltIn
        {
            get => _showBuiltIn;
            set
            {
                SetProperty(ref _showBuiltIn, value);
                ParametersView.Refresh();
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

        public IfcExportSettings ToSettings()
        {
            return new IfcExportSettings
            {
                Version = SelectedVersionOption.Value,
                FilterByView = FilterByView,
                FilterViewId = SelectedView?.Id,
                ExportIfcCommonPropertySets = ExportIfcCommonPropertySets,
                ExportBaseQuantities = ExportBaseQuantities,
                ExportRoomsInView = ExportRoomsInView,
                Export2DElements = Export2DElements,
                IncludeAllLevelsAsBuildingStories = IncludeAllLevelsAsBuildingStories,
                ParameterMode = SelectedParametersOnly
                    ? IfcParameterMode.SelectedParametersOnly
                    : IfcParameterMode.AllRevitPropertySets,
                SelectedParameterNames = Parameters
                    .Where(p => p.IsSelected)
                    .Select(p => p.Name)
                    .ToList()
            };
        }

        private void ApplyPersisted(IfcExportSettings? persisted, long? activeViewId)
        {
            if (persisted is not null)
            {
                SelectedVersionOption = VersionOptions.FirstOrDefault(o => o.Value == persisted.Version)
                                         ?? VersionOptions[0];
                FilterByView = persisted.FilterByView;
                ExportIfcCommonPropertySets = persisted.ExportIfcCommonPropertySets;
                ExportBaseQuantities = persisted.ExportBaseQuantities;
                ExportRoomsInView = persisted.ExportRoomsInView;
                Export2DElements = persisted.Export2DElements;
                IncludeAllLevelsAsBuildingStories = persisted.IncludeAllLevelsAsBuildingStories;
                SelectedParametersOnly = persisted.ParameterMode == IfcParameterMode.SelectedParametersOnly;

                var selected = new HashSet<string>(
                    persisted.SelectedParameterNames,
                    StringComparer.OrdinalIgnoreCase);

                foreach (ParameterItemViewModel parameter in Parameters)
                {
                    parameter.IsSelected = selected.Contains(parameter.Name);
                }

                if (persisted.FilterViewId is long viewId)
                {
                    SelectedView = Views.FirstOrDefault(v => v.Id == viewId);
                }
            }

            SelectedView ??= Views.FirstOrDefault(v => activeViewId.HasValue && v.Id == activeViewId.Value)
                             ?? Views.FirstOrDefault(v => string.Equals(v.ViewTypeName, "3D", StringComparison.OrdinalIgnoreCase))
                             ?? Views.FirstOrDefault();
        }

        private bool FilterParameter(object obj)
        {
            if (obj is not ParameterItemViewModel item)
            {
                return false;
            }

            bool kindOk = item.Kind switch
            {
                ParameterKind.Shared => ShowShared,
                ParameterKind.Project => ShowProject,
                ParameterKind.BuiltIn => ShowBuiltIn,
                _ => true
            };

            if (!kindOk)
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(SearchText))
            {
                return true;
            }

            return item.Name.Contains(SearchText, StringComparison.OrdinalIgnoreCase)
                   || item.Group.Contains(SearchText, StringComparison.OrdinalIgnoreCase)
                   || item.KindLabel.Contains(SearchText, StringComparison.OrdinalIgnoreCase);
        }

        private void SelectAllVisible()
        {
            foreach (ParameterItemViewModel item in ParametersView.Cast<ParameterItemViewModel>())
            {
                item.IsSelected = true;
            }

            RefreshSelectedCount();
            NotifyExportState();
        }

        private void ClearVisible()
        {
            foreach (ParameterItemViewModel item in ParametersView.Cast<ParameterItemViewModel>())
            {
                item.IsSelected = false;
            }

            RefreshSelectedCount();
            NotifyExportState();
        }

        private void OnParameterPropertyChanged(object? sender, PropertyChangedEventArgs e)
        {
            if (e.PropertyName == nameof(ParameterItemViewModel.IsSelected))
            {
                RefreshSelectedCount();
                NotifyExportState();
            }
        }

        private void RefreshSelectedCount()
        {
            int count = Parameters.Count(p => p.IsSelected);
            SelectedCountText = $"{count} selected";
        }

        public void RefreshSuggestedFileName()
        {
            SuggestedFileName = FileNameSanitizer.SuggestIfcFileName(
                _documentTitle,
                FilterByView,
                SelectedView?.Name) + ".ifc";
        }

        private bool CanExport()
        {
            if (FilterByView && SelectedView is null)
            {
                return false;
            }

            if (SelectedParametersOnly && !Parameters.Any(p => p.IsSelected))
            {
                return false;
            }

            return true;
        }

        private void NotifyExportState()
        {
            ExportCommand.RaiseCanExecuteChanged();
        }
    }
}
