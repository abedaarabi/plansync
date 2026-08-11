"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  assignDrawingToLevel,
  createBuilding,
  createBuildingLevel,
  createLocation,
  deleteBuilding,
  deleteBuildingAsset,
  deleteLevelMapping,
  deleteLocation,
  fetchBuilding,
  fetchBuildingAssets,
  fetchBuildingLevels,
  fetchLocationDetail,
  fetchLocations,
  publishBuildingMappings,
  updateBuilding,
  updateBuildingLevel,
  updateLocation,
  linkExistingFileToBuilding,
  type BuildingAssetType,
  type BuildingDiscipline,
  type BuildingInput,
  type BuildingLevel,
  type LevelDisplaySource,
  type LocationInput,
} from "@/lib/api-client/locations";
import { useBimJobTracker } from "@/lib/bim/bimJobTracker";
import { useBimJobPoller } from "@/lib/bim/useBimJobPoller";
import { qk } from "@/lib/queryKeys";
import {
  BUILDING_POLL_MS,
  buildingAssetsFilterKey,
  hasProcessingAssets,
} from "./buildingQueryUtils";

export function invalidateBuildingQueries(
  qc: QueryClient,
  buildingId: string,
  locationId?: string,
) {
  void qc.invalidateQueries({ queryKey: qk.building(buildingId) });
  void qc.invalidateQueries({ queryKey: qk.buildingLevels(buildingId) });
  void qc.invalidateQueries({ queryKey: qk.buildingAssetsRoot(buildingId) });
  void qc.invalidateQueries({ queryKey: ["levelMappings"] });
  if (locationId) void qc.invalidateQueries({ queryKey: qk.locationDetail(locationId) });
}

export function useLocationsQuery(projectId: string) {
  return useQuery({
    queryKey: qk.locations(projectId),
    queryFn: () => fetchLocations(projectId),
  });
}

export function useLocationDetailQuery(locationId: string) {
  return useQuery({
    queryKey: qk.locationDetail(locationId),
    queryFn: () => fetchLocationDetail(locationId),
    refetchInterval: (query) =>
      query.state.data?.buildings.some((b) => b.hasProcessing) ? BUILDING_POLL_MS : false,
  });
}

export function useBuildingQuery(buildingId: string) {
  return useQuery({
    queryKey: qk.building(buildingId),
    queryFn: () => fetchBuilding(buildingId),
  });
}

type AssetFilters = {
  typeFilter: "ALL" | "IFC" | "PDF";
  disciplineFilter: BuildingDiscipline | "ALL";
};

function assetApiFilters(filters: AssetFilters) {
  return {
    type: filters.typeFilter === "ALL" ? undefined : filters.typeFilter,
    discipline:
      filters.disciplineFilter === "ALL" ? undefined : (filters.disciplineFilter ?? undefined),
  };
}

export function useBuildingAssetsQuery(buildingId: string, filters: AssetFilters) {
  const apiFilters = assetApiFilters(filters);
  const filterKey = buildingAssetsFilterKey(apiFilters);

  return useQuery({
    queryKey: qk.buildingAssets(buildingId, filterKey),
    queryFn: () => fetchBuildingAssets(buildingId, apiFilters),
    refetchInterval: (query) =>
      hasProcessingAssets(query.state.data?.assets) ? BUILDING_POLL_MS : false,
  });
}

export function useBuildingLevelsQuery(buildingId: string, poll: boolean) {
  return useQuery({
    queryKey: qk.buildingLevels(buildingId),
    queryFn: () => fetchBuildingLevels(buildingId),
    refetchInterval: (query) => {
      if (!poll) return false;
      if ((query.state.data?.length ?? 0) > 0) return false;
      return BUILDING_POLL_MS;
    },
  });
}

/** Keeps BIM conversion jobs in sync with building asset/level caches. */
export function useBuildingBimJobSync(buildingId: string, locationId: string, projectId: string) {
  const qc = useQueryClient();
  useBimJobPoller();

  useEffect(() => {
    return useBimJobTracker.subscribe((state, prev) => {
      const prevJobs = prev?.jobs ?? {};
      for (const [fvId, job] of Object.entries(state.jobs)) {
        if (job.projectId !== projectId) continue;
        const prevJob = prevJobs[fvId];
        const wasActive =
          prevJob &&
          prevJob.phase !== "ready_to_publish" &&
          prevJob.phase !== "published" &&
          prevJob.phase !== "failed";
        const isTerminal =
          job.phase === "ready_to_publish" || job.phase === "published" || job.phase === "failed";
        if (wasActive && isTerminal) {
          invalidateBuildingQueries(qc, buildingId, locationId);
          void qc.invalidateQueries({ queryKey: qk.assetStatus(fvId) });
        }
      }
      for (const fvId of Object.keys(prevJobs)) {
        if (!state.jobs[fvId] && prevJobs[fvId]?.projectId === projectId) {
          invalidateBuildingQueries(qc, buildingId, locationId);
          void qc.invalidateQueries({ queryKey: qk.assetStatus(fvId) });
        }
      }
    });
  }, [buildingId, locationId, projectId, qc]);
}

export function useCreateLocationMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LocationInput) => createLocation(projectId, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk.locations(projectId) }),
  });
}

export function useUpdateLocationMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & LocationInput) =>
      updateLocation(input.id, {
        name: input.name,
        code: input.code,
        address: input.address,
        city: input.city,
        country: input.country,
        notes: input.notes,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.locations(projectId) });
      void qc.invalidateQueries({ queryKey: qk.locationDetail(vars.id) });
    },
  });
}

export function useCreateBuildingMutation(projectId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BuildingInput) => createBuilding(locationId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.locationDetail(locationId) });
      void qc.invalidateQueries({ queryKey: qk.locations(projectId) });
    },
  });
}

export function useUpdateBuildingMutation(projectId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string } & BuildingInput) =>
      updateBuilding(input.id, {
        name: input.name,
        code: input.code,
        buildingType: input.buildingType,
        floorsApprox: input.floorsApprox,
        notes: input.notes,
      }),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: qk.locationDetail(locationId) });
      void qc.invalidateQueries({ queryKey: qk.locations(projectId) });
      void qc.invalidateQueries({ queryKey: qk.building(vars.id) });
    },
  });
}

export function useDeleteLocationMutation(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (locationId: string) => deleteLocation(locationId),
    onMutate: async (locationId) => {
      await qc.cancelQueries({ queryKey: qk.locations(projectId) });
      const prev = qc.getQueryData<Awaited<ReturnType<typeof fetchLocations>>>(
        qk.locations(projectId),
      );
      if (prev) {
        qc.setQueryData(
          qk.locations(projectId),
          prev.filter((l) => l.id !== locationId),
        );
      }
      return { prev };
    },
    onError: (_err, _locationId, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.locations(projectId), ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.locations(projectId) });
    },
  });
}

export function useDeleteBuildingMutation(projectId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (buildingId: string) => deleteBuilding(buildingId),
    onMutate: async (buildingId) => {
      await qc.cancelQueries({ queryKey: qk.locationDetail(locationId) });
      const prev = qc.getQueryData<Awaited<ReturnType<typeof fetchLocationDetail>>>(
        qk.locationDetail(locationId),
      );
      if (prev) {
        qc.setQueryData(qk.locationDetail(locationId), {
          ...prev,
          buildings: prev.buildings.filter((b) => b.id !== buildingId),
        });
      }
      return { prev };
    },
    onError: (_err, _buildingId, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.locationDetail(locationId), ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.locationDetail(locationId) });
      void qc.invalidateQueries({ queryKey: qk.locations(projectId) });
    },
  });
}

export function useCreateBuildingLevelMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: string | { name: string; elevation?: number }) =>
      typeof input === "string"
        ? createBuildingLevel(buildingId, { name: input })
        : createBuildingLevel(buildingId, input),
    onSuccess: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function useAssignDrawingToLevelMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { levelId: string; fileAssetId: string }) =>
      assignDrawingToLevel(input.levelId, input.fileAssetId),
    onSuccess: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function useUnassignDrawingFromLevelMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (mappingId: string) => deleteLevelMapping(mappingId),
    onSuccess: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function useUpdateBuildingLevelMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { levelId: string; name: string }) =>
      updateBuildingLevel(input.levelId, { name: input.name }),
    onSuccess: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function usePublishBuildingMappingsMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => publishBuildingMappings(buildingId),
    onSuccess: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function useUpdateLevelDisplaySourceMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { levelId: string; displaySource: LevelDisplaySource }) =>
      updateBuildingLevel(input.levelId, { displaySource: input.displaySource }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: qk.buildingLevels(buildingId) });
      const prev = qc.getQueryData<BuildingLevel[]>(qk.buildingLevels(buildingId));
      if (prev) {
        qc.setQueryData(
          qk.buildingLevels(buildingId),
          prev.map((l) =>
            l.id === input.levelId ? { ...l, displaySource: input.displaySource } : l,
          ),
        );
      }
      return { prev };
    },
    onError: (_e, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.buildingLevels(buildingId), ctx.prev);
    },
    onSettled: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function useDeleteBuildingAssetMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) => deleteBuildingAsset(buildingId, fileId),
    onMutate: async (fileId) => {
      await qc.cancelQueries({ queryKey: qk.buildingAssetsRoot(buildingId) });
      const snapshots = qc.getQueriesData<{ assets: { id: string }[]; unmapped: { id: string }[] }>(
        { queryKey: qk.buildingAssetsRoot(buildingId) },
      );
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData(key, {
          assets: data.assets.filter((a) => a.id !== fileId),
          unmapped: data.unmapped.filter((a) => a.id !== fileId),
        });
      }
      return { snapshots };
    },
    onError: (_err, _fileId, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) {
        if (data) qc.setQueryData(key, data);
      }
    },
    onSettled: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}

export function useLinkExistingFileMutation(buildingId: string, locationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { fileId: string; type: BuildingAssetType }) =>
      linkExistingFileToBuilding(buildingId, input.fileId, input.type),
    onSuccess: () => invalidateBuildingQueries(qc, buildingId, locationId),
  });
}
