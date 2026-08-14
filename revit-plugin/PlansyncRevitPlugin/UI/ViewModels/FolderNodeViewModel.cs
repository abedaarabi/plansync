using System.Collections.ObjectModel;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class FolderNodeViewModel : ObservableObject
    {
        public string? Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public ObservableCollection<FolderNodeViewModel> Children { get; } = new();
    }
}
