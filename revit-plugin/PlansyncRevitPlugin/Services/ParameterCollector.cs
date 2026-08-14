using Autodesk.Revit.DB;
using PlansyncRevitPlugin.Models;
using PlansyncRevitPlugin.UI.ViewModels;

namespace PlansyncRevitPlugin.Services
{
    internal static class ParameterCollector
    {
        public static List<ParameterItemViewModel> Collect(Document doc)
        {
            var byName = new Dictionary<string, ParameterItemViewModel>(StringComparer.OrdinalIgnoreCase);

            try
            {
                CollectFromBindings(doc, byName);
            }
            catch
            {
                // Bindings map can throw on some documents; keep going.
            }

            try
            {
                CollectFromElements(doc, byName);
            }
            catch
            {
                // Element sampling is best-effort.
            }

            return byName.Values
                .OrderBy(p => p.Kind)
                .ThenBy(p => p.Name, StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static void CollectFromBindings(
            Document doc,
            IDictionary<string, ParameterItemViewModel> byName)
        {
            DefinitionBindingMapIterator iterator = doc.ParameterBindings.ForwardIterator();
            while (iterator.MoveNext())
            {
                try
                {
                    if (iterator.Key is not InternalDefinition definition)
                    {
                        continue;
                    }

                    string name = definition.Name;
                    if (string.IsNullOrWhiteSpace(name))
                    {
                        continue;
                    }

                    ParameterKind kind = definition.Id.Value < 0
                        ? ParameterKind.BuiltIn
                        : IsSharedDefinition(doc, definition)
                            ? ParameterKind.Shared
                            : ParameterKind.Project;

                    string group = GetGroupLabel(definition);
                    AddOrUpgrade(byName, name, kind, group);
                }
                catch
                {
                    // Skip bad definitions.
                }
            }
        }

        private static void CollectFromElements(
            Document doc,
            IDictionary<string, ParameterItemViewModel> byName)
        {
            // Prefer ToElements() over LINQ Take() on collectors — safer with Revit API.
            IList<Element> elements = new FilteredElementCollector(doc)
                .WhereElementIsNotElementType()
                .ToElements();

            IList<Element> types = new FilteredElementCollector(doc)
                .WhereElementIsElementType()
                .ToElements();

            int elementBudget = 0;
            foreach (Element element in elements)
            {
                if (elementBudget++ >= 200)
                {
                    break;
                }

                SampleElementParameters(element, byName);
            }

            int typeBudget = 0;
            foreach (Element element in types)
            {
                if (typeBudget++ >= 100)
                {
                    break;
                }

                SampleElementParameters(element, byName);
            }
        }

        private static void SampleElementParameters(
            Element element,
            IDictionary<string, ParameterItemViewModel> byName)
        {
            try
            {
                foreach (Parameter parameter in element.Parameters)
                {
                    try
                    {
                        Definition? definition = parameter.Definition;
                        if (definition is null)
                        {
                            continue;
                        }

                        string name = definition.Name;
                        if (string.IsNullOrWhiteSpace(name))
                        {
                            continue;
                        }

                        ParameterKind kind = parameter.IsShared
                            ? ParameterKind.Shared
                            : parameter.Id.Value < 0
                                ? ParameterKind.BuiltIn
                                : ParameterKind.Project;

                        string group = definition is InternalDefinition internalDefinition
                            ? GetGroupLabel(internalDefinition)
                            : "Other";

                        AddOrUpgrade(byName, name, kind, group);
                    }
                    catch
                    {
                        // Skip bad parameters.
                    }
                }
            }
            catch
            {
                // Skip bad elements.
            }
        }

        private static string GetGroupLabel(InternalDefinition definition)
        {
            try
            {
                ForgeTypeId groupTypeId = definition.GetGroupTypeId();
                if (groupTypeId is null || groupTypeId.Empty())
                {
                    return "Other";
                }

                string label = LabelUtils.GetLabelForGroup(groupTypeId);
                if (!string.IsNullOrWhiteSpace(label))
                {
                    return label;
                }

                string typeId = groupTypeId.TypeId;
                int colon = typeId.LastIndexOf(':');
                string raw = colon >= 0 ? typeId[(colon + 1)..] : typeId;
                return string.IsNullOrWhiteSpace(raw) ? "Other" : raw;
            }
            catch
            {
                return "Other";
            }
        }

        private static bool IsSharedDefinition(Document doc, InternalDefinition definition)
        {
            try
            {
                Element element = doc.GetElement(definition.Id);
                return element is SharedParameterElement;
            }
            catch
            {
                return false;
            }
        }

        private static void AddOrUpgrade(
            IDictionary<string, ParameterItemViewModel> byName,
            string name,
            ParameterKind kind,
            string group)
        {
            if (byName.TryGetValue(name, out ParameterItemViewModel? existing))
            {
                if (KindRank(kind) < KindRank(existing.Kind))
                {
                    existing.Kind = kind;
                    existing.Group = group;
                }

                return;
            }

            byName[name] = new ParameterItemViewModel
            {
                Name = name,
                Kind = kind,
                Group = string.IsNullOrWhiteSpace(group) ? "Other" : group
            };
        }

        private static int KindRank(ParameterKind kind) => kind switch
        {
            ParameterKind.Shared => 0,
            ParameterKind.Project => 1,
            _ => 2
        };
    }
}
