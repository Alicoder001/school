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
    connection: { ok: boolean; message?: string; deviceId?: string };
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
const BACKEND_TOKEN = import.meta.env.VITE_BACKEND_TOKEN || '';
const SCHOOL_ID = import.meta.env.VITE_SCHOOL_ID || '';

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
  options?: { parentName?: string; parentPhone?: string },
): Promise<RegisterResult> {
  return invoke<RegisterResult>('register_student', {
    name,
    gender,
    faceImageBase64,
    parentName: options?.parentName,
    parentPhone: options?.parentPhone,
    backendUrl: BACKEND_URL,
    backendToken: BACKEND_TOKEN,
    schoolId: SCHOOL_ID,
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

type FaceEncodeOptions = {
  maxBytes: number;
  maxDimension: number;
};

const DEFAULT_FACE_ENCODE: FaceEncodeOptions = {
  maxBytes: 200 * 1024,
  maxDimension: 640,
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function fileToImageBitmap(file: File): Promise<ImageBitmap> {
  if ("createImageBitmap" in window) {
    return createImageBitmap(file);
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0);
  return await createImageBitmap(canvas);
}

async function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("Failed to encode image"));
        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Encodes a face image as base64 JPEG and tries to keep it under 200KB.
 * This helps Hikvision devices that enforce small face image size limits.
 */
export async function fileToFaceBase64(
  file: File,
  options: Partial<FaceEncodeOptions> = {},
): Promise<string> {
  const { maxBytes, maxDimension } = { ...DEFAULT_FACE_ENCODE, ...options };

  // Fast path: already small enough (roughly) → send original.
  if (file.size > 0 && file.size <= maxBytes) {
    return fileToBase64(file);
  }

  const bmp = await fileToImageBitmap(file);
  const scale = Math.min(
    1,
    maxDimension / Math.max(bmp.width || 1, bmp.height || 1),
  );
  const targetW = Math.max(1, Math.round(bmp.width * scale));
  const targetH = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(bmp, 0, 0, targetW, targetH);

  // Try decreasing quality first. If still too big, downscale and retry.
  let quality = 0.9;
  for (let attempt = 0; attempt < 8; attempt++) {
    const blob = await canvasToJpegBlob(canvas, quality);
    if (blob.size <= maxBytes) {
      return blobToBase64(blob);
    }
    quality -= 0.1;
    if (quality < 0.4) break;
  }

  // Downscale loop.
  let downscale = 0.85;
  for (let attempt = 0; attempt < 6; attempt++) {
    const w = Math.max(1, Math.round(canvas.width * downscale));
    const h = Math.max(1, Math.round(canvas.height * downscale));
    const next = document.createElement("canvas");
    next.width = w;
    next.height = h;
    const nctx = next.getContext("2d");
    if (!nctx) throw new Error("Canvas not supported");
    nctx.drawImage(canvas, 0, 0, w, h);

    const blob = await canvasToJpegBlob(next, 0.75);
    if (blob.size <= maxBytes) {
      return blobToBase64(blob);
    }
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(next, 0, 0);
    downscale *= 0.9;
  }

  throw new Error(
    `Face image is too large. Please use a smaller/cropped image (max ${Math.round(
      maxBytes / 1024,
    )}KB).`,
  );
}
