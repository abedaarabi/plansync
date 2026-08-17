using System.Diagnostics;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;

namespace PlansyncRevitPlugin.UI
{
    public partial class PlansyncStatusPane : UserControl
    {
        private bool _isBusy;

        public PlansyncStatusPane()
        {
            InitializeComponent();
            LogoImage.Source = IconLoader.Load("icon-180.png")
                ?? IconLoader.Load("logo_mark_48.png");
            Loaded += (_, _) =>
            {
                PublishStatusHub.Changed += OnChanged;
                RestoreDestinationIfNeeded();
                _ = RefreshAsync();
            };
            Unloaded += (_, _) => PublishStatusHub.Changed -= OnChanged;
        }

        private void OnChanged()
        {
            Dispatcher.Invoke(() => _ = RefreshAsync());
        }

        private void Refresh_Click(object sender, RoutedEventArgs e)
        {
            _ = RefreshAsync();
            IssuesPanelHost.NotifySessionChanged();
            ClashesPanelHost.NotifySessionChanged();
        }

        private void StatusTab_Click(object sender, RoutedEventArgs e)
        {
            ShowTab(PaneTab.Status);
        }

        private void IssuesTab_Click(object sender, RoutedEventArgs e)
        {
            ShowTab(PaneTab.Issues);
            IssuesPanelHost.NotifySessionChanged();
        }

        private void ClashesTab_Click(object sender, RoutedEventArgs e)
        {
            ShowTab(PaneTab.Clashes);
            ClashesPanelHost.NotifySessionChanged();
        }

        public void ShowIssuesTab()
        {
            ShowTab(PaneTab.Issues);
            IssuesPanelHost?.NotifySessionChanged();
        }

        public void ShowClashesTab()
        {
            ShowTab(PaneTab.Clashes);
            ClashesPanelHost?.NotifySessionChanged();
        }

        private enum PaneTab
        {
            Status,
            Issues,
            Clashes
        }

        private void ShowTab(PaneTab tab)
        {
            if (StatusTabButton is not null)
            {
                StatusTabButton.IsChecked = tab == PaneTab.Status;
            }

            if (IssuesTabButton is not null)
            {
                IssuesTabButton.IsChecked = tab == PaneTab.Issues;
            }

            if (ClashesTabButton is not null)
            {
                ClashesTabButton.IsChecked = tab == PaneTab.Clashes;
            }

            if (StatusContent is not null)
            {
                StatusContent.Visibility = tab == PaneTab.Status ? Visibility.Visible : Visibility.Collapsed;
            }

            if (IssuesPanelHost is not null)
            {
                IssuesPanelHost.Visibility = tab == PaneTab.Issues ? Visibility.Visible : Visibility.Collapsed;
            }

            if (ClashesPanelHost is not null)
            {
                ClashesPanelHost.Visibility = tab == PaneTab.Clashes ? Visibility.Visible : Visibility.Collapsed;
            }
        }

        private async void AuthAction_Click(object sender, RoutedEventArgs e)
        {
            if (_isBusy)
            {
                return;
            }

            if (IsSignedIn())
            {
                await SignOutAsync().ConfigureAwait(true);
                return;
            }

            await SignInAsync().ConfigureAwait(true);
        }

        private async Task SignInAsync()
        {
            _isBusy = true;
            AuthActionButton.IsEnabled = false;
            try
            {
                var login = new LoginWindow();
                if (login.ShowDialog() == true && login.SignedInMe?.User is not null)
                {
                    PlansyncSessionState.Me = login.SignedInMe;
                    PublishStatusHub.Notify($"Signed in as {login.SignedInMe.User.Email}");
                    IssuesPanelHost.NotifySessionChanged();
                    ClashesPanelHost.NotifySessionChanged();
                }
            }
            finally
            {
                _isBusy = false;
                AuthActionButton.IsEnabled = true;
                await RefreshAsync().ConfigureAwait(true);
            }
        }

        private async Task SignOutAsync()
        {
            _isBusy = true;
            AuthActionButton.IsEnabled = false;
            AccountStateText.Text = "Signing out…";
            try
            {
                await new PlansyncAuthClient().SignOutAsync().ConfigureAwait(true);
                PlansyncSessionState.ClearUser();
                PlansyncSessionState.ClearDestination();
                PublishStatusHub.Notify("Signed out.");
                IssuesPanelHost.NotifySessionChanged();
                ClashesPanelHost.NotifySessionChanged();
            }
            catch
            {
                PlansyncHttp.ClearSession();
                PlansyncSessionState.ClearUser();
                PlansyncSessionState.ClearDestination();
                PublishStatusHub.Notify("Signed out.");
                IssuesPanelHost.NotifySessionChanged();
                ClashesPanelHost.NotifySessionChanged();
            }
            finally
            {
                _isBusy = false;
                AuthActionButton.IsEnabled = true;
                await RefreshAsync().ConfigureAwait(true);
            }
        }

        public async Task RefreshAsync()
        {
            RestoreDestinationIfNeeded();
            await SyncAuthFromServerAsync().ConfigureAwait(true);
            ApplyUi();
        }

        /// <summary>Keep panel UI in sync without async auth check (used after local state changes).</summary>
        public void Refresh()
        {
            RestoreDestinationIfNeeded();
            ApplyUi();
        }

        private async Task SyncAuthFromServerAsync()
        {
            try
            {
                AccountStateText.Text = "Checking…";
                MeResponse? me = await new PlansyncAuthClient().TryGetMeAsync().ConfigureAwait(true);
                if (me?.User is not null)
                {
                    PlansyncSessionState.Me = me;
                }
                else
                {
                    PlansyncSessionState.ClearUser();
                }
            }
            catch (PlansyncAuthException ex) when (ex.Unverified)
            {
                // Still treat as signed-in session, but surface the issue.
                PublishStatusHub.Notify(ex.Message);
            }
            catch
            {
                // Network blip: keep last known in-memory user if present.
            }
        }

        private void ApplyUi()
        {
            bool signedIn = IsSignedIn();
            string? email = PlansyncSessionState.Me?.User?.Email;

            UserText.Text = signedIn ? email! : "Not signed in";
            ApplyAuthBadge(signedIn);
            AuthActionButton.Content = signedIn ? "Sign out" : "Sign in";
            AuthActionButton.Style = (Style)FindResource(
                signedIn ? "PlansyncSecondaryButton" : "PlansyncPrimaryButton");

            bool hasDestination = PlansyncSessionState.HasDestination;
            WorkspaceText.Text = string.IsNullOrWhiteSpace(PlansyncSessionState.WorkspaceName)
                ? "—"
                : PlansyncSessionState.WorkspaceName!;
            ProjectText.Text = string.IsNullOrWhiteSpace(PlansyncSessionState.ProjectName)
                ? "—"
                : PlansyncSessionState.ProjectName!;
            FolderText.Text = !hasDestination
                ? "—"
                : string.IsNullOrWhiteSpace(PlansyncSessionState.FolderId)
                    ? "(project root)"
                    : PlansyncSessionState.FolderName ?? PlansyncSessionState.FolderId!;

            DestinationReadyText.Text = hasDestination ? "Ready" : "Not set";
            DestinationReadyText.Foreground = hasDestination
                ? ThemeBrush("PlansyncSuccessTextBrush")
                : ThemeBrush("PlansyncErrorAccentBrush");
            OpenDestinationButton.IsEnabled = signedIn && PlansyncSessionState.ProjectId is not null;

            PublishSnapshot snap = PublishStatusHub.Snapshot;
            StatusText.Text = snap.Status;

            if (snap.LastPublishAt is DateTimeOffset at)
            {
                LastPublishSummaryText.Text =
                    $"{snap.LastUploadedCount} uploaded · {snap.LastQueuedCount} queued · {snap.LastFailedCount} failed";
                LastPublishTimeText.Text = $"{at.ToLocalTime():g}"
                    + (string.IsNullOrWhiteSpace(snap.LastDestination)
                        ? string.Empty
                        : $"  ·  {snap.LastDestination}");
                LastPublishFilesText.Text = snap.LastFileNames.Count == 0
                    ? string.Empty
                    : string.Join("\n", snap.LastFileNames.Select(n => "• " + n));
            }
            else
            {
                // Nothing published this session yet — fall back to the persisted history for the
                // current destination project so users see the last published version even right
                // after reopening Revit, instead of a misleading "no publish yet".
                PublishHistoryEntry? lastForProject = hasDestination
                    ? PublishHistoryStore.GetLastForProject(PlansyncSessionState.ProjectId)
                    : null;

                if (lastForProject is not null)
                {
                    LastPublishSummaryText.Text = string.IsNullOrWhiteSpace(lastForProject.DocumentTitle)
                        ? $"{lastForProject.FileNames.Count} file(s) published"
                        : $"{lastForProject.FileNames.Count} file(s) from \"{lastForProject.DocumentTitle}\"";
                    LastPublishTimeText.Text =
                        $"{lastForProject.PublishedAt.ToLocalTime():g}  ·  before this session";
                    LastPublishFilesText.Text = lastForProject.FileNames.Count == 0
                        ? string.Empty
                        : string.Join("\n", lastForProject.FileNames.Take(8).Select(n => "• " + n));
                }
                else
                {
                    LastPublishSummaryText.Text = "No publish yet.";
                    LastPublishTimeText.Text = signedIn
                        ? "Publish from Plansync to see results here."
                        : "Sign in to publish to Plansync.";
                    LastPublishFilesText.Text = string.Empty;
                }
            }

            IReadOnlyList<OfflineQueueItem> queue = OfflineQueueStore.GetAll();
            if (queue.Count == 0)
            {
                QueueBadge.Visibility = Visibility.Collapsed;
                QueueFilesText.Visibility = Visibility.Collapsed;
                RetryQueueButton.Visibility = Visibility.Collapsed;
            }
            else
            {
                QueueBadge.Visibility = Visibility.Visible;
                QueueBadgeText.Text = $"{queue.Count} queued";
                QueueFilesText.Visibility = Visibility.Visible;
                QueueFilesText.Text = string.Join(
                    "\n",
                    queue.Take(6).Select(q =>
                        "• " + q.FileName + (string.IsNullOrWhiteSpace(q.LastError) ? string.Empty : $" — {q.LastError}")));
                RetryQueueButton.Visibility = Visibility.Visible;
                RetryQueueButton.Content = $"Retry offline queue ({queue.Count})";
            }
        }

        private void ApplyAuthBadge(bool signedIn)
        {
            if (signedIn)
            {
                AuthBadge.Background = ThemeBrush("PlansyncSuccessBgBrush");
                AuthBadge.BorderBrush = ThemeBrush("PlansyncSuccessBorderBrush");
                StatusDot.Fill = ThemeBrush("PlansyncSuccessBrush");
                AccountStateText.Text = "Signed in";
                AccountStateText.Foreground = ThemeBrush("PlansyncSuccessTextBrush");
            }
            else
            {
                AuthBadge.Background = ThemeBrush("PlansyncSurfaceAltBrush");
                AuthBadge.BorderBrush = ThemeBrush("PlansyncBorderBrush");
                StatusDot.Fill = ThemeBrush("PlansyncFaintTextBrush");
                AccountStateText.Text = "Signed out";
                AccountStateText.Foreground = ThemeBrush("PlansyncPlaceholderTextBrush");
            }
        }

        /// <summary>Resolves a theme brush by resource key so status colors come from the shared
        /// theme resource dictionary instead of being hardcoded.</summary>
        private SolidColorBrush ThemeBrush(string key) =>
            TryFindResource(key) as SolidColorBrush ?? Brushes.Black;

        private static bool IsSignedIn() =>
            !string.IsNullOrWhiteSpace(PlansyncSessionState.Me?.User?.Email);

        private static void RestoreDestinationIfNeeded()
        {
            if (PlansyncSessionState.HasDestination)
            {
                return;
            }

            DestinationSettings saved = ExportSettingsStore.Load().Destination;
            if (string.IsNullOrWhiteSpace(saved.WorkspaceId) || string.IsNullOrWhiteSpace(saved.ProjectId))
            {
                return;
            }

            PlansyncSessionState.WorkspaceId = saved.WorkspaceId;
            PlansyncSessionState.WorkspaceName = saved.WorkspaceName;
            PlansyncSessionState.ProjectId = saved.ProjectId;
            PlansyncSessionState.ProjectName = saved.ProjectName;
            PlansyncSessionState.FolderId = saved.FolderId;
            PlansyncSessionState.FolderName = saved.FolderName;
        }

        private void RetryQueue_Click(object sender, RoutedEventArgs e)
        {
            PublishCoordinator.RetryOfflineQueue();
            _ = RefreshAsync();
        }

        private void OpenDestination_Click(object sender, RoutedEventArgs e)
        {
            if (PlansyncSessionState.ProjectId is null)
            {
                return;
            }

            Process.Start(new ProcessStartInfo(PlansyncConfig.ProjectFilesUrl(PlansyncSessionState.ProjectId))
            {
                UseShellExecute = true
            });
        }
    }
}
