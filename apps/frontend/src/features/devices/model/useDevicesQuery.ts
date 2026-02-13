import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { devicesService } from "@entities/device";
import { schoolsService } from "@entities/school";
import type { Device } from "@shared/types";
import { queryKeys } from "@shared/query";

export type WebhookInfo = {
  enforceSecret: boolean;
  secretHeaderName: string;
  inUrl: string;
  outUrl: string;
  inUrlWithSecret: string;
  outUrlWithSecret: string;
  inSecret: string;
  outSecret: string;
};

export function useDevicesQuery(params: { schoolId: string | null; canManage: boolean }) {
  const { schoolId, canManage } = params;

  const devicesListQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.devices.list({ schoolId })
      : [...queryKeys.devices.all, "list", "idle"],
    queryFn: () => devicesService.getAll(schoolId!),
    enabled: Boolean(schoolId),
  });

  const webhookInfoQuery = useQuery({
    queryKey: schoolId
      ? queryKeys.devices.webhook(schoolId)
      : [...queryKeys.devices.all, "webhook", "idle"],
    queryFn: () => schoolsService.getWebhookInfo(schoolId!) as Promise<WebhookInfo>,
    enabled: Boolean(schoolId) && canManage,
  });

  return { devicesListQuery, webhookInfoQuery };
}

export function useDevicesMutations(schoolId: string | null) {
  const queryClient = useQueryClient();

  const invalidateDevices = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
  };

  const createDeviceMutation = useMutation({
    mutationFn: (payload: Partial<Device>) => devicesService.create(schoolId!, payload),
    onSuccess: invalidateDevices,
  });

  const updateDeviceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Device> }) =>
      devicesService.update(id, payload),
    onSuccess: invalidateDevices,
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: (id: string) => devicesService.delete(id),
    onSuccess: invalidateDevices,
  });

  return {
    createDeviceMutation,
    updateDeviceMutation,
    deleteDeviceMutation,
    invalidateDevices,
  };
}
