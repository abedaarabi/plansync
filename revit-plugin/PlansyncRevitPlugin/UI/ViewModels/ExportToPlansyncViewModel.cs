using System.Collections.ObjectModel;
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
        private readonly Func<string?>? _chooseDestination;

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
            LoadProfileCommand = new RelayCommand(LoadSelectedProfile, () => !string.IsNullOrWhiteSpace(SelectedProfileName));

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

            SelectedProfileName = persisted.ActiveProfileName
                                   ?? Profiles.FirstOrDefault()
                                   ?? "Default";
            ProfileName = SelectedProfileName;

            // Bubble nested view models' export-state changes up so the combined dialog's
            // disabled-Export hint stays in sync with per-tab selections (sheets, view filter…).
            Ifc.ExportCommand.CanExecuteChanged += (_, _) => NotifyExportState();
            Pdf.ExportCommand.CanExecuteChanged += (_, _) => NotifyExportState();

            NotifyExportState();
        }

        public IfcExportViewModel Ifc { get; }
        public PdfExportViewModel Pdf { get; }
        public ObservableCollection<string> Profiles { get; }

        public RelayCommand ConfirmCommand { get; }
        public RelayCommand SaveProfileCommand { get; }
        public RelayCommand LoadProfileCommand { get; }
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
                }
            }
        }

        public bool ShowChooseDestination => IsCloudDestination && _chooseDestination is not null;

        public string ExportButtonLabel => IsCloudDestination ? "Export to Plansync" : "Export";

        public string DestinationLabel => IsCloudDestination
            ? (string.IsNullOrWhiteSpace(_cloudDestinationLabel) ? "No destination selected — choose one" : _cloudDestinationLabel)
            : "Save to your computer (no upload)";

        public bool IncludeIfc
        {
            get => _includeIfc;
            set
            {
                if (SetProperty(ref _includeIfc, value))
                {
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

                    LoadProfileCommand?.RaiseCanExecuteChanged();
                }
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
            }
        }

        public void ApplyChangedSheetsFilter(string historyKey)
        {
            // Always compute per-row "changed since last publish" badges; the PDF view model
            // itself only auto-deselects previously-published sheets when ChangedSheetsOnly is on.
            Pdf.ApplyChangedSheetsFilter(PublishHistoryStore.GetLastPdfViewIds(historyKey));
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
        }

        private void SaveProfile()
        {
            PersistedExportSettings settings = ExportSettingsStore.Load();
            settings.Profiles.RemoveAll(p =>
                string.Equals(p.Name, ProfileName, StringComparison.OrdinalIgnoreCase));

            settings.Profiles.Add(new PublishProfile
            {
                Name = ProfileName.Trim(),
                IncludeIfc = IncludeIfc,
                IncludePdf = IncludePdf,
                Ifc = Ifc.ToSettings(),
                Pdf = Pdf.ToSettings(),
                Options = ToOptions()
            });

            settings.ActiveProfileName = ProfileName.Trim();
            ExportSettingsStore.Save(settings);

            if (!Profiles.Contains(ProfileName.Trim()))
            {
                Profiles.Add(ProfileName.Trim());
            }

            SelectedProfileName = ProfileName.Trim();
        }

        private void LoadSelectedProfile()
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

            // Rebuild nested VMs would be heavy; apply via re-creating settings on Confirm.
            // Soft-apply common PDF options:
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
        }
    }
}
