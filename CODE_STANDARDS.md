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

## Node imports

All Node.js built-in imports must use the `node:` prefix. Use `import { join } from "node:path"`, never `import { join } from "path"`.

## Import grouping

Imports are separated into four groups by a blank line, in this order:

1. `node:` builtins
2. External packages
3. Workspace packages (`@hotwire/*`)
4. Relative imports

```ts
import { join } from "node:path";

import { app, BrowserWindow } from "electron";

import { initializeAppData } from "@hotwire/db";

import { createMainWindow } from "./window.js";
```

## Effect.ts

All side effects, services, and async operations use [Effect](https://effect.website/). This is a full ecosystem buy-in, not optional.

- **Services**: Define with `Context.Tag`, implement via `Layer`.
- **Errors**: Typed errors with `Data.TaggedError`. No bare `throw`.
- **Schema**: Use `Schema` from `effect` for data encoding/decoding.
- **DB layer**: `ProviderRepo` service wraps all database operations as Effects.
- **Main process**: Builds layers, IPC handlers run effects via `Effect.runSync` / `Effect.runPromise`.
- **Renderer**: `ManagedRuntime` provides services to React components. Async operations use `Effect.gen` + `runPromise`.
- **Testing**: Swap `Layer` implementations in tests. Use `Effect.runSync` for synchronous assertions.

```ts
// Service definition
export class ProviderRepo extends Context.Tag("@hotwire/db/ProviderRepo")<
  ProviderRepo,
  {
    readonly list: Effect.Effect<Provider[], DatabaseError>;
    readonly insert: (params: {
      id: string;
      type: string;
      apiKey: string;
    }) => Effect.Effect<void, DatabaseError>;
  }
>() {}

// Layer implementation
export const ProviderRepoLive = Layer.effect(
  ProviderRepo,
  Effect.gen(function* () {
    const db = yield* Database;
    return {
      /* ... */
    };
  }),
);
```

## No useEffect

No side-effect hooks. Data fetching lives in TanStack Router `loader` functions, not in components. Components read loader data via `useLoaderData()`. After mutations, call `router.invalidate()` to re-run loaders. `useState` for controlled inputs is fine.

```ts
// Route definition — data loading is declarative
const settingsRoute = createRoute({
  path: "/settings",
  loader: () =>
    appRuntime.runPromise(
      Effect.gen(function* () {
        const client = yield* ProvidersClient;
        return yield* client.list;
      }),
    ),
  component: SettingsRoute,
});

// Component — no useEffect, no useCallback for fetching
const route = getRouteApi("/settings");

function SettingsRoute() {
  const providers = route.useLoaderData();
  const router = useRouter();
  // mutation → router.invalidate()
}
```

## Package manager

pnpm is the only package manager. Always use `pnpm` to run scripts — never `npx`, `npm`, or `yarn`. Use `pnpm <script>` for root scripts (e.g. `pnpm test`, `pnpm typecheck`) and `pnpm --filter <package> <script>` for package-specific scripts.

## No native modules

No FFI. No native Node addons. No packages that require native compilation to function (e.g. `better-sqlite3`, `sharp`, `keytar`). Use only pure JS/TS or WASM-based alternatives.

## Testing

Tests use real dependencies, not mocks. Database tests run against real sqlite (in-memory or tempfile). No mocking internal collaborators.

## IDs

All entity IDs are ULIDs — 26 characters, time-sortable, URL-safe.
