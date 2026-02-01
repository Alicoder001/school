import http from "http";
import https from "https";
import net from "net";
import os from "os";

type Fingerprint = {
  port: number;
  protocol: "http" | "https";
  status?: number;
  server?: string;
  realm?: string;
  title?: string;
  snippet?: string;
};

type VendorGuess = {
  vendor: string | null;
  confidence: number;
  reasons: string[];
};

type DeviceKind = "NVR" | "CAMERA" | "UNKNOWN";

type DeviceCandidate = {
  host: string;
  openPorts: number[];
  fingerprints: Fingerprint[];
  vendorGuess: VendorGuess;
  deviceKind: DeviceKind;
  confidence: number;
  reasons: string[];
  onvif?: {
    port: number;
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    profiles?: number;
    streams?: number;
  };
};

type ScanResult = {
  scannedAt: string;
  subnets: string[];
  hostCount: number;
  devices: DeviceCandidate[];
};

type ScanOptions = {
  subnets: string[];
  ports: number[];
  timeoutMs: number;
  httpTimeoutMs: number;
  concurrency: number;
  maxHosts: number;
  allowPublic: boolean;
  onvifUser?: string;
  onvifPass?: string;
  onvifTimeoutMs: number;
  output?: string;
  pretty: boolean;
};

const DEFAULT_PORTS = [
  80, 443, 554, 8000, 8080, 8443, 8899, 37777, 37778, 34567, 5060, 9000,
];

const HTTP_PORTS = new Set([80, 8000, 8080, 8899, 9000]);
const HTTPS_PORTS = new Set([443, 8443]);

const VENDOR_RULES: Array<{
  vendor: string;
  patterns: RegExp[];
  ports?: number[];
  realms?: RegExp[];
}> = [
  {
    vendor: "hikvision",
    patterns: [/hikvision/i, /ivms/i, /isapi/i, /ds-2/i],
    ports: [8000],
    realms: [/hikvision/i],
  },
  {
    vendor: "dahua",
    patterns: [/dahua/i, /webs/i, /dvr/i],
    ports: [37777, 37778],
    realms: [/dahua/i],
  },
  {
    vendor: "uniview",
    patterns: [/uniview/i, /\bunv\b/i],
    ports: [5060],
    realms: [/unv/i],
  },
  {
    vendor: "axis",
    patterns: [/axis/i],
    realms: [/axis/i],
  },
  {
    vendor: "reolink",
    patterns: [/reolink/i],
    ports: [9000],
  },
  {
    vendor: "seetong",
    patterns: [/seetong/i],
    ports: [8899],
  },
];

const toInt = (ip: string) =>
  ip
    .split(".")
    .map((v) => parseInt(v, 10))
    .reduce((acc, v) => (acc << 8) + v, 0) >>> 0;

const toIp = (int: number) =>
  [24, 16, 8, 0].map((shift) => (int >> shift) & 255).join(".");

const netmaskToPrefix = (netmask: string) =>
  netmask
    .split(".")
    .map((v) => Number(v).toString(2).padStart(8, "0"))
    .join("")
    .replace(/0.*$/, "").length;

const isPrivateIp = (ip: string) => {
  const [a, b] = ip.split(".").map((v) => Number(v));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
};

const isPrivateCidr = (cidr: string) => {
  const [ip] = cidr.split("/");
  if (!ip) return false;
  return isPrivateIp(ip);
};

const expandCidr = (cidr: string) => {
  const [ip, prefixStr] = cidr.split("/");
  const prefix = Number(prefixStr);
  if (!ip || !Number.isFinite(prefix)) return [];
  const base = toInt(ip);
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  const network = base & mask;
  const broadcast = network + (2 ** (32 - prefix) - 1);
  const hosts: string[] = [];
  for (let i = network + 1; i < broadcast; i += 1) {
    hosts.push(toIp(i));
  }
  return hosts;
};

const getLocalSubnets = () => {
  const nets = os.networkInterfaces();
  const subnets: string[] = [];
  Object.values(nets).forEach((list) => {
    list?.forEach((iface) => {
      if (!iface?.address || iface.internal || iface.family !== "IPv4") return;
      if (!iface.netmask) return;
      const prefix = netmaskToPrefix(iface.netmask);
      subnets.push(`${iface.address}/${prefix}`);
    });
  });
  return subnets;
};

const probeTcp = (
  host: string,
  port: number,
  timeoutMs: number,
): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  if (!items.length) return [];
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const runNext = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  };
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    runNext(),
  );
  await Promise.all(runners);
  return results;
};

const fetchFingerprint = async (
  host: string,
  port: number,
  timeoutMs: number,
): Promise<Fingerprint | null> => {
  const protocol = HTTPS_PORTS.has(port) ? "https" : "http";
  const client = protocol === "https" ? https : http;
  return new Promise((resolve) => {
    const req = client.request(
      {
        host,
        port,
        path: "/",
        method: "GET",
        timeout: timeoutMs,
        rejectUnauthorized: false,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          if (chunks.reduce((a, b) => a + b.length, 0) > 12000) return;
          chunks.push(Buffer.from(chunk));
        });
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
          const realmMatch = res.headers["www-authenticate"]
            ?.toString()
            .match(/realm=\"?([^\";]+)\"?/i);
          resolve({
            port,
            protocol,
            status: res.statusCode,
            server: res.headers.server?.toString(),
            realm: realmMatch?.[1],
            title: titleMatch?.[1]?.trim(),
            snippet: body.slice(0, 200).replace(/\s+/g, " ").trim(),
          });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
    req.on("error", () => resolve(null));
    req.end();
  });
};

const guessVendor = (openPorts: number[], fingerprints: Fingerprint[]) => {
  const haystack = [
    ...fingerprints.map((f) => f.title || ""),
    ...fingerprints.map((f) => f.snippet || ""),
    ...fingerprints.map((f) => f.server || ""),
    ...fingerprints.map((f) => f.realm || ""),
  ]
    .join(" ")
    .toLowerCase();

  const results = VENDOR_RULES.map((rule) => {
    let score = 0;
    const reasons: string[] = [];
    rule.patterns.forEach((pattern) => {
      if (pattern.test(haystack)) {
        score += 3;
        reasons.push(`match:${pattern.source}`);
      }
    });
    rule.realms?.forEach((pattern) => {
      if (pattern.test(haystack)) {
        score += 2;
        reasons.push(`realm:${pattern.source}`);
      }
    });
    rule.ports?.forEach((port) => {
      if (openPorts.includes(port)) {
        score += 1;
        reasons.push(`port:${port}`);
      }
    });
    return { vendor: rule.vendor, score, reasons };
  });

  const best = results.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score <= 0) {
    return { vendor: null, confidence: 0, reasons: [] };
  }
  return {
    vendor: best.vendor,
    confidence: Math.min(1, best.score / 6),
    reasons: best.reasons,
  };
};

const classifyDevice = (
  openPorts: number[],
  vendorGuess: VendorGuess,
  onvifStreams?: number,
) => {
  let nvrScore = 0;
  let camScore = 0;
  const reasons: string[] = [];

  if (openPorts.includes(554)) camScore += 2;
  if (openPorts.some((p) => [37777, 37778, 34567, 8000].includes(p))) {
    nvrScore += 2;
    reasons.push("nvr-port");
  }
  if (openPorts.includes(8899)) {
    nvrScore += 1;
    camScore += 1;
  }
  if (openPorts.includes(80) || openPorts.includes(443)) camScore += 1;
  if (vendorGuess.vendor && ["hikvision", "dahua", "uniview"].includes(vendorGuess.vendor)) {
    nvrScore += 1;
  }
  if (onvifStreams && onvifStreams > 1) {
    nvrScore += 3;
    reasons.push("multi-stream");
  }

  if (nvrScore >= camScore + 2) return { kind: "NVR" as DeviceKind, confidence: Math.min(1, nvrScore / 6), reasons };
  if (camScore >= nvrScore + 1) return { kind: "CAMERA" as DeviceKind, confidence: Math.min(1, camScore / 5), reasons };
  return { kind: "UNKNOWN" as DeviceKind, confidence: 0.2, reasons };
};

const fetchOnvifInfo = async (
  host: string,
  port: number,
  user: string,
  pass: string,
  timeoutMs: number,
) => {
  const onvif = await import("onvif");
  const OnvifDevice = (onvif as any).OnvifDevice;
  const xaddr = `http://${host}:${port}/onvif/device_service`;
  const device = new OnvifDevice({ xaddr, user, pass });
  await Promise.race([
    device.init(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
  ]);
  const info = await new Promise<any>((resolve, reject) => {
    device.getDeviceInformation((err: any, data: any) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
  const profiles = await new Promise<any[]>((resolve, reject) => {
    device.getProfiles((err: any, data: any[]) => {
      if (err) return reject(err);
      resolve(data || []);
    });
  });
  return { info, profiles };
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const value = args[i + 1];
    if (!value || value.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = value;
      i += 1;
    }
  }
  return options;
};

const buildOptions = (): ScanOptions => {
  const args = parseArgs();
  const subnets =
    typeof args.subnet === "string"
      ? args.subnet.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const ports =
    typeof args.ports === "string"
      ? args.ports.split(",").map((p) => Number(p.trim())).filter((p) => Number.isFinite(p))
      : DEFAULT_PORTS;
  return {
    subnets,
    ports,
    timeoutMs: Number(args.timeout ?? 600),
    httpTimeoutMs: Number(args.httpTimeout ?? 1200),
    concurrency: Number(args.concurrency ?? 128),
    maxHosts: Number(args.maxHosts ?? 1024),
    allowPublic: Boolean(args.allowPublic),
    onvifUser: typeof args.onvifUser === "string" ? args.onvifUser : undefined,
    onvifPass: typeof args.onvifPass === "string" ? args.onvifPass : undefined,
    onvifTimeoutMs: Number(args.onvifTimeout ?? 2000),
    output: typeof args.output === "string" ? args.output : undefined,
    pretty: Boolean(args.pretty),
  };
};

const scan = async (options: ScanOptions): Promise<ScanResult> => {
  let subnets = options.subnets.length ? options.subnets : getLocalSubnets();
  if (!options.allowPublic) {
    const privateSubnets = subnets.filter((cidr) => isPrivateCidr(cidr));
    if (privateSubnets.length === 0) {
      throw new Error(
        "No private subnets detected. Pass --allowPublic to override (not recommended).",
      );
    }
    subnets = privateSubnets;
  }
  const hosts = subnets.flatMap((cidr) => expandCidr(cidr));
  if (hosts.length > options.maxHosts) {
    throw new Error(`Host count ${hosts.length} exceeds maxHosts ${options.maxHosts}`);
  }

  const portScan = await runWithConcurrency(
    hosts,
    options.concurrency,
    async (host) => {
      const results = await runWithConcurrency(
        options.ports,
        Math.min(64, options.ports.length),
        async (port) => (await probeTcp(host, port, options.timeoutMs)) ? port : null,
      );
      const openPorts = results.filter((p): p is number => Number.isFinite(p as number));
      return openPorts.length ? { host, openPorts } : null;
    },
  );

  const liveHosts = portScan.filter((item): item is { host: string; openPorts: number[] } => Boolean(item));

  const deviceCandidates = await runWithConcurrency(
    liveHosts,
    options.concurrency,
    async ({ host, openPorts }) => {
      const httpTargets = openPorts.filter((p) => HTTP_PORTS.has(p) || HTTPS_PORTS.has(p));
      const fingerprints = (
        await runWithConcurrency(
          httpTargets,
          Math.min(8, httpTargets.length || 1),
          async (port) => await fetchFingerprint(host, port, options.httpTimeoutMs),
        )
      ).filter((f): f is Fingerprint => Boolean(f));

      const vendorGuess = guessVendor(openPorts, fingerprints);
      let onvifInfo: DeviceCandidate["onvif"];
      let onvifStreams: number | undefined;

      if (options.onvifUser && options.onvifPass) {
        const onvifPort = openPorts.find((p) => [80, 8000, 8080].includes(p));
        if (onvifPort) {
          try {
            const { info, profiles } = await fetchOnvifInfo(
              host,
              onvifPort,
              options.onvifUser,
              options.onvifPass,
              options.onvifTimeoutMs,
            );
            onvifInfo = {
              port: onvifPort,
              manufacturer: info?.manufacturer,
              model: info?.model,
              serialNumber: info?.serialNumber,
              profiles: profiles?.length || 0,
              streams: profiles?.length || 0,
            };
            onvifStreams = profiles?.length || 0;
          } catch {
            onvifInfo = undefined;
          }
        }
      }

      const classified = classifyDevice(openPorts, vendorGuess, onvifStreams);

      return {
        host,
        openPorts,
        fingerprints,
        vendorGuess,
        deviceKind: classified.kind,
        confidence: classified.confidence,
        reasons: classified.reasons,
        onvif: onvifInfo,
      } satisfies DeviceCandidate;
    },
  );

  return {
    scannedAt: new Date().toISOString(),
    subnets,
    hostCount: hosts.length,
    devices: deviceCandidates,
  };
};

const main = async () => {
  const options = buildOptions();
  const result = await scan(options);
  const output = options.pretty ? JSON.stringify(result, null, 2) : JSON.stringify(result);
  if (options.output) {
    const fs = await import("fs");
    fs.writeFileSync(options.output, output);
    return;
  }
  console.log(output);
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
