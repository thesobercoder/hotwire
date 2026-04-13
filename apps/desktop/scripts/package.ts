import { execFileSync, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build, Platform, Arch } from "electron-builder";

const validPlatforms = ["linux", "win", "mac"] as const;
type PlatformName = (typeof validPlatforms)[number];

const args = process.argv.slice(2).filter((a) => a !== "--");
const platforms: PlatformName[] =
  args.length > 0 ? (args as PlatformName[]) : [...validPlatforms];

for (const p of platforms) {
  if (!validPlatforms.includes(p)) {
    console.error(`Unknown platform: ${p}`);
    process.exit(1);
  }
}

const scriptDir = dirname(fileURLToPath(import.meta.url));

execSync(
  `tsx "${join(scriptDir, "fetch-deno.ts")}" -- ${platforms.join(" ")}`,
  {
    stdio: "inherit",
    cwd: join(scriptDir, ".."),
  },
);

const baseConfig = {
  appId: "dev.hotwire.app",
  productName: "Hotwire",
  directories: {
    output: "release",
  },
  files: ["dist/**/*"],
  extraMetadata: {
    dependencies: {},
  },
  mac: {
    identity: null,
  },
};

const configFor = (platform: PlatformName) => ({
  ...baseConfig,
  extraResources: [
    {
      from: `resources/${platform}`,
      to: ".",
      filter: ["**/*"],
    },
  ],
});

const targetFor = (
  platform: PlatformName,
): Map<Platform, Map<Arch, string[]>> => {
  switch (platform) {
    case "linux":
      return Platform.LINUX.createTarget("dir");
    case "win":
      return Platform.WINDOWS.createTarget("dir");
    case "mac":
      return Platform.MAC.createTarget("dir", Arch.arm64);
  }
};

const hasRcodesign = (() => {
  try {
    execSync("rcodesign --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const signMacApp = (appDir: string) => {
  const appPath = join(appDir, "mac-arm64", "Hotwire.app");
  if (!existsSync(appPath)) {
    console.error(`Expected .app bundle not found at ${appPath}`);
    process.exit(1);
  }

  if (!hasRcodesign) {
    console.warn(
      "rcodesign not found in PATH — skipping macOS signing. " +
        "Install: cargo install apple-codesign",
    );
    return;
  }

  const signArgs = ["sign", "--code-signature-flags", "runtime"];

  const p12File = process.env.RCODESIGN_P12_FILE;
  if (p12File) {
    signArgs.push("--p12-file", p12File);
    const p12Password = process.env.RCODESIGN_P12_PASSWORD;
    if (p12Password) {
      signArgs.push("--p12-password", p12Password);
    }
  }

  signArgs.push(appPath);

  console.log(`Signing ${appPath} with rcodesign...`);
  execFileSync("rcodesign", signArgs, { stdio: "inherit" });
  console.log("macOS signing complete.");
};

const releaseDir = join(scriptDir, "..", "release");

for (const platform of platforms) {
  await build({ targets: targetFor(platform), config: configFor(platform) });

  if (platform === "mac") {
    signMacApp(releaseDir);
  }
}
