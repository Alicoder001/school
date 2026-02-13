import type { PeriodType } from "@shared/types";

type DashboardFilters = {
  classId?: string;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
  scope?: "started" | "active";
};

type StudentsFilters = {
  schoolId: string;
  page: number;
  search?: string;
  classId?: string;
  period?: PeriodType;
  startDate?: string;
  endDate?: string;
};

type DevicesFilters = {
  schoolId: string;
};

export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    stats: (schoolId: string, filters: DashboardFilters) =>
      [...queryKeys.dashboard.all, "stats", schoolId, filters] as const,
    recent: (schoolId: string, limit: number) =>
      [...queryKeys.dashboard.all, "recent", schoolId, limit] as const,
    history: (
      schoolId: string,
      params: { startDate: string; endDate: string; limit?: number; classId?: string },
    ) => [...queryKeys.dashboard.all, "history", schoolId, params] as const,
  },
  students: {
    all: ["students"] as const,
    list: (filters: StudentsFilters) => [...queryKeys.students.all, "list", filters] as const,
    detail: (id: string) => [...queryKeys.students.all, "detail", id] as const,
    classes: (schoolId: string) => [...queryKeys.students.all, "classes", schoolId] as const,
  },
  devices: {
    all: ["devices"] as const,
    list: (filters: DevicesFilters) => [...queryKeys.devices.all, "list", filters] as const,
    webhook: (schoolId: string) => [...queryKeys.devices.all, "webhook", schoolId] as const,
  },
} as const;
