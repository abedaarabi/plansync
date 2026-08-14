using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;
using PlansyncRevitPlugin.Services.IssueReview;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class IssueRowViewModel : ObservableObject
    {
        private IssueInfo _issue;

        public IssueRowViewModel(IssueInfo issue)
        {
            _issue = issue;
        }

        public IssueInfo Issue
        {
            get => _issue;
            set
            {
                if (!SetProperty(ref _issue, value))
                {
                    return;
                }

                OnPropertyChanged(nameof(Title));
                OnPropertyChanged(nameof(Status));
                OnPropertyChanged(nameof(Priority));
                OnPropertyChanged(nameof(StatusLabel));
                OnPropertyChanged(nameof(PriorityLabel));
                OnPropertyChanged(nameof(AssigneeLabel));
                OnPropertyChanged(nameof(HasBim));
                OnPropertyChanged(nameof(MetaLine));
                OnPropertyChanged(nameof(Description));
                OnPropertyChanged(nameof(Item1Name));
                OnPropertyChanged(nameof(Item2Name));
                OnPropertyChanged(nameof(HasItem2));
            }
        }

        public string Id => _issue.Id;
        public string Title => _issue.Title;
        public string Status => _issue.Status;
        public string Priority => _issue.Priority ?? "MEDIUM";
        public string? Description => _issue.Description;

        public string StatusLabel => FormatStatus(_issue.Status);
        public string PriorityLabel => FormatPriority(_issue.Priority);
        public string AssigneeLabel =>
            _issue.Assignee?.Name
            ?? _issue.Assignee?.Email
            ?? "Unassigned";

        public bool HasBim => _issue.BimAnchor?.HasModelLink == true;
        public bool HasItem2 => !string.IsNullOrWhiteSpace(_issue.BimAnchor?.IfcGuidB);

        public string Item1Name =>
            _issue.BimAnchor?.Name
            ?? _issue.BimAnchor?.IfcType
            ?? _issue.BimAnchor?.IfcGuid
            ?? "Item 1";

        public string Item2Name =>
            _issue.BimAnchor?.NameB
            ?? _issue.BimAnchor?.IfcTypeB
            ?? _issue.BimAnchor?.IfcGuidB
            ?? "Item 2";

        public string MetaLine
        {
            get
            {
                var parts = new List<string> { StatusLabel, PriorityLabel, AssigneeLabel };
                if (!string.IsNullOrWhiteSpace(_issue.Location))
                {
                    parts.Add(_issue.Location!);
                }

                return string.Join(" · ", parts);
            }
        }

        public void Apply(IssueInfo updated) => Issue = updated;

        private static string FormatStatus(string status) => status switch
        {
            "OPEN" => "Open",
            "IN_PROGRESS" => "In progress",
            "RESOLVED" => "Resolved",
            "CLOSED" => "Closed",
            _ => status
        };

        private static string FormatPriority(string? priority) => priority switch
        {
            "LOW" => "Low",
            "HIGH" => "High",
            "MEDIUM" => "Medium",
            _ => "Medium"
        };
    }

    public sealed class IssuesPaneViewModel : ObservableObject
    {
        private readonly PlansyncApiClient _api = new();
        private CancellationTokenSource? _loadCts;
        private string _search = string.Empty;
        private string _filterMode = "Open";
        private IssueRowViewModel? _selected;
        private bool _isBusy;
        private string _statusMessage = string.Empty;
        private string _errorMessage = string.Empty;
        private string _editStatus = "OPEN";
        private string _editPriority = "MEDIUM";
        private string _editDescription = string.Empty;

        public IssuesPaneViewModel()
        {
            Issues = new ObservableCollection<IssueRowViewModel>();
            RefreshCommand = new RelayCommand(() => _ = RefreshAsync(), () => !IsBusy);
            OpenIn3dCommand = new RelayCommand(OpenIn3d, () => Selected?.HasBim == true && !IsBusy);
            ResetViewCommand = new RelayCommand(ResetView, () => !IsBusy);
            SaveCommand = new RelayCommand(() => _ = SaveAsync(), () => Selected is not null && !IsBusy);
            MarkResolvedCommand = new RelayCommand(
                () => _ = QuickStatusAsync("RESOLVED"),
                () => Selected is not null && !IsBusy);
            OpenInWebCommand = new RelayCommand(OpenInWeb, () => Selected is not null);
            FilterOpenCommand = new RelayCommand(() => SetFilter("Open"));
            FilterBimCommand = new RelayCommand(() => SetFilter("Bim"));
            FilterAllCommand = new RelayCommand(() => SetFilter("All"));
        }

        public ObservableCollection<IssueRowViewModel> Issues { get; }

        public ICommand RefreshCommand { get; }
        public ICommand OpenIn3dCommand { get; }
        public ICommand ResetViewCommand { get; }
        public ICommand SaveCommand { get; }
        public ICommand MarkResolvedCommand { get; }
        public ICommand OpenInWebCommand { get; }
        public ICommand FilterOpenCommand { get; }
        public ICommand FilterBimCommand { get; }
        public ICommand FilterAllCommand { get; }

        public string Search
        {
            get => _search;
            set
            {
                if (SetProperty(ref _search, value ?? string.Empty))
                {
                    OnPropertyChanged(nameof(FilteredIssues));
                }
            }
        }

        public string FilterMode
        {
            get => _filterMode;
            private set
            {
                if (SetProperty(ref _filterMode, value))
                {
                    OnPropertyChanged(nameof(FilteredIssues));
                    OnPropertyChanged(nameof(IsFilterOpen));
                    OnPropertyChanged(nameof(IsFilterBim));
                    OnPropertyChanged(nameof(IsFilterAll));
                    OnPropertyChanged(nameof(OpenCountLabel));
                }
            }
        }

        public bool IsFilterOpen => FilterMode == "Open";
        public bool IsFilterBim => FilterMode == "Bim";
        public bool IsFilterAll => FilterMode == "All";

        public IEnumerable<IssueRowViewModel> FilteredIssues
        {
            get
            {
                IEnumerable<IssueRowViewModel> q = Issues;
                q = FilterMode switch
                {
                    "Open" => q.Where(i => i.Issue.IsOpen),
                    "Bim" => q.Where(i => i.HasBim),
                    _ => q
                };

                string term = Search.Trim();
                if (term.Length > 0)
                {
                    q = q.Where(i =>
                        i.Title.Contains(term, StringComparison.OrdinalIgnoreCase)
                        || (i.Description?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false)
                        || i.AssigneeLabel.Contains(term, StringComparison.OrdinalIgnoreCase));
                }

                return q.ToList();
            }
        }

        public IssueRowViewModel? Selected
        {
            get => _selected;
            set
            {
                if (!SetProperty(ref _selected, value))
                {
                    return;
                }

                LoadEditorFromSelection();
                RaiseCommands();
                OnPropertyChanged(nameof(HasSelection));
                OnPropertyChanged(nameof(DetailTitle));
            }
        }

        public bool HasSelection => Selected is not null;
        public string DetailTitle => Selected?.Title ?? "Select an issue";

        public string EditStatus
        {
            get => _editStatus;
            set => SetProperty(ref _editStatus, value);
        }

        public string EditPriority
        {
            get => _editPriority;
            set => SetProperty(ref _editPriority, value);
        }

        public string EditDescription
        {
            get => _editDescription;
            set => SetProperty(ref _editDescription, value ?? string.Empty);
        }

        public IReadOnlyList<string> StatusOptions { get; } =
            new[] { "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED" };

        public IReadOnlyList<string> PriorityOptions { get; } =
            new[] { "LOW", "MEDIUM", "HIGH" };

        public bool IsBusy
        {
            get => _isBusy;
            private set
            {
                if (SetProperty(ref _isBusy, value))
                {
                    RaiseCommands();
                }
            }
        }

        public string StatusMessage
        {
            get => _statusMessage;
            private set => SetProperty(ref _statusMessage, value);
        }

        public string ErrorMessage
        {
            get => _errorMessage;
            private set
            {
                if (SetProperty(ref _errorMessage, value))
                {
                    OnPropertyChanged(nameof(HasError));
                }
            }
        }

        public bool HasError => !string.IsNullOrWhiteSpace(ErrorMessage);

        public string OpenCountLabel
        {
            get
            {
                int open = Issues.Count(i => i.Issue.IsOpen);
                return open == 0 ? "No open issues" : $"{open} open";
            }
        }

        public async Task RefreshAsync()
        {
            ErrorMessage = string.Empty;
            if (!IsSignedIn())
            {
                Issues.Clear();
                OnPropertyChanged(nameof(FilteredIssues));
                OnPropertyChanged(nameof(OpenCountLabel));
                StatusMessage = "Sign in to load issues.";
                return;
            }

            if (string.IsNullOrWhiteSpace(PlansyncSessionState.ProjectId))
            {
                Issues.Clear();
                OnPropertyChanged(nameof(FilteredIssues));
                OnPropertyChanged(nameof(OpenCountLabel));
                StatusMessage = "Set a Plansync destination project first.";
                return;
            }

            _loadCts?.Cancel();
            _loadCts = new CancellationTokenSource();
            CancellationToken token = _loadCts.Token;
            IsBusy = true;
            StatusMessage = "Loading issues…";
            try
            {
                List<IssueInfo> rows = await _api
                    .GetProjectIssuesAsync(PlansyncSessionState.ProjectId!, token)
                    .ConfigureAwait(true);

                string? keepId = Selected?.Id;
                Issues.Clear();
                foreach (IssueInfo row in rows.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt))
                {
                    Issues.Add(new IssueRowViewModel(row));
                }

                Selected = keepId is null
                    ? Issues.FirstOrDefault()
                    : Issues.FirstOrDefault(i => i.Id == keepId) ?? Issues.FirstOrDefault();

                OnPropertyChanged(nameof(FilteredIssues));
                OnPropertyChanged(nameof(OpenCountLabel));
                StatusMessage = $"{Issues.Count} issue(s) · {OpenCountLabel}";
            }
            catch (OperationCanceledException)
            {
                // superseded
            }
            catch (PlansyncAuthException ex)
            {
                ErrorMessage = ex.Message;
                StatusMessage = string.Empty;
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
                StatusMessage = string.Empty;
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task SaveAsync()
        {
            if (Selected is null)
            {
                return;
            }

            IsBusy = true;
            ErrorMessage = string.Empty;
            StatusMessage = "Saving…";
            try
            {
                var patch = new IssuePatchRequest
                {
                    Status = EditStatus,
                    Priority = EditPriority,
                    Description = EditDescription
                };
                IssueInfo updated = await _api.PatchIssueAsync(Selected.Id, patch).ConfigureAwait(true);
                Selected.Apply(updated);
                OnPropertyChanged(nameof(FilteredIssues));
                OnPropertyChanged(nameof(OpenCountLabel));
                StatusMessage = "Saved — synced to Plansync.";
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
                StatusMessage = string.Empty;
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task QuickStatusAsync(string status)
        {
            EditStatus = status;
            await SaveAsync().ConfigureAwait(true);
        }

        private void OpenIn3d()
        {
            if (Selected?.Issue.BimAnchor is not { } anchor || !anchor.HasModelLink)
            {
                ErrorMessage = "This issue has no BIM link.";
                return;
            }

            ErrorMessage = string.Empty;
            StatusMessage = "Opening in 3D…";
            IssueReviewService.OpenIssue(anchor, Selected.Title, (ok, message) =>
            {
                Application.Current?.Dispatcher.Invoke(() =>
                {
                    if (ok)
                    {
                        StatusMessage = message;
                        ErrorMessage = string.Empty;
                    }
                    else
                    {
                        ErrorMessage = message;
                        StatusMessage = string.Empty;
                    }
                });
            });
        }

        private void ResetView()
        {
            StatusMessage = "Resetting review view…";
            IssueReviewService.Reset((ok, message) =>
            {
                Application.Current?.Dispatcher.Invoke(() =>
                {
                    StatusMessage = message;
                    if (!ok)
                    {
                        ErrorMessage = message;
                    }
                });
            });
        }

        private void OpenInWeb()
        {
            if (Selected is null || PlansyncSessionState.ProjectId is null)
            {
                return;
            }

            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo(
                PlansyncConfig.IssueUrl(PlansyncSessionState.ProjectId, Selected.Id))
            {
                UseShellExecute = true
            });
        }

        private void SetFilter(string mode)
        {
            FilterMode = mode;
            RaiseCommands();
        }

        private void LoadEditorFromSelection()
        {
            if (Selected is null)
            {
                EditStatus = "OPEN";
                EditPriority = "MEDIUM";
                EditDescription = string.Empty;
                return;
            }

            EditStatus = Selected.Status;
            EditPriority = Selected.Priority;
            EditDescription = Selected.Description ?? string.Empty;
        }

        private void RaiseCommands()
        {
            (RefreshCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (OpenIn3dCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (ResetViewCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (SaveCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (MarkResolvedCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (OpenInWebCommand as RelayCommand)?.RaiseCanExecuteChanged();
        }

        private static bool IsSignedIn() =>
            !string.IsNullOrWhiteSpace(PlansyncSessionState.Me?.User?.Email);
    }
}
