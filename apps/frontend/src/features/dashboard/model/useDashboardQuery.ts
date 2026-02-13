import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { dashboardService, type DashboardFilters } from "@features/dashboard/api";
import { queryKeys } from "@shared/query";

type HistoryParams = {
  startDate: string;
  endDate: string;
  limit?: number;
  classId?: string;
};

export function useDashboardQuery(params: {
  schoolId: string | null;
  filters: DashboardFilters;
  recentLimit?: number;
  enabled?: boolean;
}) {
  const { schoolId, filters, recentLimit = 10, enabled = true } = params;

  const statsQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.dashboard.stats(schoolId, filters)
      : [...queryKeys.dashboard.all, "stats", "idle"],
    queryFn: () => dashboardService.getStats(schoolId!, filters),
    enabled: Boolean(schoolId) && enabled,
  });

  const recentEventsQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.dashboard.recent(schoolId, recentLimit)
      : [...queryKeys.dashboard.all, "recent", "idle"],
    queryFn: () => dashboardService.getRecentEvents(schoolId!, recentLimit),
    enabled: Boolean(schoolId) && enabled,
  });

  return { statsQuery, recentEventsQuery };
}

export function useDashboardMutations(schoolId: string | null) {
  const queryClient = useQueryClient();

  const loadHistoryMutation = useMutation({
    mutationFn: (params: HistoryParams) =>
      dashboardService.getEventHistory(schoolId!, params),
  });

  const invalidateDashboard = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
  };

  return { loadHistoryMutation, invalidateDashboard };
}
