using System.Collections.ObjectModel;
using System.Windows.Threading;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class ExportToPlansyncViewModel : ObservableObject
    {
        private bool _includeIfc = true;
        private bool _includePdf = true;
        private bool _warnOnParamQa = true;
        private bool _blockOnParamQa;
        private bool _changedSheetsOnly;
        private string _profileName = "Default";
        private string _selectedProfileName = "Default";
        private string _cloudDestinationLabel = string.Empty;
        private bool _isCloudDestination = true;
        private string _profileStatus = string.Empty;
        private string _activeTab = "IFC";
        private bool _profileLoadReady;
        private bool _suppressProfileLoad;
        private readonly Func<string?>? _chooseDestination;
        private DispatcherTimer? _statusClearTimer;

        public ExportToPlansyncViewModel(
            IfcExportViewModel ifc,
            PdfExportViewModel pdf,
            PersistedExportSettings persisted,
            string destinationLabel,
            bool isCloudDestination = true,
            Func<string?>? chooseDestination = null)
        {
            Ifc = ifc;
            Pdf = pdf;
            _cloudDestinationLabel = destinationLabel;
            _isCloudDestination = isCloudDestination;
            _chooseDestination = chooseDestination;
            ChooseDestinationCommand = new RelayCommand(ChooseDestination);

            Profiles = new ObservableCollection<string>(
                persisted.Profiles.Select(p => p.Name).DefaultIfEmpty("Default"));

            ConfirmCommand = new RelayCommand(Confirm, CanConfirm);
            SaveProfileCommand = new RelayCommand(SaveProfile, () => !string.IsNullOrWhiteSpace(ProfileName));

            PublishOptions options = persisted.Options;
            IncludeIfc = options.IncludeIfc;
            IncludePdf = options.IncludePdf;
            WarnOnParamQa = options.WarnOnParamQa;
            BlockOnParamQa = options.BlockOnParamQa;
            ChangedSheetsOnly = options.ChangedSheetsOnly;
            Pdf.NamingTemplate = string.IsNullOrWhiteSpace(options.PdfNamingTemplate)
                ? Pdf.NamingTemplate
                : options.PdfNamingTemplate;
            Pdf.ChangedSheetsOnly = options.ChangedSheetsOnly;

            _suppressProfileLoad = true;
            SelectedProfileName = persisted.ActiveProfileName
                                   ?? Profiles.FirstOrDefault()
                                   ?? "Default";
            ProfileName = SelectedProfileName;
            _suppressProfileLoad = false;
            _profileLoadReady = true;

            Ifc.ExportCommand.CanExecuteChanged += (_, _) => NotifyExportState();
            Pdf.ExportCommand.CanExecuteChanged += (_, _) => NotifyExportState();
            Pdf.PropertyChanged += (_, e) =>
            {
                if (e.PropertyName is nameof(PdfExportViewModel.SelectedCountText)
                    or nameof(PdfExportViewModel.FocusedDrawing))
                {
                    OnPropertyChanged(nameof(ExportSummary));
                }
            };

            EnsureValidActiveTab();
            NotifyExportState();
        }

        public IfcExportViewModel Ifc { get; }
        public PdfExportViewModel Pdf { get; }
        public ObservableCollection<string> Profiles { get; }

        public RelayCommand ConfirmCommand { get; }
        public RelayCommand SaveProfileCommand { get; }
        public RelayCommand ChooseDestinationCommand { get; }

        public bool DialogConfirmed { get; private set; }

        /// <summary>True = upload to Plansync cloud, false = save files to the local computer.</summary>
        public bool IsCloudDestination
        {
            get => _isCloudDestination;
            set
            {
                if (SetProperty(ref _isCloudDestination, value))
                {
                    OnPropertyChanged(nameof(DestinationLabel));
                    OnPropertyChanged(nameof(ShowChooseDestination));
                    OnPropertyChanged(nameof(ExportButtonLabel));
                    OnPropertyChanged(nameof(ExportSummary));
                }
            }
        }

        public bool ShowChooseDestination => IsCloudDestination && _chooseDestination is not null;

        public string ExportButtonLabel => IsCloudDestination ? "Export to Plansync" : "Export";

        public string DestinationLabel => IsCloudDestination
            ? (string.IsNullOrWhiteSpace(_cloudDestinationLabel) ? "No destination selected — choose one" : _cloudDestinationLabel)
            : "Save to your computer (no upload)";

        public string ProfileStatus
        {
            get => _profileStatus;
            private set => SetProperty(ref _profileStatus, value);
        }

        public bool HasProfileStatus => !string.IsNullOrWhiteSpace(ProfileStatus);

        public string ActiveTab
        {
            get => _activeTab;
            set
            {
                string next = NormalizeTab(value);
                if (SetProperty(ref _activeTab, next))
                {
                    OnPropertyChanged(nameof(IsIfcTab));
                    OnPropertyChanged(nameof(IsPdfTab));
                    OnPropertyChanged(nameof(IsQaTab));
                }
            }
        }

        public bool IsIfcTab
        {
            get => ActiveTab == "IFC";
            set
            {
                if (value)
                {
                    ActiveTab = "IFC";
                }
                else
                {
                    OnPropertyChanged(nameof(IsIfcTab));
                }
            }
        }

        public bool IsPdfTab
        {
            get => ActiveTab == "PDF";
            set
            {
                if (value)
                {
                    ActiveTab = "PDF";
                }
                else
                {
                    OnPropertyChanged(nameof(IsPdfTab));
                }
            }
        }

        public bool IsQaTab
        {
            get => ActiveTab == "QA";
            set
            {
                if (value)
                {
                    ActiveTab = "QA";
                }
                else
                {
                    OnPropertyChanged(nameof(IsQaTab));
                }
            }
        }

        public bool IsFormatIfcOnly
        {
            get => IncludeIfc && !IncludePdf;
            set
            {
                if (value)
                {
                    IncludeIfc = true;
                    IncludePdf = false;
                    NotifyFormatProperties();
                    if (ActiveTab == "PDF")
                    {
                        ActiveTab = "IFC";
                    }
                }
                else
                {
                    OnPropertyChanged(nameof(IsFormatIfcOnly));
                }
            }
        }

        public bool IsFormatPdfOnly
        {
            get => IncludePdf && !IncludeIfc;
            set
            {
                if (value)
                {
                    IncludeIfc = false;
                    IncludePdf = true;
                    NotifyFormatProperties();
                    if (ActiveTab == "IFC")
                    {
                        ActiveTab = "PDF";
                    }
                }
                else
                {
                    OnPropertyChanged(nameof(IsFormatPdfOnly));
                }
            }
        }

        public bool IsFormatBoth
        {
            get => IncludeIfc && IncludePdf;
            set
            {
                if (value)
                {
                    IncludeIfc = true;
                    IncludePdf = true;
                    NotifyFormatProperties();
                }
                else
                {
                    OnPropertyChanged(nameof(IsFormatBoth));
                }
            }
        }

        public bool IncludeIfc
        {
            get => _includeIfc;
            set
            {
                if (SetProperty(ref _includeIfc, value))
                {
                    NotifyFormatProperties();
                    EnsureValidActiveTab();
                    NotifyExportState();
                }
            }
        }

        public bool IncludePdf
        {
            get => _includePdf;
            set
            {
                if (SetProperty(ref _includePdf, value))
                {
                    NotifyFormatProperties();
                    EnsureValidActiveTab();
                    NotifyExportState();
                }
            }
        }

        public bool WarnOnParamQa
        {
            get => _warnOnParamQa;
            set => SetProperty(ref _warnOnParamQa, value);
        }

        public bool BlockOnParamQa
        {
            get => _blockOnParamQa;
            set => SetProperty(ref _blockOnParamQa, value);
        }

        public bool ChangedSheetsOnly
        {
            get => _changedSheetsOnly;
            set
            {
                if (SetProperty(ref _changedSheetsOnly, value))
                {
                    Pdf.ChangedSheetsOnly = value;
                }
            }
        }

        public string ProfileName
        {
            get => _profileName;
            set
            {
                if (SetProperty(ref _profileName, value))
                {
                    SaveProfileCommand?.RaiseCanExecuteChanged();
                }
            }
        }

        public string SelectedProfileName
        {
            get => _selectedProfileName;
            set
            {
                if (SetProperty(ref _selectedProfileName, value))
                {
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        ProfileName = value;
                    }

                    if (_profileLoadReady && !_suppressProfileLoad && !string.IsNullOrWhiteSpace(value))
                    {
                        LoadSelectedProfile(showStatus: true);
                    }
                }
            }
        }

        public string ExportSummary
        {
            get
            {
                var parts = new List<string>();
                if (IncludeIfc && IncludePdf)
                {
                    parts.Add("IFC + PDF");
                }
                else if (IncludeIfc)
                {
                    parts.Add("IFC");
                }
                else if (IncludePdf)
                {
                    parts.Add("PDF");
                }
                else
                {
                    parts.Add("Nothing selected");
                }

                if (IncludePdf)
                {
                    int sheets = Pdf.Drawings.Count(d => d.IsSelected);
                    parts.Add(sheets == 1 ? "1 drawing" : $"{sheets} drawings");
                }

                parts.Add(IsCloudDestination ? "Cloud" : "Computer");

                string dest = DestinationLabel;
                if (dest.Length > 42)
                {
                    dest = dest[..39] + "…";
                }

                parts.Add(dest);
                return string.Join(" · ", parts);
            }
        }

        public PublishOptions ToOptions() => new()
        {
            IncludeIfc = IncludeIfc,
            IncludePdf = IncludePdf,
            WarnOnParamQa = WarnOnParamQa,
            BlockOnParamQa = BlockOnParamQa,
            ChangedSheetsOnly = ChangedSheetsOnly,
            PdfNamingTemplate = Pdf.NamingTemplate,
            PreferCloudDestination = IsCloudDestination
        };

        private void ChooseDestination()
        {
            string? label = _chooseDestination?.Invoke();
            if (label is not null)
            {
                _cloudDestinationLabel = label;
                OnPropertyChanged(nameof(DestinationLabel));
                OnPropertyChanged(nameof(ExportSummary));
            }
        }

        public void ApplyChangedSheetsFilter(string historyKey)
        {
            Pdf.ApplyChangedSheetsFilter(PublishHistoryStore.GetLastPdfViewIds(historyKey));
            OnPropertyChanged(nameof(ExportSummary));
        }

        public void Persist(PersistedExportSettings settings)
        {
            settings.Ifc = Ifc.ToSettings();
            settings.Pdf = Pdf.ToSettings();
            settings.Options = ToOptions();
            settings.ActiveProfileName = SelectedProfileName;
            ExportSettingsStore.Save(settings);
        }

        private void Confirm()
        {
            if (!CanConfirm())
            {
                return;
            }

            if (IncludeIfc && !IfcCanExport())
            {
                return;
            }

            if (IncludePdf && !Pdf.Drawings.Any(d => d.IsSelected))
            {
                return;
            }

            DialogConfirmed = true;
        }

        private bool CanConfirm()
        {
            if (!IncludeIfc && !IncludePdf)
            {
                return false;
            }

            if (IncludeIfc && !IfcCanExport())
            {
                return false;
            }

            if (IncludePdf && !Pdf.Drawings.Any(d => d.IsSelected))
            {
                return false;
            }

            return true;
        }

        private bool IfcCanExport()
        {
            if (!Ifc.FilterByView)
            {
                return true;
            }

            return Ifc.SelectedView is not null;
        }

        private void NotifyExportState()
        {
            ConfirmCommand?.RaiseCanExecuteChanged();
            OnPropertyChanged(nameof(ExportSummary));
        }

        private void NotifyFormatProperties()
        {
            OnPropertyChanged(nameof(IsFormatIfcOnly));
            OnPropertyChanged(nameof(IsFormatPdfOnly));
            OnPropertyChanged(nameof(IsFormatBoth));
            OnPropertyChanged(nameof(ExportSummary));
        }

        private void EnsureValidActiveTab()
        {
            if (ActiveTab == "IFC" && !IncludeIfc && IncludePdf)
            {
                ActiveTab = "PDF";
            }
            else if (ActiveTab == "PDF" && !IncludePdf && IncludeIfc)
            {
                ActiveTab = "IFC";
            }
            else if (ActiveTab is "IFC" or "PDF" && !IncludeIfc && !IncludePdf)
            {
                ActiveTab = "QA";
            }
        }

        private static string NormalizeTab(string? value) =>
            value?.Trim().ToUpperInvariant() switch
            {
                "PDF" => "PDF",
                "QA" => "QA",
                _ => "IFC"
            };

        private void SaveProfile()
        {
            string name = ProfileName.Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                return;
            }

            PersistedExportSettings settings = ExportSettingsStore.Load();
            settings.Profiles.RemoveAll(p =>
                string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase));

            settings.Profiles.Add(new PublishProfile
            {
                Name = name,
                IncludeIfc = IncludeIfc,
                IncludePdf = IncludePdf,
                Ifc = Ifc.ToSettings(),
                Pdf = Pdf.ToSettings(),
                Options = ToOptions()
            });

            settings.ActiveProfileName = name;
            ExportSettingsStore.Save(settings);

            if (!Profiles.Contains(name))
            {
                Profiles.Add(name);
            }

            _suppressProfileLoad = true;
            SelectedProfileName = name;
            ProfileName = name;
            _suppressProfileLoad = false;

            SetProfileStatus($"Saved “{name}”");
        }

        private void LoadSelectedProfile(bool showStatus)
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            PublishProfile? profile = settings.Profiles.FirstOrDefault(p =>
                string.Equals(p.Name, SelectedProfileName, StringComparison.OrdinalIgnoreCase));
            if (profile is null)
            {
                return;
            }

            IncludeIfc = profile.IncludeIfc;
            IncludePdf = profile.IncludePdf;
            WarnOnParamQa = profile.Options.WarnOnParamQa;
            BlockOnParamQa = profile.Options.BlockOnParamQa;
            ChangedSheetsOnly = profile.Options.ChangedSheetsOnly;
            ProfileName = profile.Name;

            Pdf.Combine = profile.Pdf.Combine;
            Pdf.NamingTemplate = profile.Pdf.NamingTemplate;
            Pdf.ChangedSheetsOnly = profile.Options.ChangedSheetsOnly;

            var selected = new HashSet<long>(profile.Pdf.SelectedViewIds);
            foreach (ViewItemViewModel drawing in Pdf.Drawings)
            {
                drawing.IsSelected = selected.Contains(drawing.Id);
            }

            Ifc.FilterByView = profile.Ifc.FilterByView;
            Ifc.ExportIfcCommonPropertySets = profile.Ifc.ExportIfcCommonPropertySets;
            Ifc.ExportBaseQuantities = profile.Ifc.ExportBaseQuantities;
            Ifc.ExportRoomsInView = profile.Ifc.ExportRoomsInView;
            Ifc.Export2DElements = profile.Ifc.Export2DElements;
            Ifc.SelectedParametersOnly = profile.Ifc.ParameterMode == IfcParameterMode.SelectedParametersOnly;
            Ifc.WholeModel = !profile.Ifc.FilterByView;
            Ifc.AllRevitPropertySets = profile.Ifc.ParameterMode == IfcParameterMode.AllRevitPropertySets;

            if (profile.Ifc.FilterViewId is long viewId)
            {
                Ifc.SelectedView = Ifc.Views.FirstOrDefault(v => v.Id == viewId) ?? Ifc.SelectedView;
            }

            var paramNames = new HashSet<string>(profile.Ifc.SelectedParameterNames, StringComparer.OrdinalIgnoreCase);
            foreach (ParameterItemViewModel parameter in Ifc.Parameters)
            {
                parameter.IsSelected = paramNames.Contains(parameter.Name);
            }

            NotifyExportState();
            EnsureValidActiveTab();

            if (showStatus)
            {
                SetProfileStatus($"Loaded “{profile.Name}”");
            }
        }

        private void SetProfileStatus(string message)
        {
            ProfileStatus = message;
            OnPropertyChanged(nameof(HasProfileStatus));

            _statusClearTimer?.Stop();
            _statusClearTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(3)
            };
            _statusClearTimer.Tick += (_, _) =>
            {
                _statusClearTimer.Stop();
                ProfileStatus = string.Empty;
                OnPropertyChanged(nameof(HasProfileStatus));
            };
            _statusClearTimer.Start();
        }
    }
}
