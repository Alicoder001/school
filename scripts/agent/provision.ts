import fs from "fs";
import http from "http";
import https from "https";

type DeployConfig =
  | {
      mode: "ssh";
      ssh: {
        host: string;
        port?: number;
        user: string;
        remotePath: string;
        restartCommand?: string;
      };
    }
  | {
      mode: "docker";
      docker: {
        container: string;
        configPath: string;
        restart?: boolean;
      };
    }
  | {
      mode: "local";
      local: {
        path: string;
        restartCommand?: string;
      };
    };

type ProvisionNvr = {
  name: string;
  vendor?: string;
  model?: string;
  host: string;
  httpPort?: number;
  onvifPort?: number;
  rtspPort?: number;
  rtspUrlTemplate?: string;
  username: string;
  password: string;
  protocol?: "ONVIF" | "RTSP" | "HYBRID" | "GB28181";
  isActive?: boolean;
  syncOnvif?: boolean;
  overwriteNames?: boolean;
};

type ProvisionCamera = {
  name: string;
  areaId?: string;
  nvrId?: string;
  nvrRef?: string;
  channelNo?: number;
  streamProfile?: "main" | "sub";
  autoGenerateUrl?: boolean;
  streamUrl?: string;
  status?: "ONLINE" | "OFFLINE" | "UNKNOWN";
  isActive?: boolean;
  externalId?: string;
};

type ProvisionInput = {
  nvrs?: ProvisionNvr[];
  cameras?: ProvisionCamera[];
  deploy?: DeployConfig;
};

type CreateNvrResponse = {
  id: string;
  name: string;
};

type Args = {
  api: string;
  token: string;
  schoolId: string;
  input: string;
  dryRun: boolean;
  test: boolean;
  sync: boolean;
  deploy: boolean;
};

const parseArgs = (): Partial<Args> => {
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
  return {
    api: typeof options.api === "string" ? options.api : undefined,
    token: typeof options.token === "string" ? options.token : undefined,
    schoolId: typeof options.schoolId === "string" ? options.schoolId : undefined,
    input: typeof options.input === "string" ? options.input : undefined,
    dryRun: Boolean(options.dryRun),
    test: Boolean(options.test),
    sync: Boolean(options.sync),
    deploy: Boolean(options.deploy),
  };
};

const requestJson = async <T>(
  baseUrl: string,
  path: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  token: string,
  body?: any,
): Promise<T> => {
  const url = new URL(path, baseUrl);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;
  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          const isJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
          const data = isJson ? JSON.parse(raw || "{}") : (raw as any);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data as T);
          } else {
            const error = (data as any)?.error || res.statusMessage || "Request failed";
            reject(new Error(`${res.statusCode} ${error}`));
          }
        });
      },
    );
    req.on("error", (err) => reject(err));
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const loadInput = (path: string): ProvisionInput => {
  const raw = fs.readFileSync(path, "utf8");
  return JSON.parse(raw) as ProvisionInput;
};

const ensureArgs = (args: Partial<Args>): Args => {
  if (!args.api || !args.token || !args.schoolId || !args.input) {
    throw new Error(
      "Missing args. Required: --api <url> --token <jwt> --schoolId <id> --input <file.json>",
    );
  }
  return {
    api: args.api,
    token: args.token,
    schoolId: args.schoolId,
    input: args.input,
    dryRun: Boolean(args.dryRun),
    test: Boolean(args.test),
    sync: Boolean(args.sync),
    deploy: Boolean(args.deploy),
  };
};

const main = async () => {
  const args = ensureArgs(parseArgs());
  const input = loadInput(args.input);

  const createdNvrs: Record<string, CreateNvrResponse> = {};

  for (const nvr of input.nvrs || []) {
    const payload = {
      name: nvr.name,
      vendor: nvr.vendor,
      model: nvr.model,
      host: nvr.host,
      httpPort: nvr.httpPort ?? 80,
      onvifPort: nvr.onvifPort ?? 80,
      rtspPort: nvr.rtspPort ?? 554,
      rtspUrlTemplate: nvr.rtspUrlTemplate,
      username: nvr.username,
      password: nvr.password,
      protocol: nvr.protocol ?? "ONVIF",
      isActive: nvr.isActive ?? true,
    };

    if (args.dryRun) {
      console.log("[DRY] create nvr", payload);
      continue;
    }

    const created = await requestJson<CreateNvrResponse>(
      args.api,
      `/schools/${args.schoolId}/nvrs`,
      "POST",
      args.token,
      payload,
    );
    createdNvrs[nvr.name] = created;
    console.log("created nvr", created.id, created.name);

    if (args.test) {
      await requestJson(
        args.api,
        `/nvrs/${created.id}/test-connection`,
        "POST",
        args.token,
        {},
      );
      console.log("test ok", created.id);
    }

    if (args.sync || nvr.syncOnvif) {
      await requestJson(
        args.api,
        `/nvrs/${created.id}/onvif-sync`,
        "POST",
        args.token,
        {
          overwriteNames: nvr.overwriteNames ?? false,
          disableMissing: true,
        },
      );
      console.log("onvif sync ok", created.id);
    }
  }

  for (const camera of input.cameras || []) {
    const nvrId = camera.nvrId || (camera.nvrRef ? createdNvrs[camera.nvrRef]?.id : undefined);
    const payload = {
      name: camera.name,
      areaId: camera.areaId,
      nvrId,
      channelNo: camera.channelNo,
      streamProfile: camera.streamProfile ?? "sub",
      autoGenerateUrl: camera.autoGenerateUrl ?? Boolean(nvrId),
      streamUrl: camera.streamUrl,
      status: camera.status ?? "UNKNOWN",
      isActive: camera.isActive ?? true,
      externalId: camera.externalId,
    };

    if (args.dryRun) {
      console.log("[DRY] create camera", payload);
      continue;
    }

    await requestJson(
      args.api,
      `/schools/${args.schoolId}/cameras`,
      "POST",
      args.token,
      payload,
    );
    console.log("created camera", payload.name);
  }

  if (args.deploy && input.deploy) {
    if (args.dryRun) {
      console.log("[DRY] deploy mediamtx", input.deploy);
    } else {
      await requestJson(
        args.api,
        `/schools/${args.schoolId}/mediamtx-deploy`,
        "POST",
        args.token,
        input.deploy,
      );
      console.log("mediamtx deploy ok");
    }
  }
};

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
