import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type ColumnDef } from "@tanstack/react-table";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import dayjs from "dayjs";
import {
  CheckCircle2,
  Clipboard,
  Link as LinkIcon,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  Trash2,
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
import { useDevicesMutations, useDevicesQuery } from "@features/devices";
import type { Device } from "@shared/types";
import { ConfirmDialog, DataTable } from "@shared/ui-v2";
import { useHeaderMeta } from "@shared/ui/useHeaderMeta";

const deviceSchema = z.object({
  name: z.string().min(1, "Nomi majburiy"),
  deviceId: z.string().min(1, "Qurilma ID majburiy"),
  type: z.enum(["ENTRANCE", "EXIT"]),
  location: z.string().optional(),
});

type DeviceFormValues = z.infer<typeof deviceSchema>;

function mapDeviceToForm(device: Device): DeviceFormValues {
  return {
    name: device.name,
    deviceId: device.deviceId,
    type: device.type,
    location: device.location || "",
  };
}

export default function DevicesV2() {
  const { schoolId, isSchoolAdmin, isSuperAdmin } = useSchool();
  const { setRefresh, setLastUpdated } = useHeaderMeta();
  const canManage = isSchoolAdmin || isSuperAdmin;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deviceToDelete, setDeviceToDelete] = useState<Device | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showWebhookAdvanced, setShowWebhookAdvanced] = useState(false);
  const refreshActionRef = useRef<() => Promise<void>>(async () => {});

  const form = useForm<DeviceFormValues>({
    resolver: zodResolver(deviceSchema),
    defaultValues: {
      name: "",
      deviceId: "",
      type: "ENTRANCE",
      location: "",
    },
  });
  const formType = useWatch({ control: form.control, name: "type" });

  const { devicesListQuery, webhookInfoQuery } = useDevicesQuery({
    schoolId,
    canManage,
  });
  const {
    createDeviceMutation,
    updateDeviceMutation,
    deleteDeviceMutation,
  } = useDevicesMutations(schoolId);

  useEffect(() => {
    refreshActionRef.current = async () => {
      await Promise.all([devicesListQuery.refetch(), webhookInfoQuery.refetch()]);
      setLastUpdated(new Date());
    };
  }, [devicesListQuery, webhookInfoQuery, setLastUpdated]);

  useEffect(() => {
    const handleRefresh = () => refreshActionRef.current();
    setRefresh(handleRefresh);
    return () => setRefresh(null);
  }, [setRefresh]);

  useEffect(() => {
    if (devicesListQuery.data || webhookInfoQuery.data) {
      setLastUpdated(new Date());
    }
  }, [devicesListQuery.data, webhookInfoQuery.data, setLastUpdated]);

  const devices = useMemo(() => devicesListQuery.data ?? [], [devicesListQuery.data]);

  const stats = useMemo(() => {
    const online = devices.filter(
      (device) => device.lastSeenAt && dayjs().diff(dayjs(device.lastSeenAt), "hour") < 2,
    ).length;
    return {
      total: devices.length,
      online,
      offline: devices.length - online,
      entrance: devices.filter((device) => device.type === "ENTRANCE").length,
      exit: devices.filter((device) => device.type === "EXIT").length,
    };
  }, [devices]);

  const columns = useMemo<ColumnDef<Device>[]>(
    () => [
      {
        header: "Nomi",
        accessorKey: "name",
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.name}</div>
            {row.original.location && (
              <div className="text-xs text-muted">{row.original.location}</div>
            )}
          </div>
        ),
      },
      {
        header: "Qurilma ID",
        accessorKey: "deviceId",
        cell: ({ row }) => <span className="text-xs">{row.original.deviceId}</span>,
      },
      {
        header: "Turi",
        accessorKey: "type",
        cell: ({ row }) => (
          <Badge variant={row.original.type === "ENTRANCE" ? "success" : "default"}>
            {row.original.type === "ENTRANCE" ? "Kirish" : "Chiqish"}
          </Badge>
        ),
      },
      {
        header: "Holat",
        id: "status",
        cell: ({ row }) => {
          const isOnline =
            row.original.lastSeenAt &&
            dayjs().diff(dayjs(row.original.lastSeenAt), "hour") < 2;
          return (
            <Badge variant={isOnline ? "success" : "destructive"}>
              {isOnline ? "Onlayn" : "Oflayn"}
            </Badge>
          );
        },
      },
      {
        header: "Oxirgi faoliyat",
        accessorKey: "lastSeenAt",
        cell: ({ row }) =>
          row.original.lastSeenAt
            ? dayjs(row.original.lastSeenAt).format("DD MMM HH:mm")
            : "-",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (!canManage) return null;
          return (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditingDevice(row.original);
                  form.reset(mapDeviceToForm(row.original));
                  setDialogOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(event) => {
                  event.stopPropagation();
                  setDeviceToDelete(row.original);
                }}
              >
                <Trash2 className="h-4 w-4 text-danger" />
              </Button>
            </div>
          );
        },
      },
    ],
    [canManage, form],
  );

  const handleSave = form.handleSubmit(async (values) => {
    if (!schoolId || !canManage) return;
    const payload = {
      ...values,
      location: values.location || undefined,
    };
    if (editingDevice) {
      await updateDeviceMutation.mutateAsync({
        id: editingDevice.id,
        payload,
      });
      setStatusMessage("Qurilma yangilandi");
    } else {
      await createDeviceMutation.mutateAsync(payload);
      setStatusMessage("Qurilma qo'shildi");
    }

    setDialogOpen(false);
    setEditingDevice(null);
    form.reset();
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage("Nusxalandi");
    } catch {
      setStatusMessage("Nusxalashda xatolik");
    }
  };

  const handleDeviceDeleteConfirm = async () => {
    if (!deviceToDelete) return;
    await deleteDeviceMutation.mutateAsync(deviceToDelete.id);
    setDeviceToDelete(null);
  };

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Qurilmalar V2</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <StatBlock label="Jami" value={stats.total} />
            <StatBlock label="Onlayn" value={stats.online} icon={<CheckCircle2 className="h-4 w-4 text-success" />} />
            <StatBlock label="Oflayn" value={stats.offline} icon={<XCircle className="h-4 w-4 text-danger" />} />
            <StatBlock label="Kirish" value={stats.entrance} icon={<LogIn className="h-4 w-4 text-success" />} />
            <StatBlock label="Chiqish" value={stats.exit} icon={<LogOut className="h-4 w-4 text-primary" />} />
          </div>

          {canManage && (
            <div className="flex items-center gap-1.5">
              <Button
                onClick={() => {
                  setEditingDevice(null);
                  form.reset();
                  setDialogOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                Qo'shish
              </Button>
              <Button variant="outline" onClick={() => void devicesListQuery.refetch()}>
                Yangilash
              </Button>
            </div>
          )}

          {statusMessage && (
            <div className="rounded-md border border-border bg-muted/10 px-3 py-1.5 text-sm">
              {statusMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {canManage && webhookInfoQuery.data && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Webhook ma'lumotlari</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <WebhookRow
              label="In URL"
              value={webhookInfoQuery.data.inUrl}
              onCopy={() => void copyToClipboard(webhookInfoQuery.data.inUrl)}
            />
            <WebhookRow
              label="Out URL"
              value={webhookInfoQuery.data.outUrl}
              onCopy={() => void copyToClipboard(webhookInfoQuery.data.outUrl)}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowWebhookAdvanced((prev) => !prev)}
            >
              {showWebhookAdvanced ? "Advanced yopish" : "Advanced ko'rsatish"}
            </Button>
            {showWebhookAdvanced && (
              <div className="space-y-2 rounded-md border border-border p-2.5">
                <WebhookRow
                  label="In secret"
                  value={webhookInfoQuery.data.inSecret}
                  onCopy={() => void copyToClipboard(webhookInfoQuery.data.inSecret)}
                />
                <WebhookRow
                  label="Out secret"
                  value={webhookInfoQuery.data.outSecret}
                  onCopy={() => void copyToClipboard(webhookInfoQuery.data.outSecret)}
                />
                <WebhookRow
                  label="Header"
                  value={webhookInfoQuery.data.secretHeaderName}
                  onCopy={() => void copyToClipboard(webhookInfoQuery.data.secretHeaderName)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={devices}
        isLoading={devicesListQuery.isLoading}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDevice ? "Qurilmani tahrirlash" : "Yangi qurilma"}</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleSave}>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Nomi</label>
              <Input {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Qurilma ID</label>
              <Input {...form.register("deviceId")} />
              <FieldError message={form.formState.errors.deviceId?.message} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Turi</label>
              <Select
                value={formType}
                onValueChange={(value) => form.setValue("type", value as "ENTRANCE" | "EXIT")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRANCE">Kirish</SelectItem>
                  <SelectItem value="EXIT">Chiqish</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Joylashuv</label>
              <Input {...form.register("location")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Bekor
              </Button>
              <Button type="submit" disabled={createDeviceMutation.isPending || updateDeviceMutation.isPending}>
                Saqlash
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deviceToDelete)}
        title="Qurilmani o'chirish"
        description={
          deviceToDelete
            ? `${deviceToDelete.name} o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.`
            : undefined
        }
        confirmText="O'chirish"
        loading={deleteDeviceMutation.isPending}
        onOpenChange={(open) => {
          if (!open) setDeviceToDelete(null);
        }}
        onConfirm={handleDeviceDeleteConfirm}
      />
    </div>
  );
}

function StatBlock({
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

function WebhookRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary">
        <LinkIcon className="mr-1 h-3 w-3" />
        {label}
      </Badge>
      <Input value={value} readOnly />
      <Button variant="outline" size="icon" onClick={onCopy} aria-label={`${label} copy`}>
        <Clipboard className="h-4 w-4" />
      </Button>
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}
