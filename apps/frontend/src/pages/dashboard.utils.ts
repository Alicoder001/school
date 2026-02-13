import dayjs from "dayjs";
import type { AttendanceEvent, DashboardStats } from "@shared/types";

const STATUS_COLORS = {
  PRESENT: "#52c41a",
  LATE: "#fa8c16",
  ABSENT: "#ff4d4f",
  EXCUSED: "#8c8c8c",
} as const;

const PENDING_STATUS_COLORS = {
  PENDING_EARLY: "#d9d9d9",
  PENDING_LATE: "#fadb14",
} as const;

export const PIE_COLORS: Record<string, string> = {
  Kelgan: STATUS_COLORS.PRESENT,
  "Kech qoldi": STATUS_COLORS.LATE,
  Kechikmoqda: PENDING_STATUS_COLORS.PENDING_LATE,
  Kelmadi: STATUS_COLORS.ABSENT,
  Sababli: STATUS_COLORS.EXCUSED,
  "Hali kelmagan": PENDING_STATUS_COLORS.PENDING_EARLY,
};

export const getEventStudentLabel = (event: AttendanceEvent) => {
  const raw: any = event.rawPayload || {};
  const fromAccess = raw.AccessControllerEvent || raw.accessControllerEvent || raw;
  return event.student?.name || fromAccess?.name || fromAccess?.employeeNoString || event.studentId || "?";
};

const toNum = (value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export const buildDashboardDerivedData = (stats: DashboardStats) => {
  const totalStudents = toNum(stats.totalStudents);
  const presentToday = toNum(stats.presentToday);
  const lateToday = toNum(stats.lateToday);
  const absentToday = toNum(stats.absentToday);
  const excusedToday = toNum(stats.excusedToday);
  const pendingEarlyCount =
    stats.pendingEarlyCount !== undefined ? toNum(stats.pendingEarlyCount) : 0;
  const latePendingCount =
    stats.latePendingCount !== undefined ? toNum(stats.latePendingCount) : 0;
  const notYetArrivedCount =
    stats.notYetArrivedCount !== undefined
      ? toNum(stats.notYetArrivedCount)
      : pendingEarlyCount + latePendingCount || Math.max(0, totalStudents - (presentToday + absentToday + excusedToday));

  const pieData = [
    { name: "Kelgan", value: presentToday },
    { name: "Kech qoldi", value: lateToday },
    { name: "Kechikmoqda", value: latePendingCount },
    { name: "Kelmadi", value: absentToday },
    { name: "Sababli", value: excusedToday },
    { name: "Hali kelmagan", value: pendingEarlyCount },
  ];

  const weeklyData =
    stats.weeklyStats && stats.weeklyStats.length > 0
      ? stats.weeklyStats
      : Array.from({ length: 7 }).map((_, idx) => {
          const date = dayjs().subtract(6 - idx, "day");
          return {
            date: date.format("YYYY-MM-DD"),
            dayName: date.format("dd"),
            present: 0,
            late: 0,
            absent: 0,
          };
        });

  return {
    pendingEarlyCount,
    latePendingCount,
    notYetArrivedCount,
    pieData,
    pieHasData: pieData.some((d) => d.value > 0),
    weeklyData,
  };
};
