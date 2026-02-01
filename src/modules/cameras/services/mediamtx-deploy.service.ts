import { spawn } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";

const runCommand = (
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}: ${stderr}`));
      }
    });
  });

export const deployMediaMtxConfig = async (params: {
  content: string;
  mode: "ssh" | "docker" | "local";
  ssh?: {
    host: string;
    port?: number;
    user: string;
    remotePath: string;
    restartCommand?: string;
  };
  docker?: {
    container: string;
    configPath: string;
    restart?: boolean;
  };
  local?: {
    path: string;
    restartCommand?: string;
  };
}) => {
  const tempPath = path.join(
    os.tmpdir(),
    `mediamtx_${Date.now()}_${Math.random().toString(16).slice(2)}.yml`,
  );
  await fs.writeFile(tempPath, params.content, "utf8");

  try {
    if (params.mode === "local") {
      if (!params.local?.path) {
        throw new Error("local path required");
      }
      await fs.writeFile(params.local.path, params.content, "utf8");
      if (params.local.restartCommand) {
        await runCommand("cmd", ["/c", params.local.restartCommand]);
      }
      return { mode: "local" };
    }

    if (params.mode === "ssh") {
      if (!params.ssh) {
        throw new Error("ssh config required");
      }
      const port = params.ssh.port || 22;
      await runCommand("scp", [
        "-P",
        String(port),
        tempPath,
        `${params.ssh.user}@${params.ssh.host}:${params.ssh.remotePath}`,
      ]);
      if (params.ssh.restartCommand) {
        await runCommand("ssh", [
          "-p",
          String(port),
          `${params.ssh.user}@${params.ssh.host}`,
          params.ssh.restartCommand,
        ]);
      }
      return { mode: "ssh", port };
    }

    if (params.mode === "docker") {
      if (!params.docker) {
        throw new Error("docker config required");
      }
      await runCommand("docker", [
        "cp",
        tempPath,
        `${params.docker.container}:${params.docker.configPath}`,
      ]);
      if (params.docker.restart) {
        await runCommand("docker", ["restart", params.docker.container]);
      }
      return { mode: "docker" };
    }

    throw new Error("invalid deploy mode");
  } finally {
    await fs.unlink(tempPath).catch(() => {});
  }
};
