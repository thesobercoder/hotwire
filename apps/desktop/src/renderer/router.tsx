import {
  Outlet,
  createBrowserHistory,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

import { SettingsRoute } from "./routes/settings";

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

function ShellRoute() {
  return (
    <section>
      <h1>Hotwire</h1>
      <p>Add a provider to get started.</p>
      <span title="Add a provider to enable new sessions">
        <button disabled type="button">
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
  component: ShellRoute,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
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
