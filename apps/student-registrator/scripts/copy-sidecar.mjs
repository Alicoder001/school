import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd(), "..", "..", "apps", "student-registrator");
const serverBin = path.join(root, "server", "bin", "student-registrator-server.exe");
const tauriBinDir = path.join(root, "src-tauri", "bin");
const tauriBin = path.join(tauriBinDir, "student-registrator-server.exe");

if (!fs.existsSync(serverBin)) {
  console.error("Sidecar binary not found:", serverBin);
  process.exit(1);
}

fs.mkdirSync(tauriBinDir, { recursive: true });
fs.copyFileSync(serverBin, tauriBin);
console.log("Copied sidecar to", tauriBin);
