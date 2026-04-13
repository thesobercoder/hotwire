# Hotwire

Local-first desktop AI agent built with Electron, React, and Deno.

## Build

```bash
pnpm install
pnpm build
pnpm --filter @hotwire/desktop package        # all platforms
pnpm --filter @hotwire/desktop package mac     # macOS only
pnpm --filter @hotwire/desktop package linux   # Linux only
pnpm --filter @hotwire/desktop package win     # Windows only
```

Packaged artifacts land in `apps/desktop/release/`.

## macOS code signing

The packaging step runs [`rcodesign`](https://github.com/indygreg/apple-codesign)
on the `.app` bundle with `--code-signature-flags runtime` (hardened runtime).
If `rcodesign` is not in `PATH`, signing is skipped with a warning.

Install `rcodesign`:

```bash
cargo install apple-codesign
```

Make sure `~/.cargo/bin` is in your `PATH` so the packaging script can find
`rcodesign`.

To sign with a P12 certificate, set environment variables before packaging:

```bash
export RCODESIGN_P12_FILE=/path/to/cert.p12
export RCODESIGN_P12_PASSWORD=changeit
pnpm --filter @hotwire/desktop package mac
```

Without these variables, `rcodesign` produces an ad-hoc signature.

### Quarantine attribute

macOS marks downloaded or rsynced `.app` bundles with a quarantine extended
attribute. Gatekeeper blocks unsigned or ad-hoc-signed apps that carry it. Strip
the attribute before launching:

```bash
xattr -cr Hotwire.app
```

This is only needed for local testing. A properly notarized build clears
Gatekeeper automatically.

### Notarization

Full Apple Developer ID notarization is **deferred**. The current pipeline
produces an `rcodesign`-signed bundle that passes `amfid` after quarantine is
stripped, but it is not stapled with an Apple notarization ticket. Notarization
will be wired when a paid Apple Developer account is available.

## Windows code signing

Windows signing is **reserved for ship time**. The packaging pipeline produces
unsigned Windows artifacts. When ready to ship, wire one of:

- [Azure Trusted Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/)
- [SignPath.io Foundation](https://signpath.io/) (free for OSS)

The signing step should be added to `apps/desktop/scripts/package.ts` following
the same pattern as the macOS `rcodesign` step.
