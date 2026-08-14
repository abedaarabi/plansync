namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class ViewItemViewModel : ObservableObject
    {
        private bool _isSelected;

        public long Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Category { get; set; } = "View";
        public string ViewTypeName { get; set; } = string.Empty;
        public string SheetNumber { get; set; } = string.Empty;
        public string SheetName { get; set; } = string.Empty;

        private string _exportFileName = string.Empty;

        public string ExportFileName
        {
            get => _exportFileName;
            set => SetProperty(ref _exportFileName, value);
        }

        public bool IsSelected
        {
            get => _isSelected;
            set => SetProperty(ref _isSelected, value);
        }
    }
}
