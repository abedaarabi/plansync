using System.Globalization;
using System.Windows.Data;

namespace PlansyncRevitPlugin.UI.Converters
{
    /// <summary>Inverts a bool — used to drive the opposite radio button of a two-way toggle.</summary>
    public sealed class InverseBooleanConverter : IValueConverter
    {
        public object Convert(object? value, Type targetType, object parameter, CultureInfo culture)
            => !(value is true);

        public object ConvertBack(object? value, Type targetType, object parameter, CultureInfo culture)
            => !(value is true);
    }
}
