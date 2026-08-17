using System.Windows.Media;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using PlansyncRevitPlugin.Services.Api;
using Color = Autodesk.Revit.DB.Color;

namespace PlansyncRevitPlugin.Services.IssueReview
{
    internal enum IssueReviewMode
    {
        OpenIn3d,
        OpenIn2d,
        SectionBox,
        Reset
    }

    internal sealed class IssueReviewRequest
    {
        public IssueReviewMode Mode { get; init; } = IssueReviewMode.OpenIn3d;
        public IssueBimAnchor? Anchor { get; init; }
        public string? IssueTitle { get; init; }
        public bool TightClip { get; init; }
        public Action<bool, string>? Completed { get; init; }
        public Action<bool, string, bool, bool>? CompletedHits { get; init; }
    }

    /// <summary>
    /// Opens / resets a reusable 3D review view or navigates to a 2D plan.
    /// Must run on the Revit API thread via <see cref="ExternalEvent"/>.
    /// </summary>
    internal sealed class IssueReviewHandler : IExternalEventHandler
    {
        internal const string ReviewViewName = "Plansync – Issue Review";

        private static readonly Color Item1Green = new(0, 175, 0);
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
                    Finish(request, false, "Open a model in Revit first.");
                    return;
                }

                Document doc = uidoc.Document;
                if (request.Mode == IssueReviewMode.Reset)
                {
                    ResetReviewView(uidoc, doc);
                    Finish(request, true, "Review view reset.");
                    return;
                }

                IssueBimAnchor? anchor = request.Anchor;
                if (anchor is null || string.IsNullOrWhiteSpace(anchor.IfcGuid))
                {
                    Finish(request, false, "This issue has no BIM element link.");
                    return;
                }

                var want = new List<string> { anchor.IfcGuid! };
                if (!string.IsNullOrWhiteSpace(anchor.IfcGuidB))
                {
                    want.Add(anchor.IfcGuidB!);
                }

                Dictionary<string, IfcGuidHit> map = IfcGuidResolver.FindByGuids(doc, want);
                string keyA = Normalize(anchor.IfcGuid!);
                map.TryGetValue(keyA, out IfcGuidHit? hitA);

                IfcGuidHit? hitB = null;
                if (!string.IsNullOrWhiteSpace(anchor.IfcGuidB))
                {
                    map.TryGetValue(Normalize(anchor.IfcGuidB!), out hitB);
                }

                if (hitA is null && hitB is null)
                {
                    Finish(
                        request,
                        false,
                        "Could not find linked elements in this model (IFC GUID mismatch). Publish IFC from this project and try again.");
                    return;
                }

                bool tight = request.TightClip;
                string message = request.Mode switch
                {
                    IssueReviewMode.OpenIn2d => OpenIn2d(app, uidoc, doc, hitA, hitB),
                    IssueReviewMode.SectionBox => OpenSectionBox(app, uidoc, doc, hitA, hitB, tight),
                    _ => OpenIn3d(app, uidoc, doc, hitA, hitB, want.Count, tight)
                };

                Finish(request, true, message, hitA is not null, hitB is not null);
            }
            catch (Exception ex)
            {
                Finish(request, false, ex.Message);
            }
        }

        public string GetName() => "Plansync Issue Review";

        private static void Finish(
            IssueReviewRequest request,
            bool ok,
            string message,
            bool foundA = false,
            bool foundB = false)
        {
            request.CompletedHits?.Invoke(ok, message, foundA, foundB);
            request.Completed?.Invoke(ok, message);
        }

        private static string OpenIn3d(
            UIApplication app,
            UIDocument uidoc,
            Document doc,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB,
            int wantedCount,
            bool tightClip)
        {
            View3D view = EnsureReviewView(doc);
            ApplyReview(doc, view, hitA, hitB, isolate: true, sectionBox: true, tightClip);
            uidoc.ActiveView = view;
            HighlightAndZoom(app, uidoc, view, hitA, hitB, tightClip);

            bool anyLinked = hitA?.IsLinked == true || hitB?.IsLinked == true;
            int foundCount = (hitA is null ? 0 : 1) + (hitB is null ? 0 : 1);
            return anyLinked
                ? foundCount == wantedCount
                    ? "Opened in 3D (linked model) — isolated and section box framed. Open the link as host for green/red overrides."
                    : "Opened in 3D (linked model) — only one element found; isolated and framed."
                : foundCount == wantedCount
                    ? "Opened in 3D with green/red highlights."
                    : "Opened in 3D — only one element found in this document.";
        }

        private static string OpenSectionBox(
            UIApplication app,
            UIDocument uidoc,
            Document doc,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB,
            bool tightClip)
        {
            View3D view = EnsureReviewView(doc);
            ApplyReview(doc, view, hitA, hitB, isolate: false, sectionBox: true, tightClip);
            uidoc.ActiveView = view;
            HighlightAndZoom(app, uidoc, view, hitA, hitB, tightClip);
            return hitA?.IsLinked == true || hitB?.IsLinked == true
                ? "Section box framed around the linked element(s)."
                : "Section box framed around the issue element(s).";
        }

        private static void ApplyReview(
            Document doc,
            View3D view,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB,
            bool isolate,
            bool sectionBox,
            bool tightClip)
        {
            using var tx = new Transaction(doc, "Plansync issue review");
            tx.Start();

            view.DisableTemporaryViewMode(TemporaryViewMode.TemporaryHideIsolate);
            view.IsSectionBoxActive = false;

            if (isolate)
            {
                var isolateIds = new List<ElementId>();
                CollectIsolateIds(hitA, isolateIds);
                CollectIsolateIds(hitB, isolateIds);
                if (isolateIds.Count > 0)
                {
                    view.IsolateElementsTemporary(isolateIds.Distinct().ToList());
                }
            }

            if (sectionBox)
            {
                BoundingBoxXYZ? box = BuildSectionBox(hitA, hitB, tightClip);
                if (box is not null)
                {
                    view.SetSectionBox(box);
                    view.IsSectionBoxActive = true;
                }
            }

            if (hitA is { IsLinked: false })
            {
                view.SetElementOverrides(hitA.Element.Id, SolidOverride(doc, Item1Green));
            }

            if (hitB is { IsLinked: false })
            {
                view.SetElementOverrides(hitB.Element.Id, SolidOverride(doc, Item2Red));
            }

            tx.Commit();
        }

        private static void CollectIsolateIds(IfcGuidHit? hit, List<ElementId> ids)
        {
            if (hit is null)
            {
                return;
            }

            if (hit.IsLinked)
            {
                ids.Add(hit.LinkInstance!.Id);
            }
            else
            {
                ids.Add(hit.Element.Id);
            }
        }

        private static void HighlightAndZoom(
            UIApplication app,
            UIDocument uidoc,
            View view,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB,
            bool tightClip = false)
        {
            // Selecting the element makes Revit draw temporary dimensions that run off to
            // distant references, so the element is identified with graphics only.
            ClearSelection(uidoc);

            BoundingBoxXYZ? box = tightClip
                ? BuildSectionBox(hitA, hitB, tightClip: true)
                : BuildZoomBox(hitA, hitB);
            if (box is not null && ZoomToBox(uidoc, view, box))
            {
                uidoc.RefreshActiveView();
                return;
            }

            // Last resort only: ShowElements can raise a modal warning dialog.
            ShowHitsQuietly(app, uidoc, hitA, hitB);
            uidoc.RefreshActiveView();
        }

        private static string OpenIn2d(
            UIApplication app,
            UIDocument uidoc,
            Document doc,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB)
        {
            View? candidate = PickBest2dView(uidoc, doc, hitA, hitB);
            if (candidate is null)
            {
                throw new InvalidOperationException(
                    "No compatible 2D plan, section, or elevation can display this element.");
            }

            uidoc.ActiveView = candidate;

            // Thick colored outlines so the element is obvious on the plan (host only).
            Apply2dHighlight(doc, candidate, hitA, hitB);
            ClearSelection(uidoc);

            BoundingBoxXYZ? box = BuildZoomBox(hitA, hitB);
            if (box is null || !ZoomToBox(uidoc, candidate, box))
            {
                ShowHitsQuietly(app, uidoc, hitA, hitB);
            }

            uidoc.RefreshActiveView();

            bool linked = hitA?.IsLinked == true || hitB?.IsLinked == true;
            return linked
                ? $"Opened “{candidate.Name}” and zoomed to the linked element. Visibility depends on this view's link settings."
                : $"Opened “{candidate.Name}” and zoomed to the issue element.";
        }

        /// <summary>
        /// Cheap-first ranking. A visibility probe per view is expensive in large models,
        /// so it only runs on a handful of best cheap candidates.
        /// </summary>
        private static View? PickBest2dView(
            UIDocument uidoc,
            Document doc,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB)
        {
            const int probeLimit = 6;
            View? active = uidoc.ActiveView;
            ElementId? preferredLevelId = GetPreferredLevelId(hitA) ?? GetPreferredLevelId(hitB);

            List<View> ranked = new FilteredElementCollector(doc)
                .OfClass(typeof(View))
                .Cast<View>()
                .Where(IsEligible2dView)
                .OrderByDescending(view => CheapScore(view, active, preferredLevelId))
                .ToList();

            if (ranked.Count == 0)
            {
                return null;
            }

            ICollection<ElementId> probeIds = CollectProbeIds(hitA, hitB);
            foreach (View view in ranked.Take(probeLimit))
            {
                if (ContainsAnyId(doc, view, probeIds))
                {
                    return view;
                }
            }

            // Fall back to the best cheap candidate (typical for linked elements, where the
            // link instance may not be reported by a view-scoped collector).
            return ranked[0];
        }

        private static int CheapScore(View view, View? active, ElementId? preferredLevelId)
        {
            int score = view is ViewPlan ? 40 : 10;
            if (active is not null && active.Id == view.Id)
            {
                score += 5;
            }

            if (view is ViewPlan plan && preferredLevelId is not null)
            {
                try
                {
                    Level? level = plan.GenLevel;
                    if (level is not null)
                    {
                        score += level.Id == preferredLevelId ? 100 : -60;
                    }
                }
                catch
                {
                    // GenLevel is not valid for every plan type.
                }
            }

            return score;
        }

        private static ICollection<ElementId> CollectProbeIds(IfcGuidHit? hitA, IfcGuidHit? hitB)
        {
            var ids = new List<ElementId>();
            AddProbeId(hitA, ids);
            AddProbeId(hitB, ids);
            return ids;
        }

        private static void AddProbeId(IfcGuidHit? hit, List<ElementId> ids)
        {
            if (hit is null)
            {
                return;
            }

            ids.Add(hit.IsLinked ? hit.LinkInstance!.Id : hit.Element.Id);
        }

        /// <summary>Id-filtered view probe — never enumerates the whole view.</summary>
        private static bool ContainsAnyId(Document doc, View view, ICollection<ElementId> ids)
        {
            if (ids.Count == 0)
            {
                return false;
            }

            try
            {
                return new FilteredElementCollector(doc, view.Id)
                    .WherePasses(new ElementIdSetFilter(ids))
                    .FirstElementId() != ElementId.InvalidElementId;
            }
            catch
            {
                // Never fall back to a full scan; that is what froze the UI.
                return false;
            }
        }

        private static ElementId? GetPreferredLevelId(IfcGuidHit? hit)
        {
            if (hit is null)
            {
                return null;
            }

            Element el = hit.Element;
            Parameter? levelParam =
                el.get_Parameter(BuiltInParameter.FAMILY_LEVEL_PARAM)
                ?? el.get_Parameter(BuiltInParameter.SCHEDULE_LEVEL_PARAM)
                ?? el.get_Parameter(BuiltInParameter.LEVEL_PARAM);

            ElementId? id = levelParam?.AsElementId();
            if (id is not null && id != ElementId.InvalidElementId)
            {
                return id;
            }

            if (el.LevelId != ElementId.InvalidElementId)
            {
                return el.LevelId;
            }

            return null;
        }

        private static void Apply2dHighlight(
            Document doc,
            View view,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB)
        {
            using var tx = new Transaction(doc, "Plansync 2D highlight");
            tx.Start();

            if (hitA is { IsLinked: false })
            {
                view.SetElementOverrides(hitA.Element.Id, LineHighlightOverride(Item1Green));
            }

            if (hitB is { IsLinked: false })
            {
                view.SetElementOverrides(hitB.Element.Id, LineHighlightOverride(Item2Red));
            }

            tx.Commit();
        }

        private static OverrideGraphicSettings LineHighlightOverride(Color color)
        {
            var ogs = new OverrideGraphicSettings();
            ogs.SetProjectionLineColor(color);
            ogs.SetCutLineColor(color);
            try
            {
                ogs.SetProjectionLineWeight(8);
                ogs.SetCutLineWeight(8);
            }
            catch
            {
                // Some views reject weight overrides.
            }

            return ogs;
        }

        private static void ClearSelection(UIDocument uidoc)
        {
            try
            {
                uidoc.Selection.SetElementIds(new List<ElementId>());
            }
            catch
            {
                // Selection may be locked by the host.
            }
        }

        /// <summary>
        /// ShowElements pops a modal "no open view" warning when it cannot comply, which looks
        /// like a frozen Revit from a dockable pane. Auto-dismiss any dialog it raises.
        /// </summary>
        private static void ShowHitsQuietly(
            UIApplication app,
            UIDocument uidoc,
            IfcGuidHit? hitA,
            IfcGuidHit? hitB)
        {
            var ids = (List<ElementId>)CollectProbeIds(hitA, hitB);
            if (ids.Count == 0)
            {
                return;
            }

            void Dismiss(object? sender, Autodesk.Revit.UI.Events.DialogBoxShowingEventArgs e)
            {
                try
                {
                    e.OverrideResult(1);
                }
                catch
                {
                    // Not every dialog supports an override result.
                }
            }

            app.DialogBoxShowing += Dismiss;
            try
            {
                uidoc.ShowElements(ids.Distinct().ToList());
            }
            catch
            {
                // Zoom already attempted.
            }
            finally
            {
                app.DialogBoxShowing -= Dismiss;
            }
        }

        private static bool IsEligible2dView(View view)
        {
            if (view.IsTemplate)
            {
                return false;
            }

            return view.ViewType is ViewType.FloorPlan
                or ViewType.CeilingPlan
                or ViewType.EngineeringPlan
                or ViewType.AreaPlan
                or ViewType.Section
                or ViewType.Elevation;
        }

        /// <summary>
        /// Framing for navigation only: centred on the element but capped, so a long run
        /// (pipe, wall, duct) does not zoom the whole level out of usable scale.
        /// </summary>
        private static BoundingBoxXYZ? BuildZoomBox(IfcGuidHit? hitA, IfcGuidHit? hitB)
        {
            BoundingBoxXYZ? box = BuildSectionBox(hitA, hitB, tightClip: false);
            if (box is null)
            {
                return null;
            }

            static double Half(double lo, double hi)
            {
                const double minHalfFt = 8.0;
                const double maxHalfFt = 25.0;
                double half = Math.Abs(hi - lo) * 0.5;
                return Math.Min(Math.Max(half, minHalfFt), maxHalfFt);
            }

            XYZ center = (box.Min + box.Max) * 0.5;
            double hx = Half(box.Min.X, box.Max.X);
            double hy = Half(box.Min.Y, box.Max.Y);
            double hz = Half(box.Min.Z, box.Max.Z);

            return new BoundingBoxXYZ
            {
                Min = new XYZ(center.X - hx, center.Y - hy, center.Z - hz),
                Max = new XYZ(center.X + hx, center.Y + hy, center.Z + hz)
            };
        }

        private static bool ZoomToBox(UIDocument uidoc, View view, BoundingBoxXYZ box)
        {
            XYZ min = box.Min;
            XYZ max = box.Max;

            UIView? uiView = uidoc.GetOpenUIViews().FirstOrDefault(v => v.ViewId == view.Id);
            if (uiView is null)
            {
                return false;
            }

            try
            {
                // Plan views need corners on a single plane to center correctly.
                if (view is ViewPlan)
                {
                    uiView.ZoomAndCenterRectangle(
                        new XYZ(min.X, min.Y, 0),
                        new XYZ(max.X, max.Y, 0));
                }
                else
                {
                    uiView.ZoomAndCenterRectangle(
                        new XYZ(min.X, min.Y, min.Z),
                        new XYZ(max.X, max.Y, max.Z));
                }

                return true;
            }
            catch
            {
                return false;
            }
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

            ClearSelection(uidoc);
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

        /// <summary>
        /// Clash review uses a tight cube at the two-element closest approach (Revit coords).
        /// IFC viewer points are a different coordinate system, so they are not applied here.
        /// Issues without tight clip keep a padded union of both element boxes.
        /// </summary>
        private static BoundingBoxXYZ? BuildSectionBox(
            IfcGuidHit? hitA,
            IfcGuidHit? hitB,
            bool tightClip)
        {
            BoundingBoxXYZ? a = hitA?.GetHostBoundingBox();
            BoundingBoxXYZ? b = hitB?.GetHostBoundingBox();
            if (a is null && b is null)
            {
                return null;
            }

            if (tightClip)
            {
                XYZ center = ContactCenter(a, b);
                const double halfFt = 8.0;
                return new BoundingBoxXYZ
                {
                    Min = new XYZ(center.X - halfFt, center.Y - halfFt, center.Z - halfFt),
                    Max = new XYZ(center.X + halfFt, center.Y + halfFt, center.Z + halfFt)
                };
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

            const double padFt = 3.0;
            return new BoundingBoxXYZ
            {
                Min = new XYZ(min.X - padFt, min.Y - padFt, min.Z - padFt),
                Max = new XYZ(max.X + padFt, max.Y + padFt, max.Z + padFt)
            };
        }

        private static XYZ ContactCenter(BoundingBoxXYZ? a, BoundingBoxXYZ? b)
        {
            if (a is not null && b is not null)
            {
                return new XYZ(
                    Closest1D(a.Min.X, a.Max.X, b.Min.X, b.Max.X),
                    Closest1D(a.Min.Y, a.Max.Y, b.Min.Y, b.Max.Y),
                    Closest1D(a.Min.Z, a.Max.Z, b.Min.Z, b.Max.Z));
            }

            BoundingBoxXYZ src = a ?? b!;
            return (src.Min + src.Max) * 0.5;
        }

        private static double Closest1D(double a0, double a1, double b0, double b1)
        {
            if (a1 < b0)
            {
                return (a1 + b0) * 0.5;
            }

            if (b1 < a0)
            {
                return (b1 + a0) * 0.5;
            }

            double lo = Math.Max(a0, b0);
            double hi = Math.Min(a1, b1);
            return (lo + hi) * 0.5;
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

        public static void OpenClash(
            IssueBimAnchor anchor,
            string? title,
            Action<bool, string, bool, bool>? onDone)
        {
            Raise(new IssueReviewRequest
            {
                Mode = IssueReviewMode.OpenIn3d,
                Anchor = anchor,
                IssueTitle = title,
                TightClip = true,
                CompletedHits = onDone
            });
        }

        public static void OpenClashSectionBox(
            IssueBimAnchor anchor,
            Action<bool, string, bool, bool>? onDone)
        {
            Raise(new IssueReviewRequest
            {
                Mode = IssueReviewMode.SectionBox,
                Anchor = anchor,
                TightClip = true,
                CompletedHits = onDone
            });
        }

        public static void OpenIssue(IssueBimAnchor anchor, string? title, Action<bool, string>? onDone)
        {
            Raise(new IssueReviewRequest
            {
                Mode = IssueReviewMode.OpenIn3d,
                Anchor = anchor,
                IssueTitle = title,
                Completed = onDone
            });
        }

        public static void OpenIn2d(IssueBimAnchor anchor, Action<bool, string>? onDone)
        {
            Raise(new IssueReviewRequest
            {
                Mode = IssueReviewMode.OpenIn2d,
                Anchor = anchor,
                Completed = onDone
            });
        }

        public static void OpenSectionBox(IssueBimAnchor anchor, Action<bool, string>? onDone)
        {
            Raise(new IssueReviewRequest
            {
                Mode = IssueReviewMode.SectionBox,
                Anchor = anchor,
                Completed = onDone
            });
        }

        public static void Reset(Action<bool, string>? onDone = null)
        {
            Raise(new IssueReviewRequest
            {
                Mode = IssueReviewMode.Reset,
                Completed = onDone
            });
        }

        private static void Raise(IssueReviewRequest request)
        {
            EnsureInitialized();
            Handler.Enqueue(request);
            _externalEvent!.Raise();
        }

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
