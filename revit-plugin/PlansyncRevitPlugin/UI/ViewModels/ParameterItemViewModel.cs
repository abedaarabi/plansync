using PlansyncRevitPlugin.Models;

namespace PlansyncRevitPlugin.UI.ViewModels
{
    public sealed class ParameterItemViewModel : ObservableObject
    {
        private bool _isSelected;

        public string Name { get; set; } = string.Empty;
        public ParameterKind Kind { get; set; }
        public string Group { get; set; } = "Other";

        public bool IsSelected
        {
            get => _isSelected;
            set => SetProperty(ref _isSelected, value);
        }

        public string KindLabel => Kind.ToString();
    }
}
