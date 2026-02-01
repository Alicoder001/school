import Redis from "ioredis";
import { REDIS_URL } from "../config";

const memoryNonces = new Map<string, number>();

let redis: Redis | null = null;
if (REDIS_URL) {
  redis = new Redis(REDIS_URL);
}

const cleanupMemoryNonces = (now: number) => {
  if (memoryNonces.size < 5000) return;
  for (const [key, expiresAt] of memoryNonces) {
    if (expiresAt <= now) {
      memoryNonces.delete(key);
    }
  }
};

export const checkAndStoreNonce = async (
  key: string,
  ttlSeconds: number,
): Promise<boolean> => {
  if (redis) {
    try {
      const res = await redis.set(key, "1", "EX", ttlSeconds, "NX");
      return res === "OK";
    } catch {
      // fallback to memory if redis is unavailable
    }
  }

  const now = Date.now();
  cleanupMemoryNonces(now);
  const existing = memoryNonces.get(key);
  if (existing && existing > now) {
    return false;
  }
  memoryNonces.set(key, now + ttlSeconds * 1000);
  return true;
};
