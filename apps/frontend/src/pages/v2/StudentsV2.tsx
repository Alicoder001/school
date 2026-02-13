import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import {
  CheckCircle2,
  Clock3,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useSchool } from "@entities/school";
import { useAuth } from "@entities/auth";
import { studentsService } from "@entities/student";
import type { Class, PeriodType, Student } from "@shared/types";
import { DEFAULT_PAGE_SIZE, getAssetUrl } from "@shared/config";
import { useStudentsMutations, useStudentsQuery } from "@features/students";
import { ConfirmDialog, DataTable } from "@shared/ui-v2";
import { useHeaderMeta } from "@shared/ui/useHeaderMeta";

const PERIOD_OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: "today", label: "Bugun" },
  { value: "yesterday", label: "Kecha" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Oy" },
  { value: "year", label: "Yil" },
  { value: "custom", label: "Custom" },
];

type StatusKey =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "EXCUSED"
  | "PENDING_EARLY"
  | "PENDING_LATE";

function getStudentListStatsFallbackLocal(students: Student[], total: number) {
  const counts = {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0,
    pendingEarly: 0,
    pendingLate: 0,
  };

  students.forEach((student) => {
    const status = (student.todayEffectiveStatus || student.todayStatus) as StatusKey | undefined;
    if (!status) return;
    if (status === "PRESENT") counts.present += 1;
    if (status === "LATE") counts.late += 1;
    if (status === "ABSENT") counts.absent += 1;
    if (status === "EXCUSED") counts.excused += 1;
    if (status === "PENDING_EARLY") counts.pendingEarly += 1;
    if (status === "PENDING_LATE") counts.pendingLate += 1;
  });

  return {
    total,
    ...counts,
    pending: counts.pendingEarly + counts.pendingLate,
  };
}

const studentFormSchema = z.object({
  deviceStudentId: z.string().optional(),
  firstName: z.string().min(1, "Ism majburiy"),
  lastName: z.string().min(1, "Familiya majburiy"),
  fatherName: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]),
  classId: z.string().min(1, "Sinf majburiy"),
  parentPhone: z.string().optional(),
});

type StudentFormValues = z.infer<typeof studentFormSchema>;

function mapStudentToForm(student: Student): StudentFormValues {
  return {
    deviceStudentId: student.deviceStudentId || "",
    firstName: student.firstName || "",
    lastName: student.lastName || "",
    fatherName: student.fatherName || "",
    gender: student.gender || "MALE",
    classId: student.classId || "",
    parentPhone: student.parentPhone || "",
  };
}

export default function StudentsV2() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { schoolId } = useSchool();
  const { user } = useAuth();
  const { setRefresh, setLastUpdated } = useHeaderMeta();

  const canCreate = user?.role === "SCHOOL_ADMIN" || user?.role === "TEACHER";
  const canEditDelete = user?.role === "SCHOOL_ADMIN";

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string | undefined>(undefined);
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodType>("today");
  const [customStartDate, setCustomStartDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [customEndDate, setCustomEndDate] = useState(dayjs().format("YYYY-MM-DD"));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; message: string }>>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const refreshActionRef = useRef<() => Promise<void>>(async () => {});

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      deviceStudentId: "",
      firstName: "",
      lastName: "",
      fatherName: "",
      gender: "MALE",
      classId: "",
      parentPhone: "",
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const queryFilters = useMemo(() => {
    const base = {
      page,
      limit: DEFAULT_PAGE_SIZE,
      search,
      classId: classFilter,
      period: selectedPeriod,
      startDate: selectedPeriod === "custom" ? customStartDate : undefined,
      endDate: selectedPeriod === "custom" ? customEndDate : undefined,
    };
    return base;
  }, [page, search, classFilter, selectedPeriod, customStartDate, customEndDate]);

  const { studentsListQuery, classesQuery } = useStudentsQuery({
    schoolId,
    filters: queryFilters,
  });
  const {
    createStudentMutation,
    updateStudentMutation,
    deleteStudentMutation,
    invalidateStudents,
  } = useStudentsMutations(schoolId);

  useEffect(() => {
    refreshActionRef.current = async () => {
      await Promise.all([studentsListQuery.refetch(), classesQuery.refetch()]);
      setLastUpdated(new Date());
    };
  }, [studentsListQuery, classesQuery, setLastUpdated]);

  useEffect(() => {
    const handleRefresh = () => refreshActionRef.current();
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [setRefresh]);

  useEffect(() => {
    if (studentsListQuery.data || classesQuery.data) {
      setLastUpdated(new Date());
    }
  }, [studentsListQuery.data, classesQuery.data, setLastUpdated]);

  useEffect(() => {
    if (selectedPeriod !== "today") return;
    const timer = setInterval(() => {
      void studentsListQuery.refetch();
    }, 60000);
    return () => clearInterval(timer);
  }, [selectedPeriod, studentsListQuery]);

  const students = studentsListQuery.data?.data ?? [];
  const classes = classesQuery.data ?? [];
  const total = studentsListQuery.data?.total ?? 0;
  const isSingleDay = studentsListQuery.data?.isSingleDay ?? true;
  const stats =
    studentsListQuery.data?.stats ??
    getStudentListStatsFallbackLocal(students, total);

  const columns = useMemo<ColumnDef<Student>[]>(
    () => [
      {
        header: "",
        accessorKey: "photoUrl",
        cell: ({ row }) => {
          const photo = row.original.photoUrl;
          return (
            <img
              src={getAssetUrl(photo) || "https://placehold.co/40x40"}
              alt={row.original.name}
              className="h-10 w-10 rounded-full object-cover"
            />
          );
        },
      },
      {
        header: "ID",
        accessorKey: "deviceStudentId",
        cell: ({ row }) => (
          <span className="text-xs text-muted">{row.original.deviceStudentId || "-"}</span>
        ),
      },
      {
        header: "Ism",
        accessorKey: "name",
        cell: ({ row }) => (
          <div className="font-medium">{row.original.name}</div>
        ),
      },
      {
        header: "Sinf",
        accessorKey: "class",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.class?.name || "-"}</Badge>
        ),
      },
      {
        header: "Holat",
        accessorKey: "todayEffectiveStatus",
        cell: ({ row }) => {
          const status = row.original.todayEffectiveStatus || row.original.todayStatus;
          if (!isSingleDay || !status) return <span className="text-xs text-muted">-</span>;

          if (status === "PRESENT") return <Badge variant="success">Kelgan</Badge>;
          if (status === "LATE") return <Badge variant="warning">Kech</Badge>;
          if (status === "ABSENT") return <Badge variant="destructive">Yo'q</Badge>;
          if (status === "PENDING_EARLY") return <Badge variant="secondary">Hali kelmagan</Badge>;
          if (status === "PENDING_LATE") return <Badge variant="warning">Kechikmoqda</Badge>;
          return <Badge variant="secondary">{status}</Badge>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                navigate(`/schools/${schoolId}/students/${row.original.id}`);
              }}
            >
              Ko'rish
            </Button>
            {canEditDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingStudent(row.original);
                  form.reset(mapStudentToForm(row.original));
                  setDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canEditDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  setStudentToDelete(row.original);
                }}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            )}
          </div>
        ),
      },
    ],
    [canEditDelete, navigate, schoolId, form, isSingleDay],
  );

  const handleSave = form.handleSubmit(async (values) => {
    if (!schoolId || !canCreate) return;

    const payload = {
      ...values,
      deviceStudentId: values.deviceStudentId || undefined,
      fatherName: values.fatherName || undefined,
      parentPhone: values.parentPhone || undefined,
    };

    if (editingStudent) {
      await updateStudentMutation.mutateAsync({ id: editingStudent.id, data: payload });
    } else {
      await createStudentMutation.mutateAsync(payload);
    }

    setDialogOpen(false);
    setEditingStudent(null);
    form.reset();
  });

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !schoolId) return;
    try {
      const result = await studentsService.importExcel(schoolId, file);
      setImportErrors(result.errors || []);
      setStatusMessage(
        `${result.imported} ta yuklandi${result.skipped ? `, ${result.skipped} ta o'tkazib yuborildi` : ""}`,
      );
      await invalidateStudents();
    } catch {
      setStatusMessage("Importda xatolik yuz berdi");
    } finally {
      event.target.value = "";
    }
  };

  const handleExport = async () => {
    if (!schoolId) return;
    const blob = await studentsService.exportExcel(schoolId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `students-${schoolId}.xlsx`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDownloadTemplate = async () => {
    if (!schoolId) return;
    const blob = await studentsService.downloadTemplate(schoolId);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "talabalar-shablon.xlsx");
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const maxPage = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  const handleStudentDeleteConfirm = async () => {
    if (!studentToDelete) return;
    await deleteStudentMutation.mutateAsync(studentToDelete.id);
    setStudentToDelete(null);
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>O'quvchilar V2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-6">
            <StatBadge label="Jami" value={stats.total} />
            <StatBadge label="Kelgan" value={stats.present} icon={<CheckCircle2 className="h-4 w-4" />} />
            <StatBadge label="Kech" value={stats.late} icon={<Clock3 className="h-4 w-4" />} />
            <StatBadge label="Yo'q" value={stats.absent} icon={<XCircle className="h-4 w-4" />} />
          </div>

          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Qidirish</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted" />
                <Input
                  className="pl-8"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Ism yoki ID..."
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Period</label>
              <Select
                value={selectedPeriod}
                onValueChange={(value) => {
                  setSelectedPeriod(value as PeriodType);
                  setPage(1);
                }}
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

            {selectedPeriod === "custom" && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">Start</label>
                  <Input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted">End</label>
                  <Input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Sinf</label>
              <Select
                value={classFilter ?? "__all__"}
                onValueChange={(value) => {
                  setClassFilter(value === "__all__" ? undefined : value);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sinf" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Barcha sinflar</SelectItem>
                  {classes.map((cls: Class) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              {canCreate && (
                <Button
                  onClick={() => {
                    setEditingStudent(null);
                    form.reset();
                    setDialogOpen(true);
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Qo'shish
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="mr-1 h-4 w-4" />
              Import
            </Button>
            <Button variant="outline" onClick={() => void handleDownloadTemplate()}>
              <Download className="mr-1 h-4 w-4" />
              Shablon
            </Button>
            <Button variant="outline" onClick={() => void handleExport()}>
              <Download className="mr-1 h-4 w-4" />
              Export
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={(event) => void handleImport(event)}
            />
          </div>

          {statusMessage && (
            <div className="rounded-md border border-border bg-muted/10 px-3 py-1.5 text-sm">
              {statusMessage}
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="rounded-md border border-danger/30 bg-danger/5 p-2.5 text-sm">
              <div className="mb-2 font-medium text-danger">Import xatolari</div>
              <ul className="list-disc space-y-1 pl-5">
                {importErrors.slice(0, 10).map((error) => (
                  <li key={`${error.row}-${error.message}`}>
                    {error.row}-qator: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={students}
        isLoading={studentsListQuery.isLoading}
        onRowClick={(student) => navigate(`/schools/${schoolId}/students/${student.id}`)}
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          Jami: {total}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Oldingi
          </Button>
          <span className="text-sm">
            {page} / {maxPage}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= maxPage}
            onClick={() => setPage((prev) => Math.min(maxPage, prev + 1))}
          >
            Keyingi
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingStudent ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleSave}>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Qurilma ID</label>
              <Input {...form.register("deviceStudentId")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Ism</label>
                <Input {...form.register("firstName")} />
                <FieldError message={form.formState.errors.firstName?.message} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Familiya</label>
                <Input {...form.register("lastName")} />
                <FieldError message={form.formState.errors.lastName?.message} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Otasining ismi</label>
              <Input {...form.register("fatherName")} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Jinsi</label>
                <Select
                  value={form.watch("gender")}
                  onValueChange={(value) => form.setValue("gender", value as "MALE" | "FEMALE")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">Erkak</SelectItem>
                    <SelectItem value="FEMALE">Ayol</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">Sinf</label>
                <Select
                  value={form.watch("classId")}
                  onValueChange={(value) => form.setValue("classId", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sinf tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.classId?.message} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Telefon</label>
              <Input {...form.register("parentPhone")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Bekor
              </Button>
              <Button type="submit" disabled={createStudentMutation.isPending || updateStudentMutation.isPending}>
                Saqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="text-xs text-muted">
        Student detail uchun eski route ishlatiladi:
        {" "}
        <Link to={`/schools/${schoolId}/students`} className="underline">
          /schools/:schoolId/students/:id
        </Link>
      </div>

      <ConfirmDialog
        open={Boolean(studentToDelete)}
        title="O'quvchini o'chirish"
        description={
          studentToDelete
            ? `${studentToDelete.name} o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`
            : undefined
        }
        confirmText="O'chirish"
        loading={deleteStudentMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setStudentToDelete(null);
        }}
        onConfirm={handleStudentDeleteConfirm}
      />
    </div>
  );
}

function StatBadge({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-2.5 py-2">
      <div className="mb-0.5 text-xs text-muted">{label}</div>
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold">{value}</span>
        {icon ?? null}
      </div>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}
