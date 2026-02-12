import path from "path";
import { startServer } from "./src/app/server/start-server";

void startServer({
  uploadsRoot: path.join(__dirname, "uploads"),
});
