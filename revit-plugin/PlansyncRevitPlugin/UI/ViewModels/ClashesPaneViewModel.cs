using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Input;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;
using PlansyncRevitPlugin.Services.IssueReview;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class ClashTestOption
    {
        public static ClashTestOption All { get; } = new() { Id = "", Name = "All tests" };

        public string Id { get; init; } = string.Empty;
        public string Name { get; init; } = string.Empty;
    }

    public sealed class ClashRowViewModel : ObservableObject
    {
        private ClashInfo _clash;
        private bool? _foundA;
        private bool? _foundB;

        public ClashRowViewModel(ClashInfo clash)
        {
            _clash = clash;
        }

        public ClashInfo Clash
        {
            get => _clash;
            set
            {
                if (!SetProperty(ref _clash, value))
                {
                    return;
                }

                NotifyDisplay();
            }
        }

        public string Id => _clash.Id;
        public string Status => _clash.Status;
        public bool IsOpen => _clash.IsOpen;
        public string StatusLabel => ClashFormat.StatusLabel(_clash.Status);
        public string TypeLabel => ClashFormat.TypeLabel(_clash.ClashType);
        public string DistanceLabel => ClashFormat.DistanceDetail(_clash.ClashType, _clash.DistanceMm);
        public string TestName => _clash.Test?.Name ?? string.Empty;
        public string Item1Name => ClashFormat.ElementLabel(_clash.ElementA, _clash.GuidA);
        public string Item2Name => ClashFormat.ElementLabel(_clash.ElementB, _clash.GuidB);
        public string Item1Meta => MetaLine(_clash.FileA?.Name, _clash.ElementA?.IfcType, _foundA);
        public string Item2Meta => MetaLine(_clash.FileB?.Name, _clash.ElementB?.IfcType, _foundB);
        public bool Item1Missing => _foundA == false;
        public bool Item2Missing => _foundB == false;
        public bool CanQuickResolve => IsOpen;

        public void Apply(ClashInfo updated)
        {
            updated.Test ??= _clash.Test;
            updated.FileA ??= _clash.FileA;
            updated.FileB ??= _clash.FileB;
            updated.ElementA ??= _clash.ElementA;
            updated.ElementB ??= _clash.ElementB;
            Clash = updated;
        }

        public void SetFound(bool foundA, bool foundB)
        {
            _foundA = foundA;
            _foundB = foundB;
            OnPropertyChanged(nameof(Item1Meta));
            OnPropertyChanged(nameof(Item2Meta));
            OnPropertyChanged(nameof(Item1Missing));
            OnPropertyChanged(nameof(Item2Missing));
        }

        public IssueBimAnchor ToAnchor() => new()
        {
            IfcGuid = _clash.GuidA,
            IfcGuidB = _clash.GuidB,
            Name = _clash.ElementA?.Name,
            NameB = _clash.ElementB?.Name,
            IfcType = _clash.ElementA?.IfcType,
            IfcTypeB = _clash.ElementB?.IfcType,
            Position = _clash.Point
        };

        public bool MatchesSearch(string term) =>
            Item1Name.Contains(term, StringComparison.OrdinalIgnoreCase)
            || Item2Name.Contains(term, StringComparison.OrdinalIgnoreCase)
            || TypeLabel.Contains(term, StringComparison.OrdinalIgnoreCase)
            || TestName.Contains(term, StringComparison.OrdinalIgnoreCase)
            || (_clash.FileA?.Name?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false)
            || (_clash.FileB?.Name?.Contains(term, StringComparison.OrdinalIgnoreCase) ?? false);

        private void NotifyDisplay()
        {
            OnPropertyChanged(nameof(Id));
            OnPropertyChanged(nameof(Status));
            OnPropertyChanged(nameof(IsOpen));
            OnPropertyChanged(nameof(StatusLabel));
            OnPropertyChanged(nameof(TypeLabel));
            OnPropertyChanged(nameof(DistanceLabel));
            OnPropertyChanged(nameof(TestName));
            OnPropertyChanged(nameof(Item1Name));
            OnPropertyChanged(nameof(Item2Name));
            OnPropertyChanged(nameof(Item1Meta));
            OnPropertyChanged(nameof(Item2Meta));
            OnPropertyChanged(nameof(CanQuickResolve));
        }

        private static string MetaLine(string? fileName, string? ifcType, bool? found)
        {
            var parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(fileName))
            {
                parts.Add(fileName!);
            }

            parts.Add(ClashFormat.ShortType(ifcType));
            if (found == false)
            {
                parts.Add("Not in this model");
            }

            return string.Join(" · ", parts);
        }
    }

    public sealed class ClashesPaneViewModel : ObservableObject
    {
        private readonly PlansyncApiClient _api = new();
        private CancellationTokenSource? _loadCts;
        private CancellationTokenSource? _commentsCts;
        private string _search = string.Empty;
        private string _filterMode = "Open";
        private ClashTestOption _selectedTest = ClashTestOption.All;
        private ClashRowViewModel? _selected;
        private bool _isBusy;
        private bool _isDetailOpen;
        private bool _isCommentsLoading;
        private bool _needsPro;
        private bool _truncated;
        private bool _suppressReview;
        private bool _ignoreTestChange;
        private string? _pickedTestId;
        private string _statusMessage = string.Empty;
        private string _errorMessage = string.Empty;
        private string _newComment = string.Empty;

        public ClashesPaneViewModel()
        {
            Tests = new ObservableCollection<ClashTestOption> { ClashTestOption.All };
            Clashes = new ObservableCollection<ClashRowViewModel>();
            Comments = new ObservableCollection<IssueCommentRowViewModel>();
            RefreshCommand = new RelayCommand(() => _ = RefreshAsync(), () => !IsBusy);
            BackToListCommand = new RelayCommand(BackToList);
            OpenIn3dCommand = new RelayCommand(OpenIn3d, () => Selected is not null && !IsBusy);
            OpenSectionBoxCommand = new RelayCommand(OpenSectionBox, () => Selected is not null && !IsBusy);
            ResetViewCommand = new RelayCommand(ResetView, () => !IsBusy);
            PostCommentCommand = new RelayCommand(
                () => _ = PostCommentAsync(),
                () => Selected is not null && !IsBusy && !string.IsNullOrWhiteSpace(NewComment));
            FilterOpenCommand = new RelayCommand(() => SetFilter("Open"));
            FilterResolvedCommand = new RelayCommand(() => SetFilter("Resolved"));
            FilterAllCommand = new RelayCommand(() => SetFilter("All"));
            PreviousCommand = new RelayCommand(() => Move(-1), () => CanGoPrevious);
            NextCommand = new RelayCommand(() => Move(1), () => CanGoNext);
            ResolveRowCommand = new RelayCommand(
                p =>
                {
                    if (p is ClashRowViewModel row)
                    {
                        _ = PatchStatusAsync(row, "RESOLVED");
                    }
                },
                p => p is ClashRowViewModel row && row.CanQuickResolve && !IsBusy);
            SetStatusCommand = new RelayCommand(
                p =>
                {
                    if (p is string status && Selected is not null)
                    {
                        _ = PatchStatusAsync(Selected, status);
                    }
                },
                _ => Selected is not null && !IsBusy);
        }

        public ObservableCollection<ClashTestOption> Tests { get; }
        public ObservableCollection<ClashRowViewModel> Clashes { get; }
        public ObservableCollection<IssueCommentRowViewModel> Comments { get; }

        public ICommand RefreshCommand { get; }
        public ICommand BackToListCommand { get; }
        public ICommand OpenIn3dCommand { get; }
        public ICommand OpenSectionBoxCommand { get; }
        public ICommand ResetViewCommand { get; }
        public ICommand PostCommentCommand { get; }
        public ICommand FilterOpenCommand { get; }
        public ICommand FilterResolvedCommand { get; }
        public ICommand FilterAllCommand { get; }
        public ICommand PreviousCommand { get; }
        public ICommand NextCommand { get; }
        public ICommand ResolveRowCommand { get; }
        public ICommand SetStatusCommand { get; }

        public ClashTestOption SelectedTest
        {
            get => _selectedTest;
            set
            {
                ClashTestOption next = value ?? ClashTestOption.All;
                if (!SetProperty(ref _selectedTest, next))
                {
                    return;
                }

                _pickedTestId = next.Id;
                if (_ignoreTestChange)
                {
                    return;
                }

                _ = RefreshAsync(reloadTests: false);
            }
        }

        public string Search
        {
            get => _search;
            set
            {
                if (SetProperty(ref _search, value ?? string.Empty))
                {
                    NotifyList();
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
                    NotifyList();
                    OnPropertyChanged(nameof(IsFilterOpen));
                    OnPropertyChanged(nameof(IsFilterResolved));
                    OnPropertyChanged(nameof(IsFilterAll));
                }
            }
        }

        public bool IsFilterOpen => FilterMode == "Open";
        public bool IsFilterResolved => FilterMode == "Resolved";
        public bool IsFilterAll => FilterMode == "All";

        public IEnumerable<ClashRowViewModel> FilteredClashes
        {
            get
            {
                IEnumerable<ClashRowViewModel> q = Clashes;
                q = FilterMode switch
                {
                    "Open" => q.Where(c => c.IsOpen),
                    "Resolved" => q.Where(c =>
                        string.Equals(c.Status, "RESOLVED", StringComparison.OrdinalIgnoreCase)),
                    _ => q
                };

                string term = Search.Trim();
                if (term.Length > 0)
                {
                    q = q.Where(c => c.MatchesSearch(term));
                }

                return q.ToList();
            }
        }

        public ClashRowViewModel? Selected
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
                    if (!_suppressReview)
                    {
                        OpenIn3d();
                    }
                }

                NewComment = string.Empty;
                _ = LoadCommentsAsync();
                RaiseCommands();
                OnPropertyChanged(nameof(HasSelection));
                OnPropertyChanged(nameof(DetailTitle));
                OnPropertyChanged(nameof(IsStatusNew));
                OnPropertyChanged(nameof(IsStatusActive));
                OnPropertyChanged(nameof(IsStatusResolved));
                OnPropertyChanged(nameof(IsStatusIgnored));
                OnPropertyChanged(nameof(CanGoPrevious));
                OnPropertyChanged(nameof(CanGoNext));
            }
        }

        public bool HasSelection => Selected is not null;
        public string DetailTitle => Selected is null
            ? "Select a clash"
            : $"{Selected.Item1Name} × {Selected.Item2Name}";

        public bool IsDetailOpen
        {
            get => _isDetailOpen;
            private set
            {
                if (SetProperty(ref _isDetailOpen, value))
                {
                    OnPropertyChanged(nameof(IsListOpen));
                    OnPropertyChanged(nameof(ShowEmptyState));
                }
            }
        }

        public bool IsListOpen => !_isDetailOpen;
        public bool IsStatusNew => Selected?.Status == "NEW";
        public bool IsStatusActive => Selected?.Status == "ACTIVE";
        public bool IsStatusResolved => Selected?.Status == "RESOLVED";
        public bool IsStatusIgnored => Selected?.Status == "IGNORED";

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
            Comments.Count == 0 ? "COMMENTS" : $"COMMENTS · {Comments.Count}";

        public bool IsBusy
        {
            get => _isBusy;
            private set
            {
                if (SetProperty(ref _isBusy, value))
                {
                    RaiseCommands();
                    OnPropertyChanged(nameof(ShowEmptyState));
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
                int open = Clashes.Count(c => c.IsOpen);
                string label = open == 0 ? "No open clashes" : $"{open} open";
                return _truncated ? $"{label} · first 2000" : label;
            }
        }

        public bool ShowEmptyState => IsListOpen && !IsBusy && !FilteredClashes.Any();

        public string EmptyTitle
        {
            get
            {
                if (!IsSignedIn())
                {
                    return "Sign in to review clashes";
                }

                if (string.IsNullOrWhiteSpace(PlansyncSessionState.ProjectId))
                {
                    return "Set a destination project";
                }

                if (_needsPro)
                {
                    return "Clash detection needs BIM Pro";
                }

                if (Tests.Count <= 1)
                {
                    return "No clash tests yet";
                }

                return "No clashes match";
            }
        }

        public string EmptyBody
        {
            get
            {
                if (!IsSignedIn())
                {
                    return "Use the Status tab to sign in, then refresh.";
                }

                if (string.IsNullOrWhiteSpace(PlansyncSessionState.ProjectId))
                {
                    return "Publish or pick a Plansync project first.";
                }

                if (_needsPro)
                {
                    return "Upgrade the workspace to BIM Pro to load clash results.";
                }

                if (Tests.Count <= 1)
                {
                    return "Run Clash Detection in the Plansync web viewer, then refresh this panel.";
                }

                return "Try another test or status filter.";
            }
        }

        public bool CanGoPrevious => IndexOfSelected() > 0;
        public bool CanGoNext
        {
            get
            {
                List<ClashRowViewModel> rows = FilteredClashes.ToList();
                int i = IndexOfSelected(rows);
                return i >= 0 && i < rows.Count - 1;
            }
        }

        public async Task RefreshAsync(bool reloadTests = true)
        {
            ErrorMessage = string.Empty;
            _needsPro = false;
            if (!IsSignedIn())
            {
                ClearList("Sign in to load clashes.");
                return;
            }

            if (string.IsNullOrWhiteSpace(PlansyncSessionState.ProjectId))
            {
                ClearList("Set a Plansync destination project first.");
                return;
            }

            _loadCts?.Cancel();
            _loadCts = new CancellationTokenSource();
            CancellationToken token = _loadCts.Token;
            IsBusy = true;
            StatusMessage = "Loading clashes…";
            try
            {
                string projectId = PlansyncSessionState.ProjectId!;
                if (reloadTests)
                {
                    await LoadTestsAsync(projectId, token).ConfigureAwait(true);
                }

                ProjectClashesResponse payload = await _api
                    .GetProjectClashesAsync(
                        projectId,
                        string.IsNullOrWhiteSpace(SelectedTest.Id) ? null : SelectedTest.Id,
                        status: null,
                        token)
                    .ConfigureAwait(true);

                _truncated = payload.Truncated;
                string? keepId = IsDetailOpen ? Selected?.Id : null;
                Clashes.Clear();
                foreach (ClashInfo row in payload.Clashes)
                {
                    Clashes.Add(new ClashRowViewModel(row));
                }

                _suppressReview = true;
                try
                {
                    if (keepId is not null)
                    {
                        ClashRowViewModel? kept = Clashes.FirstOrDefault(c => c.Id == keepId);
                        if (kept is not null)
                        {
                            _selected = kept;
                            OnPropertyChanged(nameof(Selected));
                            IsDetailOpen = true;
                            _ = LoadCommentsAsync();
                        }
                        else
                        {
                            _selected = null;
                            OnPropertyChanged(nameof(Selected));
                            IsDetailOpen = false;
                        }
                    }
                    else if (!IsDetailOpen)
                    {
                        _selected = null;
                        OnPropertyChanged(nameof(Selected));
                    }
                }
                finally
                {
                    _suppressReview = false;
                }

                NotifyList();
                RaiseCommands();
                StatusMessage = Clashes.Count == 0
                    ? EmptyTitle
                    : $"{Clashes.Count} clash(es) · {OpenCountLabel}";
            }
            catch (OperationCanceledException)
            {
                // superseded
            }
            catch (PlansyncProRequiredException ex)
            {
                _needsPro = true;
                Clashes.Clear();
                NotifyList();
                StatusMessage = string.Empty;
                ErrorMessage = string.Empty;
                OnPropertyChanged(nameof(EmptyTitle));
                OnPropertyChanged(nameof(EmptyBody));
                StatusMessage = ex.Message;
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

        private async Task LoadTestsAsync(string projectId, CancellationToken token)
        {
            List<ClashTestInfo> rows = await _api.GetClashTestsAsync(projectId, token).ConfigureAwait(true);
            _ignoreTestChange = true;
            try
            {
                Tests.Clear();
                Tests.Add(ClashTestOption.All);
                foreach (ClashTestInfo test in rows)
                {
                    Tests.Add(new ClashTestOption { Id = test.Id, Name = test.Name });
                }

                ClashTestOption pick;
                if (_pickedTestId is null)
                {
                    string? populatedId = rows.FirstOrDefault(t => (t.ClashCount ?? 0) > 0)?.Id;
                    pick = Tests.FirstOrDefault(o => o.Id == populatedId)
                        ?? Tests.Skip(1).FirstOrDefault()
                        ?? ClashTestOption.All;
                    _pickedTestId = pick.Id;
                }
                else
                {
                    pick = Tests.FirstOrDefault(t => t.Id == _pickedTestId) ?? ClashTestOption.All;
                }

                _selectedTest = pick;
                OnPropertyChanged(nameof(SelectedTest));
            }
            finally
            {
                _ignoreTestChange = false;
            }
        }

        private async Task PatchStatusAsync(ClashRowViewModel row, string status)
        {
            IsBusy = true;
            ErrorMessage = string.Empty;
            StatusMessage = "Updating status…";
            try
            {
                ClashInfo updated = await _api
                    .PatchClashAsync(row.Id, new ClashPatchRequest { Status = status })
                    .ConfigureAwait(true);
                row.Apply(updated);
                NotifyList();
                OnPropertyChanged(nameof(IsStatusNew));
                OnPropertyChanged(nameof(IsStatusActive));
                OnPropertyChanged(nameof(IsStatusResolved));
                OnPropertyChanged(nameof(IsStatusIgnored));
                StatusMessage = $"Marked {ClashFormat.StatusLabel(status)}.";
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

        private void OpenIn3d()
        {
            if (Selected is null)
            {
                return;
            }

            ErrorMessage = string.Empty;
            StatusMessage = "Opening clash in 3D…";
            ClashRowViewModel row = Selected;
            IssueReviewService.OpenClash(row.ToAnchor(), DetailTitle, (ok, message, foundA, foundB) =>
            {
                Application.Current?.Dispatcher.Invoke(() =>
                {
                    row.SetFound(foundA, foundB);
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
            if (Selected is null)
            {
                return;
            }

            ErrorMessage = string.Empty;
            StatusMessage = "Framing section box…";
            ClashRowViewModel row = Selected;
            IssueReviewService.OpenClashSectionBox(row.ToAnchor(), (ok, message, foundA, foundB) =>
            {
                Application.Current?.Dispatcher.Invoke(() =>
                {
                    row.SetFound(foundA, foundB);
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

            IsBusy = true;
            ErrorMessage = string.Empty;
            try
            {
                IssueCommentInfo created = await _api
                    .CreateClashCommentAsync(Selected.Id, body)
                    .ConfigureAwait(true);
                Comments.Add(new IssueCommentRowViewModel(created));
                NewComment = string.Empty;
                OnPropertyChanged(nameof(HasComments));
                OnPropertyChanged(nameof(CommentsEmptyVisible));
                OnPropertyChanged(nameof(CommentsHeader));
                StatusMessage = "Comment added.";
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
            }
            finally
            {
                IsBusy = false;
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
            string clashId = Selected.Id;
            IsCommentsLoading = true;
            try
            {
                List<IssueCommentInfo> rows = await _api
                    .GetClashCommentsAsync(clashId, token)
                    .ConfigureAwait(true);
                if (token.IsCancellationRequested || Selected?.Id != clashId)
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
                // Comments are supplementary.
            }
            finally
            {
                if (Selected?.Id == clashId)
                {
                    IsCommentsLoading = false;
                }
            }
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
            NewComment = string.Empty;
            Comments.Clear();
            OnPropertyChanged(nameof(Selected));
            OnPropertyChanged(nameof(HasSelection));
            OnPropertyChanged(nameof(DetailTitle));
            OnPropertyChanged(nameof(HasComments));
            OnPropertyChanged(nameof(CommentsEmptyVisible));
            OnPropertyChanged(nameof(CommentsHeader));
            RaiseCommands();
        }

        private void Move(int delta)
        {
            List<ClashRowViewModel> rows = FilteredClashes.ToList();
            int i = IndexOfSelected(rows);
            int next = i < 0 ? 0 : i + delta;
            if (next >= 0 && next < rows.Count)
            {
                Selected = rows[next];
            }
        }

        private int IndexOfSelected(List<ClashRowViewModel>? rows = null)
        {
            rows ??= FilteredClashes.ToList();
            if (Selected is null)
            {
                return -1;
            }

            return rows.FindIndex(c => c.Id == Selected.Id);
        }

        private void ClearList(string status)
        {
            Tests.Clear();
            Tests.Add(ClashTestOption.All);
            _ignoreTestChange = true;
            _selectedTest = ClashTestOption.All;
            _pickedTestId = null;
            OnPropertyChanged(nameof(SelectedTest));
            _ignoreTestChange = false;
            Clashes.Clear();
            _selected = null;
            IsDetailOpen = false;
            OnPropertyChanged(nameof(Selected));
            OnPropertyChanged(nameof(HasSelection));
            NotifyList();
            StatusMessage = status;
        }

        private void NotifyList()
        {
            OnPropertyChanged(nameof(FilteredClashes));
            OnPropertyChanged(nameof(OpenCountLabel));
            OnPropertyChanged(nameof(ShowEmptyState));
            OnPropertyChanged(nameof(EmptyTitle));
            OnPropertyChanged(nameof(EmptyBody));
            OnPropertyChanged(nameof(CanGoPrevious));
            OnPropertyChanged(nameof(CanGoNext));
        }

        private void RaiseCommands()
        {
            (RefreshCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (OpenIn3dCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (OpenSectionBoxCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (ResetViewCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (PostCommentCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (PreviousCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (NextCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (ResolveRowCommand as RelayCommand)?.RaiseCanExecuteChanged();
            (SetStatusCommand as RelayCommand)?.RaiseCanExecuteChanged();
        }

        private static bool IsSignedIn() =>
            !string.IsNullOrWhiteSpace(PlansyncSessionState.Me?.User?.Email);
    }
}
