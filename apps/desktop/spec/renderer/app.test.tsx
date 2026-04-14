import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

import { appRuntime } from "../../src/renderer/runtime";
import { createTestRouter } from "../../src/renderer/router";
import { ProvidersClient } from "../../src/renderer/services/providers-client";

function stubHotwireApi(overrides: Partial<Window["hotwire"]> = {}) {
  window.hotwire = {
    providers: {
      list: async () => [],
      save: async () => {},
      saveOAuth: async () => {},
      remove: async () => {},
      hasEnabledModel: async () => false,
      listModels: async () => [],
      setModelEnabled: async () => {},
    },
    deviceFlow: {
      start: async () => ({
        deviceCode: "",
        userCode: "",
        verificationUri: "",
        expiresIn: 0,
        interval: 0,
      }),
      poll: async () => ({ accessToken: "" }),
      openUrl: async () => {},
    },
    ...overrides,
  };
}

function installTestRuntime(
  client: Context.Tag.Service<ProvidersClient>,
): () => void {
  const TestLayer = Layer.succeed(ProvidersClient, client);
  const testRuntime = ManagedRuntime.make(TestLayer);

  const originalRunPromise = appRuntime.runPromise.bind(appRuntime);
  (appRuntime as { runPromise: typeof appRuntime.runPromise }).runPromise = ((
    effect: Effect.Effect<unknown, unknown, ProvidersClient>,
  ) => testRuntime.runPromise(effect)) as typeof appRuntime.runPromise;

  return () => {
    (appRuntime as { runPromise: typeof appRuntime.runPromise }).runPromise =
      originalRunPromise;
  };
}

describe("Shell — New session gate", () => {
  beforeEach(() => {
    stubHotwireApi();
  });

  it("disables New when no model is enabled", async () => {
    const cleanup = installTestRuntime({
      list: Effect.succeed([]),
      save: () => Effect.void,
      saveOAuth: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(false),
      listModels: () => Effect.succeed([]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const newButton = await screen.findByRole("button", { name: /^new$/i });
    expect(newButton).toBeDisabled();
    expect(
      screen.getByText(/add a provider to get started/i),
    ).toBeInTheDocument();
    expect(
      screen.getByTitle(/add a provider to enable new sessions/i),
    ).toBeInTheDocument();

    cleanup();
  });

  it("enables New when at least one model is enabled", async () => {
    const cleanup = installTestRuntime({
      list: Effect.succeed([]),
      save: () => Effect.void,
      saveOAuth: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(true),
      listModels: () => Effect.succeed([]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter();
    render(<RouterProvider router={router} />);

    const newButton = await screen.findByRole("button", { name: /^new$/i });
    expect(newButton).toBeEnabled();
    expect(
      screen.queryByText(/add a provider to get started/i),
    ).not.toBeInTheDocument();

    cleanup();
  });
});
