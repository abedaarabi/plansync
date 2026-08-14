using System.Windows.Media;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Services.Api;

namespace PlansyncRevitPlugin.Services.IssueReview
{
    internal sealed class IssueReviewRequest
    {
        public bool Reset { get; init; }
        public IssueBimAnchor? Anchor { get; init; }
        public string? IssueTitle { get; init; }
        public Action<bool, string>? Completed { get; init; }
    }

    /// <summary>
    /// Opens / resets a reusable 3D review view: section box, isolate, green/red overrides.
    /// Must run on the Revit API thread via <see cref="ExternalEvent"/>.
    /// </summary>
    internal sealed class IssueReviewHandler : IExternalEventHandler
    {
        internal const string ReviewViewName = "Plansync – Issue Review";

        /// <summary>Navisworks-style Item 1 (matches web CLASH_ITEM1_COLOR).</summary>
        private static readonly Color Item1Green = new(0, 175, 0);

        /// <summary>Navisworks-style Item 2 (matches web CLASH_ITEM2_COLOR).</summary>
        private static readonly Color Item2Red = new(255, 0, 0);

        private static readonly object Gate = new();
        private IssueReviewRequest? _pending;

        public void Enqueue(IssueReviewRequest request)
        {
            lock (Gate)
            {
                _pending = request;
            }
        }

        public void Execute(UIApplication app)
        {
            IssueReviewRequest? request;
            lock (Gate)
            {
                request = _pending;
                _pending = null;
            }

            if (request is null)
            {
                return;
            }

            try
            {
                UIDocument? uidoc = app.ActiveUIDocument;
                if (uidoc is null)
                {
                    request.Completed?.Invoke(false, "Open a model in Revit first.");
                    return;
                }

                Document doc = uidoc.Document;
                if (request.Reset)
                {
                    ResetReviewView(uidoc, doc);
                    request.Completed?.Invoke(true, "Review view reset.");
                    return;
                }

                IssueBimAnchor? anchor = request.Anchor;
                if (anchor is null || string.IsNullOrWhiteSpace(anchor.IfcGuid))
                {
                    request.Completed?.Invoke(false, "This issue has no BIM element link.");
                    return;
                }

                var want = new List<string> { anchor.IfcGuid! };
                if (!string.IsNullOrWhiteSpace(anchor.IfcGuidB))
                {
                    want.Add(anchor.IfcGuidB!);
                }

                Dictionary<string, Element> map = IfcGuidResolver.FindByGuids(doc, want);
                string keyA = Normalize(anchor.IfcGuid!);
                map.TryGetValue(keyA, out Element? elA);

                Element? elB = null;
                if (!string.IsNullOrWhiteSpace(anchor.IfcGuidB))
                {
                    map.TryGetValue(Normalize(anchor.IfcGuidB!), out elB);
                }

                // Overrides / temporary isolate only work for elements in the host document.
                Element? hostA = elA is not null && ReferenceEquals(elA.Document, doc) ? elA : null;
                Element? hostB = elB is not null && ReferenceEquals(elB.Document, doc) ? elB : null;

                if (hostA is null && hostB is null)
                {
                    string hint = elA is not null || elB is not null
                        ? "Elements were found in a linked model — open that model (or bind the link) to isolate and color them."
                        : "Could not find linked elements in this model (IFC GUID mismatch). Publish IFC from this project and try again.";
                    request.Completed?.Invoke(false, hint);
                    return;
                }

                View3D view = EnsureReviewView(doc);
                ApplyReview(doc, view, hostA, hostB, anchor);
                uidoc.ActiveView = view;
                ZoomToElements(uidoc, view, hostA, hostB);

                string found =
                    (hostA is null ? 0 : 1) + (hostB is null ? 0 : 1) == want.Count
                        ? "Opened in 3D with green/red highlights."
                        : "Opened in 3D — only one element found in this document.";
                request.Completed?.Invoke(true, found);
            }
            catch (Exception ex)
            {
                request.Completed?.Invoke(false, ex.Message);
            }
        }

        public string GetName() => "Plansync Issue Review";

        private static void ApplyReview(
            Document doc,
            View3D view,
            Element? elA,
            Element? elB,
            IssueBimAnchor anchor)
        {
            using var tx = new Transaction(doc, "Plansync issue review");
            tx.Start();

            view.DisableTemporaryViewMode(TemporaryViewMode.TemporaryHideIsolate);
            view.IsSectionBoxActive = false;

            var ids = new List<ElementId>();
            if (elA is not null)
            {
                ids.Add(elA.Id);
            }

            if (elB is not null)
            {
                ids.Add(elB.Id);
            }

            if (ids.Count > 0)
            {
                view.IsolateElementsTemporary(ids);
            }

            BoundingBoxXYZ? box = BuildSectionBox(elA, elB, anchor.Position);
            if (box is not null)
            {
                view.SetSectionBox(box);
                view.IsSectionBoxActive = true;
            }

            if (elA is not null)
            {
                view.SetElementOverrides(elA.Id, SolidOverride(doc, Item1Green));
            }

            if (elB is not null)
            {
                view.SetElementOverrides(elB.Id, SolidOverride(doc, Item2Red));
            }

            tx.Commit();
        }

        private static void ResetReviewView(UIDocument uidoc, Document doc)
        {
            View3D? view = FindReviewView(doc);
            if (view is null)
            {
                return;
            }

            using var tx = new Transaction(doc, "Reset Plansync review");
            tx.Start();
            view.DisableTemporaryViewMode(TemporaryViewMode.TemporaryHideIsolate);
            view.IsSectionBoxActive = false;
            tx.Commit();
            uidoc.ActiveView = view;
        }

        private static View3D EnsureReviewView(Document doc)
        {
            View3D? existing = FindReviewView(doc);
            if (existing is not null)
            {
                return existing;
            }

            ViewFamilyType? vft = new FilteredElementCollector(doc)
                .OfClass(typeof(ViewFamilyType))
                .Cast<ViewFamilyType>()
                .FirstOrDefault(t => t.ViewFamily == ViewFamily.ThreeDimensional);

            if (vft is null)
            {
                throw new InvalidOperationException("No 3D view type available in this project.");
            }

            using var tx = new Transaction(doc, "Create Plansync review view");
            tx.Start();
            View3D view = View3D.CreateIsometric(doc, vft.Id);
            view.Name = ReviewViewName;
            tx.Commit();
            return view;
        }

        private static View3D? FindReviewView(Document doc) =>
            new FilteredElementCollector(doc)
                .OfClass(typeof(View3D))
                .Cast<View3D>()
                .FirstOrDefault(v => !v.IsTemplate && v.Name == ReviewViewName);

        private static BoundingBoxXYZ? BuildSectionBox(
            Element? elA,
            Element? elB,
            IssuePoint3d? _position)
        {
            // Prefer element bounds (Revit coords). Clash position is IFC/world meters and
            // may not map 1:1 without a transform — bbox isolate is reliable.
            BoundingBoxXYZ? a = elA?.get_BoundingBox(null);
            BoundingBoxXYZ? b = elB?.get_BoundingBox(null);
            if (a is null && b is null)
            {
                return null;
            }

            XYZ min;
            XYZ max;
            if (a is not null && b is not null)
            {
                min = new XYZ(
                    Math.Min(a.Min.X, b.Min.X),
                    Math.Min(a.Min.Y, b.Min.Y),
                    Math.Min(a.Min.Z, b.Min.Z));
                max = new XYZ(
                    Math.Max(a.Max.X, b.Max.X),
                    Math.Max(a.Max.Y, b.Max.Y),
                    Math.Max(a.Max.Z, b.Max.Z));
            }
            else
            {
                BoundingBoxXYZ src = a ?? b!;
                min = src.Min;
                max = src.Max;
            }

            const double padFt = 3.0; // ~1 m padding
            var box = new BoundingBoxXYZ
            {
                Min = new XYZ(min.X - padFt, min.Y - padFt, min.Z - padFt),
                Max = new XYZ(max.X + padFt, max.Y + padFt, max.Z + padFt)
            };
            return box;
        }

        private static OverrideGraphicSettings SolidOverride(Document doc, Color color)
        {
            var ogs = new OverrideGraphicSettings();
            ogs.SetProjectionLineColor(color);
            ogs.SetSurfaceForegroundPatternColor(color);
            ogs.SetSurfaceBackgroundPatternColor(color);
            ogs.SetSurfaceTransparency(0);

            FillPatternElement? solid = new FilteredElementCollector(doc)
                .OfClass(typeof(FillPatternElement))
                .Cast<FillPatternElement>()
                .FirstOrDefault(fp =>
                {
                    FillPattern? pattern = fp.GetFillPattern();
                    return pattern is not null && pattern.IsSolidFill;
                });

            if (solid is not null)
            {
                ogs.SetSurfaceForegroundPatternId(solid.Id);
                ogs.SetSurfaceBackgroundPatternId(solid.Id);
            }

            try
            {
                ogs.SetProjectionLineWeight(6);
            }
            catch
            {
                // Some views disallow weight overrides.
            }

            return ogs;
        }

        private static void ZoomToElements(UIDocument uidoc, View view, Element? elA, Element? elB)
        {
            var ids = new List<ElementId>();
            if (elA is not null)
            {
                ids.Add(elA.Id);
            }

            if (elB is not null)
            {
                ids.Add(elB.Id);
            }

            if (ids.Count == 0)
            {
                return;
            }

            uidoc.ShowElements(ids);
            uidoc.RefreshActiveView();
            _ = view;
        }

        private static string Normalize(string guid) =>
            guid.Trim().Replace("-", string.Empty, StringComparison.Ordinal);
    }

    internal static class IssueReviewService
    {
        private static readonly IssueReviewHandler Handler = new();
        private static ExternalEvent? _externalEvent;

        public static void EnsureInitialized()
        {
            if (_externalEvent is not null)
            {
                return;
            }

            _externalEvent = ExternalEvent.Create(Handler);
        }

        public static void OpenIssue(IssueBimAnchor anchor, string? title, Action<bool, string>? onDone)
        {
            EnsureInitialized();
            Handler.Enqueue(new IssueReviewRequest
            {
                Anchor = anchor,
                IssueTitle = title,
                Completed = onDone
            });
            _externalEvent!.Raise();
        }

        public static void Reset(Action<bool, string>? onDone = null)
        {
            EnsureInitialized();
            Handler.Enqueue(new IssueReviewRequest
            {
                Reset = true,
                Completed = onDone
            });
            _externalEvent!.Raise();
        }

        // Brush helpers for WPF chips (same RGB as Revit overrides).
        public static SolidColorBrush Item1Brush { get; } =
            CreateFrozenBrush(0x00, 0xAF, 0x00);

        public static SolidColorBrush Item2Brush { get; } =
            CreateFrozenBrush(0xFF, 0x00, 0x00);

        private static SolidColorBrush CreateFrozenBrush(byte r, byte g, byte b)
        {
            var brush = new SolidColorBrush(System.Windows.Media.Color.FromRgb(r, g, b));
            brush.Freeze();
            return brush;
        }
    }
}
