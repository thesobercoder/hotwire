# Code Standards

## Language

All source code must be TypeScript. No `.js`, `.mjs`, or `.cjs` files in the project source. This applies to application code, build scripts, and test files equally.

## Test file location

Tests live in a `spec/` directory that mirrors the `src/` tree. Do not colocate test files next to source files.

```
apps/desktop/
  src/
    main/
      app-data.ts
      providers.ts
  spec/
    main/
      app-data.test.ts
      providers.test.ts
```

## Dependencies

All dependency versions must be defined in the `catalog:` section of `pnpm-workspace.yaml`. Package-level `package.json` files reference catalog entries — never pin versions directly.

```yaml
# pnpm-workspace.yaml
catalog:
  react: ^19.2.0
```

```json
// apps/desktop/package.json
{
  "dependencies": {
    "react": "catalog:"
  }
}
```

## Monorepo modularity

Domain logic belongs in isolated packages under `packages/`, not inside `apps/`. Each package has its own `src/`, `spec/`, `tsconfig.json`, and tests. Apps depend on packages via `workspace:` references and compose them — they do not contain domain logic themselves.

```
packages/
  db/           # schema, migrations, CRUD
  providers/    # provider adapters, credential storage
apps/
  desktop/      # Electron shell — wires packages together
```

## Modules

ESM only. Every package uses `"type": "module"`. No CommonJS.

## TypeScript strictness

Strict mode is non-negotiable. `strict: true` and `noUncheckedIndexedAccess: true` in all tsconfig files.

## No native modules

No FFI. No native Node addons. No packages that require native compilation to function (e.g. `better-sqlite3`, `sharp`, `keytar`). Use only pure JS/TS or WASM-based alternatives.

## Testing

Tests use real dependencies, not mocks. Database tests run against real sqlite (in-memory or tempfile). No mocking internal collaborators.

## IDs

All entity IDs are ULIDs — 26 characters, time-sortable, URL-safe.
