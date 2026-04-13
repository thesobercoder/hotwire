import { fileURLToPath } from "node:url";

import { build as esbuildBuild } from "esbuild";
import { build } from "vite";

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

await Promise.all([
  esbuildBuild({
    entryPoints: [mainEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: mainOut,
    external: ["electron"],
    sourcemap: true,
  }),
  esbuildBuild({
    entryPoints: [preloadEntry],
    bundle: true,
    platform: "node",
    format: "esm",
    outfile: preloadOut,
    external: ["electron"],
    sourcemap: true,
  }),
]);

await build({
  configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
});
