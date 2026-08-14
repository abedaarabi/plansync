using System.IO;
using System.Text;

namespace PlansyncRevitPlugin.Services
{
    internal static class UserDefinedPsetWriter
    {
        public static string WriteTempFile(IEnumerable<string> parameterNames)
        {
            string path = Path.Combine(Path.GetTempPath(), $"Plansync_Psets_{Guid.NewGuid():N}.txt");
            var sb = new StringBuilder();
            sb.AppendLine("# Plansync user-defined property set");
            sb.AppendLine("PropertySet:\tPset_Plansync\tI\tIfcElement,IfcProduct,IfcSpatialStructureElement");

            foreach (string name in parameterNames
                         .Where(n => !string.IsNullOrWhiteSpace(n))
                         .Distinct(StringComparer.OrdinalIgnoreCase)
                         .OrderBy(n => n, StringComparer.OrdinalIgnoreCase))
            {
                sb.Append('\t').Append(name.Trim()).Append('\t').AppendLine("Text");
            }

            File.WriteAllText(path, sb.ToString(), Encoding.UTF8);
            return path;
        }
    }
}
