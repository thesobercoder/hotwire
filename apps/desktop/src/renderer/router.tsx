import {
  Outlet,
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  getRouteApi,
} from "@tanstack/react-router";
import { Effect } from "effect";

import { SettingsRoute } from "./routes/settings";
import { appRuntime } from "./runtime";
import { ProvidersClient } from "./services/providers-client";

type AppRouterOptions = {
  history?:
    | ReturnType<typeof createBrowserHistory>
    | ReturnType<typeof createMemoryHistory>;
};

function AppFrame() {
  return (
    <main>
      <Outlet />
    </main>
  );
}

const shellApi = getRouteApi("/");

function ShellRoute() {
  const hasEnabledModel = shellApi.useLoaderData();

  return (
    <section>
      <h1>Hotwire</h1>
      {hasEnabledModel ? null : <p>Add a provider to get started.</p>}
      <span
        title={
          hasEnabledModel ? undefined : "Add a provider to enable new sessions"
        }
      >
        <button disabled={!hasEnabledModel} type="button">
          New
        </button>
      </span>
    </section>
  );
}

const rootRoute = createRootRoute({
  component: AppFrame,
});

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  loader: () =>
    appRuntime.runPromise(
      Effect.gen(function* () {
        const client = yield* ProvidersClient;
        return yield* client.hasEnabledModel;
      }),
    ),
  component: ShellRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
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

const routeTree = rootRoute.addChildren([shellRoute, settingsRoute]);

export function createAppRouter(options: AppRouterOptions = {}) {
  const history = options.history ?? createBrowserHistory();

  return createRouter({
    routeTree,
    history,
  });
}

export function createTestRouter(initialEntry = "/") {
  return createAppRouter({
    history: createMemoryHistory({
      initialEntries: [initialEntry],
    }),
  });
}

export const appRouter = createAppRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof appRouter;
  }
}
