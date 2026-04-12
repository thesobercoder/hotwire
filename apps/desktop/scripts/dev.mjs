import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");
const mainEntry = fileURLToPath(
  new URL("../src/main/index.mjs", import.meta.url),
);
const viteConfig = fileURLToPath(new URL("../vite.config.ts", import.meta.url));

const server = await createServer({
  configFile: viteConfig,
});

await server.listen();

const rendererUrl = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5173";

const electronProcess = spawn(electronBinary, [mainEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    HOTWIRE_RENDERER_URL: rendererUrl,
  },
});

const shutdown = async (exitCode = 0) => {
  electronProcess.kill();
  await server.close();
  process.exit(exitCode);
};

electronProcess.on("exit", async (code) => {
  await shutdown(code ?? 0);
});

process.on("SIGINT", async () => {
  await shutdown(0);
});

process.on("SIGTERM", async () => {
  await shutdown(0);
});
