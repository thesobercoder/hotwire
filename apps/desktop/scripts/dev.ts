import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { createServer } from "vite";

const require = createRequire(import.meta.url);
const electronBinary = require("electron") as string;
const mainEntry = fileURLToPath(
  new URL("../src/main/index.ts", import.meta.url),
);
const mainOut = fileURLToPath(
  new URL("../dist/main/index.mjs", import.meta.url),
);
const preloadEntry = fileURLToPath(
  new URL("../src/main/preload.ts", import.meta.url),
);
const preloadOut = fileURLToPath(
  new URL("../dist/main/preload.mjs", import.meta.url),
);
const viteConfig = fileURLToPath(new URL("../vite.config.ts", import.meta.url));

await Promise.all([
  build({
    entryPoints: [mainEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: mainOut,
    external: ["electron"],
    sourcemap: true,
  }),
  build({
    entryPoints: [preloadEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: preloadOut,
    external: ["electron"],
    sourcemap: true,
  }),
]);

const server = await createServer({
  configFile: viteConfig,
});

await server.listen();

const rendererUrl = server.resolvedUrls?.local[0] ?? "http://127.0.0.1:5173";

const electronProcess = spawn(electronBinary, [mainOut], {
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
