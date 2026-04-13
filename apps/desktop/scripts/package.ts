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

const config = {
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

const targetFor = (
  platform: PlatformName,
): Map<Platform, Map<Arch, readonly string[]>> => {
  switch (platform) {
    case "linux":
      return Platform.LINUX.createTarget("dir");
    case "win":
      return Platform.WINDOWS.createTarget("dir");
    case "mac":
      return Platform.MAC.createTarget("dir", Arch.arm64);
  }
};

for (const platform of platforms) {
  await build({ targets: targetFor(platform), config });
}
