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
