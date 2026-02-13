export type V2PageKey = "dashboard" | "students" | "devices";

const parseBoolean = (value: string | undefined, fallback = false) => {
  if (value == null) return fallback;
  return value.toLowerCase() === "true";
};

const parsePageList = (value: string | undefined): Set<V2PageKey> => {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
      .filter((item): item is V2PageKey =>
        item === "dashboard" || item === "students" || item === "devices",
      ),
  );
};

export const featureFlags = {
  uiV2Enabled: parseBoolean(import.meta.env.VITE_UI_V2_ENABLED, false),
  uiV2Force: parseBoolean(import.meta.env.VITE_UI_V2_FORCE, false),
  uiV2Pages: parsePageList(import.meta.env.VITE_UI_V2_PAGES),
} as const;

export function isV2PageEnabled(page: V2PageKey): boolean {
  if (!featureFlags.uiV2Enabled) return false;
  if (featureFlags.uiV2Pages.size === 0) return true;
  return featureFlags.uiV2Pages.has(page);
}
