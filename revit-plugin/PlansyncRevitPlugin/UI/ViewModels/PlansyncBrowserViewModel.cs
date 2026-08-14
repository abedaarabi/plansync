using System.Collections.ObjectModel;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.Services;
using PlansyncRevitPlugin.Services.Api;
using PlansyncRevitPlugin.Services.Auth;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class PlansyncBrowserViewModel : ObservableObject
    {
        private readonly PlansyncApiClient _api = new();
        private WorkspaceMembership? _selectedWorkspace;
        private ProjectInfo? _selectedProject;
        private FolderNodeViewModel? _selectedFolder;
        private string _statusText = string.Empty;
        private bool _isBusy;
        private string _userEmail = string.Empty;

        public PlansyncBrowserViewModel(MeResponse me)
        {
            Me = me;
            UserEmail = me.User?.Email ?? string.Empty;
            Workspaces = new ObservableCollection<WorkspaceMembership>(me.Workspaces);
            Projects = new ObservableCollection<ProjectInfo>();
            FolderRoots = new ObservableCollection<FolderNodeViewModel>();

            DestinationSettings saved = ExportSettingsStore.Load().Destination;
            SelectedWorkspace = Workspaces.FirstOrDefault(w => w.WorkspaceId == saved.WorkspaceId)
                                ?? Workspaces.FirstOrDefault();
        }

        public MeResponse Me { get; }

        public ObservableCollection<WorkspaceMembership> Workspaces { get; }
        public ObservableCollection<ProjectInfo> Projects { get; }
        public ObservableCollection<FolderNodeViewModel> FolderRoots { get; }

        public string UserEmail
        {
            get => _userEmail;
            private set => SetProperty(ref _userEmail, value);
        }

        public WorkspaceMembership? SelectedWorkspace
        {
            get => _selectedWorkspace;
            set
            {
                if (!SetProperty(ref _selectedWorkspace, value))
                {
                    return;
                }

                _ = LoadProjectsAsync();
            }
        }

        public ProjectInfo? SelectedProject
        {
            get => _selectedProject;
            set
            {
                if (!SetProperty(ref _selectedProject, value))
                {
                    return;
                }

                BuildFolderTree();
            }
        }

        public FolderNodeViewModel? SelectedFolder
        {
            get => _selectedFolder;
            set
            {
                SetProperty(ref _selectedFolder, value);
                OnPropertyChanged(nameof(CanExport));
                OnPropertyChanged(nameof(CanCreateFolder));
                OnPropertyChanged(nameof(DestinationSummary));
            }
        }

        public string StatusText
        {
            get => _statusText;
            private set => SetProperty(ref _statusText, value);
        }

        public bool IsBusy
        {
            get => _isBusy;
            private set
            {
                SetProperty(ref _isBusy, value);
                OnPropertyChanged(nameof(CanExport));
                OnPropertyChanged(nameof(CanCreateFolder));
            }
        }

        public bool CanExport => !IsBusy && SelectedWorkspace is not null && SelectedProject is not null && SelectedFolder is not null;

        public bool CanCreateFolder =>
            !IsBusy && SelectedWorkspace is not null && SelectedProject is not null && SelectedFolder is not null;

        public string DestinationSummary
        {
            get
            {
                if (SelectedWorkspace is null || SelectedProject is null || SelectedFolder is null)
                {
                    return "Select a workspace, project, and folder.";
                }

                return $"{SelectedWorkspace.Workspace?.Name ?? SelectedWorkspace.WorkspaceId} / {SelectedProject.Name} / {SelectedFolder.Name}";
            }
        }

        public void ApplySelectionToSession()
        {
            if (SelectedWorkspace is null || SelectedProject is null || SelectedFolder is null)
            {
                return;
            }

            PlansyncSessionState.Me = Me;
            PlansyncSessionState.WorkspaceId = SelectedWorkspace.WorkspaceId;
            PlansyncSessionState.WorkspaceName = SelectedWorkspace.Workspace?.Name ?? SelectedWorkspace.WorkspaceId;
            PlansyncSessionState.ProjectId = SelectedProject.Id;
            PlansyncSessionState.ProjectName = SelectedProject.Name;
            PlansyncSessionState.FolderId = SelectedFolder.Id;
            PlansyncSessionState.FolderName = SelectedFolder.Name;

            PersistedExportSettings settings = ExportSettingsStore.Load();
            settings.Destination = new DestinationSettings
            {
                WorkspaceId = PlansyncSessionState.WorkspaceId,
                WorkspaceName = PlansyncSessionState.WorkspaceName,
                ProjectId = PlansyncSessionState.ProjectId,
                ProjectName = PlansyncSessionState.ProjectName,
                FolderId = PlansyncSessionState.FolderId,
                FolderName = PlansyncSessionState.FolderName
            };
            ExportSettingsStore.Save(settings);
        }

        public async Task<bool> CreateFolderAsync(string name)
        {
            if (SelectedProject is null || SelectedFolder is null)
            {
                return false;
            }

            IsBusy = true;
            StatusText = "Creating folder…";
            try
            {
                FolderInfo created = await _api
                    .CreateFolderAsync(SelectedProject.Id, name, SelectedFolder.Id)
                    .ConfigureAwait(true);

                SelectedProject.Folders.Add(new FolderInfo
                {
                    Id = created.Id,
                    Name = created.Name,
                    ParentId = created.ParentId ?? SelectedFolder.Id,
                    CanAccess = true
                });

                string? selectId = created.Id;
                BuildFolderTree();
                SelectedFolder = FolderRoots
                    .Select(root => FindFolder(root, selectId))
                    .FirstOrDefault(f => f is not null)
                    ?? SelectedFolder;

                StatusText = $"Created “{created.Name}”";
                return true;
            }
            catch (Exception ex)
            {
                StatusText = ex.Message;
                return false;
            }
            finally
            {
                IsBusy = false;
            }
        }

        private async Task LoadProjectsAsync()
        {
            Projects.Clear();
            FolderRoots.Clear();
            SelectedProject = null;
            SelectedFolder = null;

            if (SelectedWorkspace is null)
            {
                return;
            }

            IsBusy = true;
            StatusText = "Loading projects…";
            try
            {
                List<ProjectInfo> projects = await _api
                    .GetProjectsAsync(SelectedWorkspace.WorkspaceId)
                    .ConfigureAwait(true);

                foreach (ProjectInfo project in projects.OrderBy(p => p.Name))
                {
                    Projects.Add(project);
                }

                DestinationSettings saved = ExportSettingsStore.Load().Destination;
                SelectedProject = Projects.FirstOrDefault(p => p.Id == saved.ProjectId)
                                  ?? Projects.FirstOrDefault();
                StatusText = $"{Projects.Count} project(s)";
            }
            catch (Exception ex)
            {
                StatusText = ex.Message;
            }
            finally
            {
                IsBusy = false;
            }
        }

        private void BuildFolderTree()
        {
            FolderRoots.Clear();
            SelectedFolder = null;

            if (SelectedProject is null)
            {
                return;
            }

            var root = new FolderNodeViewModel
            {
                Id = null,
                Name = "(project root)"
            };

            var byParent = SelectedProject.Folders
                .Where(f => f.CanAccess != false)
                .GroupBy(f => f.ParentId ?? string.Empty)
                .ToDictionary(g => g.Key, g => g.OrderBy(f => f.Name).ToList());

            void AddChildren(FolderNodeViewModel parent)
            {
                string key = parent.Id ?? string.Empty;
                if (!byParent.TryGetValue(key, out List<FolderInfo>? children))
                {
                    return;
                }

                foreach (FolderInfo child in children)
                {
                    var node = new FolderNodeViewModel
                    {
                        Id = child.Id,
                        Name = child.Name
                    };
                    parent.Children.Add(node);
                    AddChildren(node);
                }
            }

            AddChildren(root);
            FolderRoots.Add(root);

            DestinationSettings saved = ExportSettingsStore.Load().Destination;
            SelectedFolder = FindFolder(root, saved.FolderId) ?? root;
        }

        private static FolderNodeViewModel? FindFolder(FolderNodeViewModel node, string? folderId)
        {
            if (node.Id == folderId)
            {
                return node;
            }

            foreach (FolderNodeViewModel child in node.Children)
            {
                FolderNodeViewModel? found = FindFolder(child, folderId);
                if (found is not null)
                {
                    return found;
                }
            }

            return null;
        }
    }
}
