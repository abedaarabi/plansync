using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using PlansyncRevitPlugin.Models;
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
                OnPropertyChanged(nameof(AssigneeInitials));
                OnPropertyChanged(nameof(AssigneeAvatar));
                OnPropertyChanged(nameof(HasAssigneeAvatar));
                OnPropertyChanged(nameof(HasBim));
                OnPropertyChanged(nameof(MetaLine));
                OnPropertyChanged(nameof(ListMetaLine));
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

        public string AssigneeInitials =>
            _issue.Assignee is null
                ? "?"
                : AvatarImage.Initials(_issue.Assignee.Name, _issue.Assignee.Email);

        public ImageSource? AssigneeAvatar => AvatarImage.Load(_issue.Assignee?.Image);

        public bool HasAssigneeAvatar => AssigneeAvatar is not null;

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

        public string ListMetaLine
        {
            get
            {
                // Assignee is rendered as an avatar chip, so this line stays state + place.
                var parts = new List<string> { StatusLabel };
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

    public sealed class IssueCommentRowViewModel
    {
        public IssueCommentRowViewModel(IssueCommentInfo comment)
        {
            Id = comment.Id;
            Body = comment.Body?.Trim() ?? string.Empty;
            AuthorName = comment.Author?.Name
                ?? comment.Author?.Email
                ?? "Unknown";
            AuthorInitials = AvatarImage.Initials(comment.Author?.Name, comment.Author?.Email);
            AuthorAvatar = AvatarImage.Load(comment.Author?.Image);
            HasAuthorAvatar = AuthorAvatar is not null;
            CreatedAtLabel = FormatWhen(comment.CreatedAt);
        }

        public string Id { get; }
        public string Body { get; }
        public string AuthorName { get; }
        public string AuthorInitials { get; }
        public ImageSource? AuthorAvatar { get; }
        public bool HasAuthorAvatar { get; }
        public string CreatedAtLabel { get; }

        private static string FormatWhen(string? iso)
        {
            if (string.IsNullOrWhiteSpace(iso)
                || !DateTimeOffset.TryParse(iso, out DateTimeOffset at))
            {
                return string.Empty;
            }

            DateTimeOffset local = at.ToLocalTime();
            TimeSpan age = DateTimeOffset.Now - local;
            if (age.TotalMinutes < 1)
            {
                return "Just now";
            }

            if (age.TotalHours < 1)
            {
                int m = Math.Max(1, (int)age.TotalMinutes);
                return $"{m}m ago";
            }

            if (age.TotalDays < 1)
            {
                int h = Math.Max(1, (int)age.TotalHours);
                return $"{h}h ago";
            }

            if (age.TotalDays < 7)
            {
                int d = Math.Max(1, (int)age.TotalDays);
                return $"{d}d ago";
            }

            return local.ToString("g");
        }
    }

    public sealed class IssuesPaneViewModel : ObservableObject
    {
        private readonly PlansyncApiClient _api = new();
        private CancellationTokenSource? _loadCts;
        private CancellationTokenSource? _commentsCts;
        private string _search = string.Empty;
        private string _filterMode = "Open";
        private IssueRowViewModel? _selected;
        private bool _isBusy;
        private string _statusMessage = string.Empty;
        private string _errorMessage = string.Empty;
        private string _editStatus = "OPEN";
        private string _editPriority = "MEDIUM";
        private string _editDescription = string.Empty;
        private string _newComment = string.Empty;
        private bool _showAllProject;
        private string? _selectedPhotoUrl;
        private bool _isDetailOpen;
        private bool _isCommentsLoading;

        public IssuesPaneViewModel()
        {
            Issues = new ObservableCollection<IssueRowViewModel>();
            Comments = new ObservableCollection<IssueCommentRowViewModel>();
            RefreshCommand = new RelayCommand(() => _ = RefreshAsync(), () => !IsBusy);
            OpenIn3dCommand = new RelayCommand(OpenIn3d, () => Selected?.HasBim == true && !IsBusy);
            OpenIn2dCommand = new RelayCommand(OpenIn2d, () => Selected?.HasBim == true && !IsBusy);
            OpenSectionBoxCommand = new RelayCommand(OpenSectionBox, () => Selected?.HasBim == true && !IsBusy);
            ResetViewCommand = new RelayCommand(ResetView, () => !IsBusy);
            SaveCommand = new RelayCommand(() => _ = SaveAsync(), () => Selected is not null && !IsBusy);
            MarkResolvedCommand = new RelayCommand(
                () => _ = QuickStatusAsync("RESOLVED"),
                () => Selected is not null && !IsBusy);
            OpenInWebCommand = new RelayCommand(OpenInWeb, () => Selected is not null);
            PostCommentCommand = new RelayCommand(
                () => _ = PostCommentAsync(),
                () => Selected is not null && !IsBusy && !string.IsNullOrWhiteSpace(NewComment));
            FilterOpenCommand = new RelayCommand(() => SetFilter("Open"));
            FilterBimCommand = new RelayCommand(() => SetFilter("Bim"));
            FilterAllCommand = new RelayCommand(() => SetFilter("All"));
            ShowThisModelCommand = new RelayCommand(() => SetScope(showAll: false));
            ShowAllProjectCommand = new RelayCommand(() => SetScope(showAll: true));
            BackToListCommand = new RelayCommand(BackToList);
        }

        public ObservableCollection<IssueRowViewModel> Issues { get; }
        public ObservableCollection<IssueCommentRowViewModel> Comments { get; }

        public ICommand RefreshCommand { get; }
        public ICommand OpenIn3dCommand { get; }
        public ICommand OpenIn2dCommand { get; }
        public ICommand OpenSectionBoxCommand { get; }
        public ICommand ResetViewCommand { get; }
        public ICommand SaveCommand { get; }
        public ICommand MarkResolvedCommand { get; }
        public ICommand OpenInWebCommand { get; }
        public ICommand PostCommentCommand { get; }
        public ICommand FilterOpenCommand { get; }
        public ICommand FilterBimCommand { get; }
        public ICommand FilterAllCommand { get; }
        public ICommand ShowThisModelCommand { get; }
        public ICommand ShowAllProjectCommand { get; }
        public ICommand BackToListCommand { get; }

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
        public bool IsThisModelScope => !_showAllProject;
        public bool IsAllProjectScope => _showAllProject;
        public bool HasModelBinding =>
            ExportSettingsStore.GetLatestModelBinding(PlansyncSessionState.ProjectId) is not null;
        public string ScopeLabel => IsAllProjectScope
            ? "All project issues"
            : HasModelBinding ? "This published model" : "Publish an IFC to scope this model";
        public string? SelectedPhotoUrl
        {
            get => _selectedPhotoUrl;
            private set => SetProperty(ref _selectedPhotoUrl, value);
        }
        public bool HasSelectedPhoto => !string.IsNullOrWhiteSpace(SelectedPhotoUrl);
        public bool IsDetailOpen
        {
            get => _isDetailOpen;
            private set
            {
                if (SetProperty(ref _isDetailOpen, value))
                {
                    OnPropertyChanged(nameof(IsListOpen));
                }
            }
        }

        public bool IsListOpen => !_isDetailOpen;

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
                        || i.AssigneeLabel.Contains(term, StringComparison.OrdinalIgnoreCase)
                        || i.PriorityLabel.Contains(term, StringComparison.OrdinalIgnoreCase));
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

                if (value is not null)
                {
                    IsDetailOpen = true;
                }

                LoadEditorFromSelection();
                NewComment = string.Empty;
                _ = LoadSelectedPhotoAsync();
                _ = LoadCommentsAsync();
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

        public string NewComment
        {
            get => _newComment;
            set
            {
                if (SetProperty(ref _newComment, value ?? string.Empty))
                {
                    (PostCommentCommand as RelayCommand)?.RaiseCanExecuteChanged();
                }
            }
        }

        public bool IsCommentsLoading
        {
            get => _isCommentsLoading;
            private set
            {
                if (SetProperty(ref _isCommentsLoading, value))
                {
                    OnPropertyChanged(nameof(CommentsEmptyVisible));
                }
            }
        }

        public bool HasComments => Comments.Count > 0;
        public bool CommentsEmptyVisible => !IsCommentsLoading && Comments.Count == 0;
        public string CommentsHeader =>
            Comments.Count == 0 ? "HISTORY" : $"HISTORY · {Comments.Count}";

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
                Selected = null;
                IsDetailOpen = false;
                OnPropertyChanged(nameof(FilteredIssues));
                OnPropertyChanged(nameof(OpenCountLabel));
                StatusMessage = "Sign in to load issues.";
                return;
            }

            if (string.IsNullOrWhiteSpace(PlansyncSessionState.ProjectId))
            {
                Issues.Clear();
                Selected = null;
                IsDetailOpen = false;
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
                RevitModelBinding? binding = _showAllProject
                    ? null
                    : ExportSettingsStore.GetLatestModelBinding(PlansyncSessionState.ProjectId);
                List<IssueInfo> rows = await _api
                    .GetProjectIssuesAsync(PlansyncSessionState.ProjectId!, binding?.FileId, token)
                    .ConfigureAwait(true);

                string? keepId = IsDetailOpen ? Selected?.Id : null;
                Issues.Clear();
                foreach (IssueInfo row in rows.OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt))
                {
                    Issues.Add(new IssueRowViewModel(row));
                }

                if (keepId is not null)
                {
                    IssueRowViewModel? kept = Issues.FirstOrDefault(i => i.Id == keepId);
                    if (kept is not null)
                    {
                        _selected = kept;
                        OnPropertyChanged(nameof(Selected));
                        LoadEditorFromSelection();
                        _ = LoadSelectedPhotoAsync();
                        IsDetailOpen = true;
                    }
                    else
                    {
                        _selected = null;
                        OnPropertyChanged(nameof(Selected));
                        IsDetailOpen = false;
                    }
                }
                else
                {
                    _selected = null;
                    OnPropertyChanged(nameof(Selected));
                    IsDetailOpen = false;
                }

                OnPropertyChanged(nameof(HasSelection));
                OnPropertyChanged(nameof(DetailTitle));
                OnPropertyChanged(nameof(FilteredIssues));
                OnPropertyChanged(nameof(OpenCountLabel));
                OnPropertyChanged(nameof(HasModelBinding));
                OnPropertyChanged(nameof(ScopeLabel));
                RaiseCommands();
                StatusMessage = $"{Issues.Count} issue(s) · {ScopeLabel}";
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

        private void OpenIn2d()
        {
            if (Selected?.Issue.BimAnchor is not { } anchor || !anchor.HasModelLink)
            {
                ErrorMessage = "This issue has no BIM link.";
                return;
            }

            ErrorMessage = string.Empty;
            StatusMessage = "Finding a compatible 2D view…";
            IssueReviewService.OpenIn2d(anchor, (ok, message) =>
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

        private void OpenSectionBox()
        {
            if (Selected?.Issue.BimAnchor is not { } anchor || !anchor.HasModelLink)
            {
                ErrorMessage = "This issue has no BIM link.";
                return;
            }

            ErrorMessage = string.Empty;
            StatusMessage = "Framing section box…";
            IssueReviewService.OpenSectionBox(anchor, (ok, message) =>
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

        private void BackToList()
        {
            IsDetailOpen = false;
            _selected = null;
            SelectedPhotoUrl = null;
            NewComment = string.Empty;
            Comments.Clear();
            OnPropertyChanged(nameof(Selected));
            OnPropertyChanged(nameof(HasSelection));
            OnPropertyChanged(nameof(HasSelectedPhoto));
            OnPropertyChanged(nameof(DetailTitle));
            OnPropertyChanged(nameof(HasComments));
            OnPropertyChanged(nameof(CommentsEmptyVisible));
            OnPropertyChanged(nameof(CommentsHeader));
            RaiseCommands();
        }

        private void SetScope(bool showAll)
        {
            if (_showAllProject == showAll)
            {
                return;
            }

            _showAllProject = showAll;
            OnPropertyChanged(nameof(IsThisModelScope));
            OnPropertyChanged(nameof(IsAllProjectScope));
            OnPropertyChanged(nameof(ScopeLabel));
            IsDetailOpen = false;
            _selected = null;
            OnPropertyChanged(nameof(Selected));
            OnPropertyChanged(nameof(HasSelection));
            _ = RefreshAsync();
        }

        private async Task LoadSelectedPhotoAsync()
        {
            SelectedPhotoUrl = null;
            OnPropertyChanged(nameof(HasSelectedPhoto));
            IssueReferencePhoto? photo = Selected?.Issue.ReferencePhotos.FirstOrDefault();
            if (photo is null || Selected is null)
            {
                return;
            }

            try
            {
                SelectedPhotoUrl = await _api
                    .GetIssueReferencePhotoReadUrlAsync(Selected.Id, photo.Id)
                    .ConfigureAwait(true);
                OnPropertyChanged(nameof(HasSelectedPhoto));
            }
            catch
            {
                // Photos are supplementary; don't replace the issue UI with an error.
            }
        }

        private async Task LoadCommentsAsync()
        {
            _commentsCts?.Cancel();
            Comments.Clear();
            OnPropertyChanged(nameof(HasComments));
            OnPropertyChanged(nameof(CommentsEmptyVisible));
            OnPropertyChanged(nameof(CommentsHeader));

            if (Selected is null)
            {
                IsCommentsLoading = false;
                return;
            }

            _commentsCts = new CancellationTokenSource();
            CancellationToken token = _commentsCts.Token;
            string issueId = Selected.Id;
            IsCommentsLoading = true;
            try
            {
                List<IssueCommentInfo> rows = await _api
                    .GetIssueCommentsAsync(issueId, token)
                    .ConfigureAwait(true);
                if (token.IsCancellationRequested || Selected?.Id != issueId)
                {
                    return;
                }

                Comments.Clear();
                foreach (IssueCommentInfo row in rows)
                {
                    Comments.Add(new IssueCommentRowViewModel(row));
                }

                OnPropertyChanged(nameof(HasComments));
                OnPropertyChanged(nameof(CommentsEmptyVisible));
                OnPropertyChanged(nameof(CommentsHeader));
            }
            catch (OperationCanceledException)
            {
                // superseded
            }
            catch
            {
                // History is supplementary; keep the issue detail usable.
                if (Selected?.Id == issueId)
                {
                    StatusMessage = "Could not load comment history.";
                }
            }
            finally
            {
                if (!token.IsCancellationRequested)
                {
                    IsCommentsLoading = false;
                }
            }
        }

        private async Task PostCommentAsync()
        {
            if (Selected is null)
            {
                return;
            }

            string body = NewComment.Trim();
            if (body.Length == 0)
            {
                return;
            }

            string issueId = Selected.Id;
            IsBusy = true;
            ErrorMessage = string.Empty;
            StatusMessage = "Posting comment…";
            try
            {
                IssueCommentInfo created = await _api
                    .CreateIssueCommentAsync(issueId, body)
                    .ConfigureAwait(true);
                if (Selected?.Id == issueId)
                {
                    Comments.Add(new IssueCommentRowViewModel(created));
                    NewComment = string.Empty;
                    OnPropertyChanged(nameof(HasComments));
                    OnPropertyChanged(nameof(CommentsEmptyVisible));
                    OnPropertyChanged(nameof(CommentsHeader));
                    StatusMessage = "Comment added.";
                }
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
            (OpenIn2dCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (OpenSectionBoxCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (ResetViewCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (SaveCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (MarkResolvedCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (OpenInWebCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (PostCommentCommand as RelayCommand)?.RaiseCanExecuteChanged();
        }

        private static bool IsSignedIn() =>
            !string.IsNullOrWhiteSpace(PlansyncSessionState.Me?.User?.Email);
    }
}
