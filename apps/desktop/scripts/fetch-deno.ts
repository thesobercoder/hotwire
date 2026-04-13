import { execSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DENO_VERSION = "2.1.4";

const platformTargets = {
  linux: { archive: "deno-x86_64-unknown-linux-gnu.zip", binary: "deno" },
  win: { archive: "deno-x86_64-pc-windows-msvc.zip", binary: "deno.exe" },
  mac: { archive: "deno-aarch64-apple-darwin.zip", binary: "deno" },
} as const;

type PlatformName = keyof typeof platformTargets;

const validPlatforms = Object.keys(platformTargets) as PlatformName[];
const args = process.argv.slice(2).filter((a) => a !== "--");
const platforms: PlatformName[] =
  args.length > 0 ? (args as PlatformName[]) : [...validPlatforms];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(scriptDir, "..", "resources");

for (const platform of platforms) {
  if (!validPlatforms.includes(platform)) {
    console.error(`Unknown platform: ${platform}`);
    process.exit(1);
  }

  const target = platformTargets[platform];
  const outDir = join(resourcesDir, platform);
  const binaryPath = join(outDir, target.binary);

  if (existsSync(binaryPath)) {
    console.log(
      `Deno ${DENO_VERSION} already present for ${platform}, skipping`,
    );
    continue;
  }

  mkdirSync(outDir, { recursive: true });

  const url = `https://github.com/denoland/deno/releases/download/v${DENO_VERSION}/${target.archive}`;
  const zipPath = join(outDir, target.archive);

  console.log(`Downloading Deno ${DENO_VERSION} for ${platform}...`);
  execSync(`curl -fsSL -o "${zipPath}" "${url}"`, { stdio: "inherit" });

  console.log(`Extracting...`);
  execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: "inherit" });

  unlinkSync(zipPath);

  if (platform !== "win") {
    chmodSync(binaryPath, 0o755);
  }

  console.log(`Deno ${DENO_VERSION} ready for ${platform} at ${binaryPath}`);
}
