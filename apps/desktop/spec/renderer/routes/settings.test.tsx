import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

import type { Provider, ProviderModel } from "../../../src/shared/types";
import { appRuntime } from "../../../src/renderer/runtime";
import { createTestRouter } from "../../../src/renderer/router";
import { ProvidersClient } from "../../../src/renderer/services/providers-client";

function stubHotwireApi(overrides: Partial<Window["hotwire"]> = {}) {
  window.hotwire = {
    providers: {
      list: async () => [],
      save: async () => {},
      remove: async () => {},
      hasEnabledModel: async () => false,
      listModels: async () => [],
      setModelEnabled: async () => {},
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

describe("Settings — Providers", () => {
  beforeEach(() => {
    stubHotwireApi();
  });

  it("renders a provider card with API key input on the settings route", async () => {
    const cleanup = installTestRuntime({
      list: Effect.succeed([]),
      save: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(false),
      listModels: () => Effect.succeed([]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: /anthropic/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();

    cleanup();
  });

  it("disconnects a saved provider and returns to API key input", async () => {
    const user = userEvent.setup();
    let providers: Provider[] = [
      {
        id: "01TEST00000000000000000001",
        type: "anthropic",
        apiKey: "sk-ant-test-key-5678",
        createdAt: "2026-04-13T00:00:00Z",
      },
    ];
    const removed: string[] = [];

    const cleanup = installTestRuntime({
      list: Effect.sync(() => providers),
      save: () => Effect.void,
      remove: (id: string) =>
        Effect.sync(() => {
          removed.push(id);
          providers = [];
        }),
      hasEnabledModel: Effect.succeed(false),
      listModels: () =>
        Effect.succeed([
          {
            providerId: "01TEST00000000000000000001",
            modelId: "claude-sonnet-4-20250514",
            enabled: true,
          },
        ]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/connected/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /disconnect/i }));

    expect(await screen.findByLabelText(/api key/i)).toBeInTheDocument();
    expect(removed).toEqual(["01TEST00000000000000000001"]);

    cleanup();
  });

  it("saves an API key and shows the connected state", async () => {
    const user = userEvent.setup();
    const saved: Array<{ type: string; apiKey: string }> = [];
    let providers: Provider[] = [];
    let models: ProviderModel[] = [];

    const cleanup = installTestRuntime({
      list: Effect.sync(() => providers),
      save: (type: string, apiKey: string) =>
        Effect.sync(() => {
          saved.push({ type, apiKey });
          providers = [
            {
              id: "01TEST00000000000000000001",
              type,
              apiKey,
              createdAt: "2026-04-13T00:00:00Z",
            },
          ];
          models = [
            {
              providerId: "01TEST00000000000000000001",
              modelId: "claude-sonnet-4-20250514",
              enabled: true,
            },
          ];
        }),
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(false),
      listModels: () => Effect.sync(() => models),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    const input = await screen.findByLabelText(/api key/i);
    await user.type(input, "sk-ant-test-key-1234");
    await user.click(screen.getByRole("button", { name: /save/i }));

    expect(await screen.findByText(/connected/i)).toBeInTheDocument();
    expect(screen.getByText(/1234/)).toBeInTheDocument();
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual({
      type: "anthropic",
      apiKey: "sk-ant-test-key-1234",
    });

    cleanup();
  });

  it("renders per-model enable checkboxes for a connected provider", async () => {
    const cleanup = installTestRuntime({
      list: Effect.succeed([
        {
          id: "01TEST00000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key-5678",
          createdAt: "2026-04-13T00:00:00Z",
        },
      ]),
      save: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(true),
      listModels: () =>
        Effect.succeed([
          {
            providerId: "01TEST00000000000000000001",
            modelId: "claude-sonnet-4-20250514",
            enabled: true,
          },
        ]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("checkbox", { name: /claude sonnet 4/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /claude opus 4/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /claude haiku 3\.5/i }),
    ).not.toBeChecked();

    cleanup();
  });

  it("toggles a model checkbox and calls setModelEnabled", async () => {
    const user = userEvent.setup();
    const toggled: Array<{
      providerId: string;
      modelId: string;
      enabled: boolean;
    }> = [];
    let models: ProviderModel[] = [
      {
        providerId: "01TEST00000000000000000001",
        modelId: "claude-sonnet-4-20250514",
        enabled: true,
      },
    ];

    const cleanup = installTestRuntime({
      list: Effect.succeed([
        {
          id: "01TEST00000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key-5678",
          createdAt: "2026-04-13T00:00:00Z",
        },
      ]),
      save: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(true),
      listModels: () => Effect.sync(() => models),
      setModelEnabled: (
        providerId: string,
        modelId: string,
        enabled: boolean,
      ) =>
        Effect.sync(() => {
          toggled.push({ providerId, modelId, enabled });
          models = models.map((m) =>
            m.modelId === modelId ? { ...m, enabled } : m,
          );
        }),
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    const checkbox = await screen.findByRole("checkbox", {
      name: /claude sonnet 4/i,
    });
    expect(checkbox).toBeChecked();

    await user.click(checkbox);

    expect(toggled).toEqual([
      {
        providerId: "01TEST00000000000000000001",
        modelId: "claude-sonnet-4-20250514",
        enabled: false,
      },
    ]);

    cleanup();
  });

  it("shows disconnected visual when all models are disabled", async () => {
    const cleanup = installTestRuntime({
      list: Effect.succeed([
        {
          id: "01TEST00000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key-5678",
          createdAt: "2026-04-13T00:00:00Z",
        },
      ]),
      save: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(false),
      listModels: () => Effect.succeed([]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByText(/disconnected.*no models enabled/i),
    ).toBeInTheDocument();

    cleanup();
  });

  it("shows connected state with key suffix when models are enabled", async () => {
    const cleanup = installTestRuntime({
      list: Effect.succeed([
        {
          id: "01TEST00000000000000000001",
          type: "anthropic",
          apiKey: "sk-ant-test-key-9999",
          createdAt: "2026-04-13T00:00:00Z",
        },
      ]),
      save: () => Effect.void,
      remove: () => Effect.void,
      hasEnabledModel: Effect.succeed(true),
      listModels: () =>
        Effect.succeed([
          {
            providerId: "01TEST00000000000000000001",
            modelId: "claude-sonnet-4-20250514",
            enabled: true,
          },
        ]),
      setModelEnabled: () => Effect.void,
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    const status = await screen.findByText(/connected/i);
    expect(status).toBeInTheDocument();
    expect(status.textContent).not.toMatch(/disconnected/i);
    expect(screen.getByText(/9999/)).toBeInTheDocument();

    cleanup();
  });
});
