// UI related types

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export type ThemeMode = "light" | "dark";
