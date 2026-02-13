import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Badge,
  Button,
  Calendar,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import {
  Activity,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  TrendingUp,
  Users2,
} from "lucide-react";
import { useSchool } from "@entities/school";
import { classesService } from "@entities/class";
import { schoolsService } from "@entities/school";
import { useAttendanceSSE } from "@features/realtime";
import {
  useDashboardMutations,
  useDashboardQuery,
} from "@features/dashboard";
import { queryKeys } from "@shared/query";
import type {
  AttendanceEvent,
  AttendanceScope,
  PeriodType,
} from "@shared/types";
import { cn } from "@shared/lib";
import { useHeaderMeta } from "@shared/ui/useHeaderMeta";
import { buildDashboardDerivedData, PIE_COLORS } from "@pages/dashboard.utils";

const PERIOD_OPTIONS: Array<{ label: string; value: PeriodType }> = [
  { label: "Bugun", value: "today" },
  { label: "Kecha", value: "yesterday" },
  { label: "Hafta", value: "week" },
  { label: "Oy", value: "month" },
  { label: "Yil", value: "year" },
  { label: "Custom", value: "custom" },
];

const CHART_COLORS = {
  present: "var(--color-success)",
  late: "var(--color-warning)",
  absent: "var(--color-danger)",
  fallback: "var(--color-border)",
} as const;

function getEventStudentLabel(event: AttendanceEvent): string {
  const rawPayload = event.rawPayload as
    | { AccessControllerEvent?: { name?: string; employeeNoString?: string }; accessControllerEvent?: { name?: string; employeeNoString?: string } }
    | undefined;
  const fromAccess =
    rawPayload?.AccessControllerEvent ||
    rawPayload?.accessControllerEvent;
  return (
    event.student?.name ||
    fromAccess?.name ||
    fromAccess?.employeeNoString ||
    event.studentId ||
    "Noma'lum"
  );
}

export default function DashboardV2() {
  const navigate = useNavigate();
  const { schoolId } = useSchool();
  const { setMeta, setRefresh, setLastUpdated } = useHeaderMeta();
  const [selectedClassId, setSelectedClassId] = useState<string | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [attendanceScope, setAttendanceScope] = useState<AttendanceScope>("started");
  const [customStartDate, setCustomStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [customEndDate, setCustomEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState(dayjs().subtract(6, "day").format("YYYY-MM-DD"));
  const [historyEndDate, setHistoryEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [events, setEvents] = useState<AttendanceEvent[]>([]);

  const isToday = selectedPeriod === "today";

  const filters = useMemo(() => {
    const result: {
      classId?: string;
      period?: PeriodType;
      startDate?: string;
      endDate?: string;
      scope?: AttendanceScope;
    } = {
      period: selectedPeriod,
      classId: selectedClassId,
    };

    if (selectedPeriod === "today") {
      result.scope = attendanceScope;
    }

    if (selectedPeriod === "custom") {
      result.startDate = customStartDate;
      result.endDate = customEndDate;
    }

    return result;
  }, [selectedClassId, selectedPeriod, attendanceScope, customStartDate, customEndDate]);

  const classesQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.students.classes(schoolId)
      : [...queryKeys.students.all, "classes", "idle"],
    queryFn: () => classesService.getAll(schoolId!),
    enabled: Boolean(schoolId),
  });

  const schoolQuery = useQuery({
    queryKey: schoolId
      ? [...queryKeys.dashboard.all, "school", schoolId]
      : [...queryKeys.dashboard.all, "school", "idle"],
    queryFn: () => schoolsService.getById(schoolId!),
    enabled: Boolean(schoolId),
  });

  const { statsQuery, recentEventsQuery } = useDashboardQuery({
    schoolId,
    filters,
    recentLimit: 10,
  });
  const { loadHistoryMutation, invalidateDashboard } = useDashboardMutations(schoolId);
  const refreshActionRef = useRef<() => Promise<void>>(async () => {});

  const { isConnected } = useAttendanceSSE(schoolId, {
    enabled: isToday,
    onEvent: (event) => {
      if (!event) return;
      const normalizedEvent = event as AttendanceEvent;
      setEvents((prev) =>
        [normalizedEvent, ...prev.filter((item) => item.id !== normalizedEvent.id)].slice(0, 10),
      );
      void invalidateDashboard();
    },
  });

  useEffect(() => {
    let cancelled = false;

    if (selectedPeriod === "today") {
      setEvents(recentEventsQuery.data ?? []);
      return () => {
        cancelled = true;
      };
    }

    if (!schoolId) {
      setEvents([]);
      return () => {
        cancelled = true;
      };
    }

    const startDate = selectedPeriod === "custom" ? customStartDate : statsQuery.data?.startDate;
    const endDate = selectedPeriod === "custom" ? customEndDate : statsQuery.data?.endDate;

    if (!startDate || !endDate) {
      setEvents([]);
      return () => {
        cancelled = true;
      };
    }

    void loadHistoryMutation
      .mutateAsync({
        startDate,
        endDate,
        classId: selectedClassId,
        limit: 10,
      })
      .then((response) => {
        if (!cancelled) {
          setEvents(response.data ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEvents([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedPeriod,
    schoolId,
    customStartDate,
    customEndDate,
    selectedClassId,
    statsQuery.data?.startDate,
    statsQuery.data?.endDate,
    recentEventsQuery.data,
    loadHistoryMutation,
  ]);

  useEffect(() => {
    setMeta({
      showLiveStatus: isToday,
      isConnected,
    });
    return () => setMeta({ showLiveStatus: false, isConnected: false });
  }, [isToday, isConnected, setMeta]);

  useEffect(() => {
    refreshActionRef.current = async () => {
      await Promise.all([statsQuery.refetch(), recentEventsQuery.refetch()]);
      setLastUpdated(new Date());
    };
  }, [statsQuery, recentEventsQuery, setLastUpdated]);

  useEffect(() => {
    const handleRefresh = () => refreshActionRef.current();
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [setRefresh]);

  useEffect(() => {
    if (statsQuery.data || recentEventsQuery.data) {
      setLastUpdated(new Date());
    }
  }, [statsQuery.data, recentEventsQuery.data, setLastUpdated]);

  const stats = statsQuery.data;
  const derived = stats ? buildDashboardDerivedData(stats) : null;
  const school = schoolQuery.data ?? null;
  const notYetArrived = stats?.notYetArrived ?? [];
  const notYetArrivedCount = derived?.notYetArrivedCount ?? 0;

  const handleHistorySearch = useCallback(async () => {
    if (!schoolId) return;
    await loadHistoryMutation.mutateAsync({
      startDate: historyStartDate,
      endDate: historyEndDate,
      classId: selectedClassId,
      limit: 300,
    });
  }, [schoolId, loadHistoryMutation, historyStartDate, historyEndDate, selectedClassId]);

  const navigateToStudent = useCallback(
    (event: AttendanceEvent) => {
      const studentId = event.student?.id || event.studentId;
      if (!studentId || !schoolId) return;
      navigate(`/schools/${schoolId}/students/${studentId}`);
    },
    [navigate, schoolId],
  );

  if (!schoolId) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted">Maktab aniqlanmadi.</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-border/70 bg-card/95 p-3 shadow-sm">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight md:text-xl">Davomat Dashboard</h1>
            <p className="mt-0.5 text-xs text-muted">
              Maktab bo'yicha real-time holat va period kesimidagi statistika.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/70 px-1.5 py-1 text-[11px] text-muted">
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>{isToday ? "Bugungi jonli ko'rinish" : "Tanlangan period ko'rinishi"}</span>
          </div>
        </div>

        <div className="mt-3 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
          <MetricCard
            label="Jami"
            value={stats?.totalStudents ?? 0}
            icon={<Users2 className="h-4 w-4 text-primary" />}
          />
          <MetricCard
            label="Kelgan"
            value={stats?.presentToday ?? 0}
            badge="success"
            icon={<GraduationCap className="h-4 w-4 text-success" />}
          />
          <MetricCard
            label="Kech"
            value={stats?.lateToday ?? 0}
            badge="warning"
            icon={<CalendarDays className="h-4 w-4 text-warning" />}
          />
          <MetricCard
            label="Yo'q"
            value={stats?.absentToday ?? 0}
            badge="destructive"
            icon={<Activity className="h-4 w-4 text-danger" />}
          />
          <MetricCard label="Sababli" value={stats?.excusedToday ?? 0} />
          <MetricCard
            label="Maktabda"
            value={stats?.currentlyInSchool ?? 0}
            icon={<Activity className="h-4 w-4 text-primary" />}
          />
          <MetricCard
            label="% Davomat"
            value={`${stats?.presentPercentage ?? 0}%`}
            icon={<TrendingUp className="h-4 w-4 text-primary" />}
          />
        </div>

        <div className="mt-2.5 grid gap-1.5 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-1 xl:col-span-2">
            <label className="block text-xs font-medium text-muted">Period</label>
            <Select
              value={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(value as PeriodType)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

            <div className="space-y-1 xl:col-span-2">
              <label className="block text-xs font-medium text-muted">Sinf</label>
              <Select
              value={selectedClassId ?? "__all__"}
              onValueChange={(value) => setSelectedClassId(value === "__all__" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Barcha sinflar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Barcha sinflar</SelectItem>
                {(classesQuery.data ?? []).map((cls) => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>

            {selectedPeriod === "today" && (
              <div className="space-y-1 xl:col-span-1">
                <label className="block text-xs font-medium text-muted">Scope</label>
                <Select
                  value={attendanceScope}
                  onValueChange={(value) => setAttendanceScope(value as AttendanceScope)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="started">Boshlangan</SelectItem>
                    <SelectItem value="active">Faol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

          {selectedPeriod === "custom" && (
            <>
              <div className="space-y-1 xl:col-span-1">
                <label className="block text-xs font-medium text-muted">Boshlanish</label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-1 xl:col-span-1">
                <label className="block text-xs font-medium text-muted">Tugash</label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </>
          )}

            <div className="flex items-end gap-1.5 xl:col-span-1">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistoryOpen(true)}>
                Tarix
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={() => {
                void Promise.all([statsQuery.refetch(), recentEventsQuery.refetch()]);
              }}
            >
              Yangilash
              </Button>
            </div>
          </div>

          {stats?.periodLabel && selectedPeriod !== "today" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{stats.periodLabel}</Badge>
              {(stats.daysCount ?? 0) > 1 && (
                <span className="text-xs text-muted">({stats.daysCount} kunlik ma'lumot)</span>
              )}
            </div>
          )}
        </section>

      <section className="grid items-stretch gap-2.5 xl:grid-cols-12">
        <Card className="h-full border-border/70 shadow-sm xl:col-span-4">
          <CardHeader>
            <CardTitle>Davomat taqsimoti</CardTitle>
          </CardHeader>
          <CardContent className="h-[240px]">
            {derived?.pieHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={derived.pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={46}
                    outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {derived.pieData.map((entry, index) => (
                      <Cell key={`pie-cell-${index}`} fill={PIE_COLORS[entry.name] || CHART_COLORS.fallback} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                Ma'lumot yo'q
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full border-border/70 shadow-sm xl:col-span-5">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Oxirgi faoliyat</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)}>
              Tarix
            </Button>
          </CardHeader>
          <CardContent className="h-[240px]">
            {events.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                Hozircha eventlar yo'q
              </div>
            ) : (
              <div className="h-full space-y-1.5 overflow-y-auto pr-1">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-2 py-1.5",
                      (event.student?.id || event.studentId) ? "cursor-pointer hover:bg-muted/20" : "",
                    )}
                    role={(event.student?.id || event.studentId) ? "button" : undefined}
                    tabIndex={(event.student?.id || event.studentId) ? 0 : undefined}
                    onClick={() => {
                      if (!(event.student?.id || event.studentId)) return;
                      navigateToStudent(event);
                    }}
                    onKeyDown={(keyboardEvent) => {
                      if (!(event.student?.id || event.studentId)) return;
                      if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                        keyboardEvent.preventDefault();
                        navigateToStudent(event);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={event.eventType === "IN" ? "success" : "destructive"}>
                        {event.eventType}
                      </Badge>
                      <span className="text-xs font-medium">
                        {getEventStudentLabel(event)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted">
                        {event.student?.class?.name ?? ""}
                      </span>
                      <span className="text-[11px] text-muted">
                        {dayjs(event.timestamp).format("DD MMM HH:mm:ss")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full border-border/70 shadow-sm xl:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Kalendar
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[240px] p-1 pt-0">
            <Calendar
              mode="single"
              className="h-full"
              captionLayout="dropdown"
              startMonth={dayjs().subtract(3, "year").toDate()}
              endMonth={dayjs().add(1, "year").toDate()}
              selected={
                selectedPeriod === "custom" && customStartDate
                  ? dayjs(customStartDate).toDate()
                  : dayjs().toDate()
              }
              onSelect={(date) => {
                if (!date) return;
                const value = dayjs(date).format("YYYY-MM-DD");
                setCustomStartDate(value);
                setCustomEndDate(value);
                setSelectedPeriod("custom");
              }}
            />
          </CardContent>
        </Card>
      </section>

      <section
        className={cn(
          "grid gap-2.5",
          notYetArrivedCount > 0 ? "xl:grid-cols-12" : "",
        )}
      >
        <Card
          className={cn(
            "border-border/70 shadow-sm",
            notYetArrivedCount > 0 ? "xl:col-span-8" : "",
          )}
        >
          <CardHeader>
            <CardTitle>Haftalik davomat dinamikasi</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {derived?.weeklyData && derived.weeklyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={derived.weeklyData} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="dayName" tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} />
                  <RechartsTooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      fontSize: 11,
                    }}
                  />
                  <Line type="monotone" dataKey="present" stroke={CHART_COLORS.present} strokeWidth={2.4} dot={{ r: 2 }} name="Kelgan" />
                  <Line type="monotone" dataKey="late" stroke={CHART_COLORS.late} strokeWidth={2.4} dot={{ r: 2 }} name="Kech qoldi" />
                  <Line type="monotone" dataKey="absent" stroke={CHART_COLORS.absent} strokeWidth={2.4} dot={{ r: 2 }} name="Kelmadi" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted">
                Ma'lumot yo'q
              </div>
            )}
          </CardContent>
        </Card>

        {notYetArrivedCount > 0 && (
          <Card className="border-border/70 shadow-sm xl:col-span-4">
            <CardHeader>
              <CardTitle className="text-base">
                Kutilayotganlar ({notYetArrivedCount})
              </CardTitle>
              <p className="text-xs text-muted">
                Hali kelmagan: {derived?.pendingEarlyCount ?? 0} · Kechikmoqda: {derived?.latePendingCount ?? 0}
              </p>
            </CardHeader>
            <CardContent className="max-h-[250px] space-y-1.5 overflow-y-auto">
              {notYetArrived.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/70 px-2 py-1"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{item.name}</p>
                    <p className="truncate text-[11px] text-muted">{item.className}</p>
                  </div>
                  <Badge variant={item.pendingStatus === "PENDING_LATE" ? "warning" : "secondary"}>
                    {item.pendingStatus === "PENDING_LATE" ? "Kechikmoqda" : "Hali kelmagan"}
                  </Badge>
                </div>
              ))}
              {notYetArrivedCount > 8 && (
                <p className="text-xs text-muted">...va yana {notYetArrivedCount - 8} ta</p>
              )}
            </CardContent>
          </Card>
        )}
      </section>

      {school && (
        <Card className="border-border/70 bg-muted/10 shadow-sm">
          <CardContent className="pt-3">
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted">
              <p>
                <strong className="text-foreground">Kech qolish:</strong>{" "}
                sinf boshlanishidan {school.lateThresholdMinutes} daqiqa keyin
              </p>
              <p>
                <strong className="text-foreground">Kelmadi:</strong>{" "}
                darsdan {school.absenceCutoffMinutes} daqiqa o'tgach avtomatik belgilanadi
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-4xl border-border/70">
          <DialogHeader>
            <DialogTitle>Event tarixi</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
            <Input
              type="date"
              value={historyStartDate}
              onChange={(e) => setHistoryStartDate(e.target.value)}
            />
            <Input
              type="date"
              value={historyEndDate}
              onChange={(e) => setHistoryEndDate(e.target.value)}
            />
            <div className="md:col-span-2">
              <Button onClick={() => void handleHistorySearch()} className="w-full">
                Qidirish
              </Button>
            </div>
          </div>

          <div className="max-h-[300px] space-y-1.5 overflow-y-auto pt-1.5">
            {(loadHistoryMutation.data?.data ?? []).map((event) => (
              <div
                key={event.id}
                className={cn(
                  "flex items-center justify-between rounded-xl border border-border/70 bg-background/70 px-2 py-1.5",
                  (event.student?.id || event.studentId) ? "cursor-pointer hover:bg-muted/20" : "",
                )}
                role={(event.student?.id || event.studentId) ? "button" : undefined}
                tabIndex={(event.student?.id || event.studentId) ? 0 : undefined}
                onClick={() => {
                  if (!(event.student?.id || event.studentId)) return;
                  navigateToStudent(event);
                }}
                onKeyDown={(keyboardEvent) => {
                  if (!(event.student?.id || event.studentId)) return;
                  if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
                    keyboardEvent.preventDefault();
                    navigateToStudent(event);
                  }
                }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant={event.eventType === "IN" ? "success" : "destructive"}>
                    {event.eventType}
                  </Badge>
                  <span className="truncate text-xs">
                    {getEventStudentLabel(event)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted">{event.student?.class?.name ?? ""}</span>
                  <span className="text-[11px] text-muted">
                    {dayjs(event.timestamp).format("DD MMM HH:mm:ss")}
                  </span>
                </div>
              </div>
            ))}
            {loadHistoryMutation.isPending && (
              <div className="text-sm text-muted">Yuklanmoqda...</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MetricCard({
  label,
  value,
  badge = "default",
  icon,
}: {
  label: string;
  value: string | number;
  badge?: "default" | "success" | "warning" | "destructive";
  icon?: ReactNode;
}) {
  const toneClass = {
    default: "bg-gradient-to-br from-primary/5 via-card to-card",
    success: "bg-gradient-to-br from-success/10 via-card to-card",
    warning: "bg-gradient-to-br from-warning/10 via-card to-card",
    destructive: "bg-gradient-to-br from-danger/10 via-card to-card",
  }[badge];

  return (
    <div className={cn("rounded-md border border-border/70 px-2.5 py-2 shadow-sm", toneClass)}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[11px] font-medium tracking-wide text-muted">{label}</div>
        {icon ?? <span />}
      </div>
      <div className="text-xl font-semibold leading-none">{value}</div>
    </div>
  );
}

