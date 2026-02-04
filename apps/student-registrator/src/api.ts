// API Client using Tauri invoke

import { invoke } from '@tauri-apps/api';

export interface DeviceConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface RegisterResult {
  employeeNo: string;
  results: Array<{
    deviceId: string;
    deviceName: string;
    connection: { ok: boolean; message?: string };
    userCreate?: { ok: boolean; statusString?: string; errorMsg?: string };
    faceUpload?: { ok: boolean; statusString?: string; errorMsg?: string };
  }>;
}

export interface UserInfoEntry {
  employeeNo: string;
  name: string;
  gender?: string;
  numOfFace?: number;
  faceURL?: string;
  userType?: string;
  doorRight?: string;
  RightPlan?: Array<{ doorNo: number; planTemplateNo: string }>;
  Valid?: {
    enable?: boolean;
    beginTime?: string;
    endTime?: string;
    timeType?: string;
  };
}

export interface UserInfoSearchResponse {
  UserInfoSearch?: {
    UserInfo?: UserInfoEntry[];
    numOfMatches?: number;
    totalMatches?: number;
  };
}

// Backend URL - can be configured via environment
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// ============ Device Management ============

export async function fetchDevices(): Promise<DeviceConfig[]> {
  return invoke<DeviceConfig[]>('get_devices');
}

export async function createDevice(
  device: Omit<DeviceConfig, 'id'>,
): Promise<DeviceConfig> {
  return invoke<DeviceConfig>('create_device', {
    name: device.name,
    host: device.host,
    port: device.port,
    username: device.username,
    password: device.password,
  });
}

export async function updateDevice(
  id: string,
  device: Omit<DeviceConfig, 'id'>,
): Promise<DeviceConfig> {
  return invoke<DeviceConfig>('update_device', {
    id,
    name: device.name,
    host: device.host,
    port: device.port,
    username: device.username,
    password: device.password,
  });
}

export async function deleteDevice(id: string): Promise<boolean> {
  return invoke<boolean>('delete_device', { id });
}

export async function testDeviceConnection(deviceId: string): Promise<boolean> {
  return invoke<boolean>('test_device_connection', { deviceId });
}

// ============ Student Registration ============

export async function registerStudent(
  name: string,
  gender: string,
  faceImageBase64: string,
): Promise<RegisterResult> {
  return invoke<RegisterResult>('register_student', {
    name,
    gender,
    faceImageBase64,
    backendUrl: BACKEND_URL,
  });
}

// ============ User Management ============

export async function fetchUsers(deviceId: string): Promise<UserInfoSearchResponse> {
  return invoke<UserInfoSearchResponse>('fetch_users', { 
    deviceId,
    offset: 0,
    limit: 30,
  });
}

export async function deleteUser(
  deviceId: string,
  employeeNo: string,
): Promise<boolean> {
  return invoke<boolean>('delete_user', { deviceId, employeeNo });
}

export interface RecreateUserResult {
  employeeNo: string;
  deleteResult: { ok: boolean; statusString?: string; errorMsg?: string };
  createResult: { ok: boolean; statusString?: string; errorMsg?: string };
  faceUpload: { ok: boolean; statusString?: string; errorMsg?: string };
}

export async function recreateUser(
  deviceId: string,
  employeeNo: string,
  name: string,
  gender: string,
  newEmployeeNo: boolean,
  reuseExistingFace: boolean,
  faceImageBase64?: string,
): Promise<RecreateUserResult> {
  return invoke<RecreateUserResult>('recreate_user', {
    deviceId,
    employeeNo,
    name,
    gender,
    newEmployeeNo,
    reuseExistingFace,
    faceImageBase64,
  });
}

// ============ Helper Functions ============

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:image/xxx;base64, prefix
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
