import { RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

import type { Provider, ProviderModel } from "../../../src/shared/types";
import { appRuntime } from "../../../src/renderer/runtime";
import { createTestRouter } from "../../../src/renderer/router";
import { DeviceFlowClient } from "../../../src/renderer/services/device-flow-client";
import { ProvidersClient } from "../../../src/renderer/services/providers-client";

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

const noopDeviceFlowClient: Context.Tag.Service<DeviceFlowClient> = {
  start: () => Effect.never,
  poll: () => Effect.never,
  openUrl: () => Effect.void,
};

function installTestRuntime(
  client: Context.Tag.Service<ProvidersClient>,
  deviceFlowClient: Context.Tag.Service<DeviceFlowClient> = noopDeviceFlowClient,
): () => void {
  const TestLayer = Layer.mergeAll(
    Layer.succeed(ProvidersClient, client),
    Layer.succeed(DeviceFlowClient, deviceFlowClient),
  );
  const testRuntime = ManagedRuntime.make(TestLayer);

  const originalRunPromise = appRuntime.runPromise.bind(appRuntime);
  (appRuntime as { runPromise: typeof appRuntime.runPromise }).runPromise = ((
    effect: Effect.Effect<unknown, unknown, ProvidersClient | DeviceFlowClient>,
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
      saveOAuth: () => Effect.void,
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
      saveOAuth: () => Effect.void,
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
      saveOAuth: () => Effect.void,
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
      saveOAuth: () => Effect.void,
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
      saveOAuth: () => Effect.void,
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
      saveOAuth: () => Effect.void,
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
      saveOAuth: () => Effect.void,
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

describe("Settings — Copilot OAuth", () => {
  beforeEach(() => {
    stubHotwireApi();
  });

  it("renders a Copilot Connect button when no Copilot provider is connected", async () => {
    const cleanup = installTestRuntime(
      {
        list: Effect.succeed([]),
        save: () => Effect.void,
        saveOAuth: () => Effect.void,
        remove: () => Effect.void,
        hasEnabledModel: Effect.succeed(false),
        listModels: () => Effect.succeed([]),
        setModelEnabled: () => Effect.void,
      },
      {
        start: () =>
          Effect.succeed({
            deviceCode: "D",
            userCode: "U",
            verificationUri: "https://example.com/device",
            expiresIn: 900,
            interval: 5,
          }),
        poll: () => Effect.never,
        openUrl: () => Effect.void,
      },
    );

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: /github copilot/i }),
    ).toBeInTheDocument();
    const copilotCard = screen
      .getByRole("heading", { name: /github copilot/i })
      .closest("article");
    expect(copilotCard).not.toBeNull();
    expect(
      copilotCard ? copilotCard.querySelector("button") : null,
    ).toHaveTextContent(/connect/i);

    cleanup();
  });

  it("persists Copilot tokens via saveOAuth after device flow completes", async () => {
    const user = userEvent.setup();
    const saved: Array<{
      type: string;
      tokens: {
        accessToken: string;
        refreshToken?: string;
        expiresIn?: number;
      };
    }> = [];
    let providers: Provider[] = [];

    const cleanup = installTestRuntime(
      {
        list: Effect.sync(() => providers),
        save: () => Effect.void,
        saveOAuth: (type, tokens) =>
          Effect.sync(() => {
            saved.push({ type, tokens });
            providers = [
              {
                id: "01TEST00000000000000C0P1LT",
                type,
                apiKey: "",
                createdAt: "2026-04-14T00:00:00Z",
              },
            ];
          }),
        remove: () => Effect.void,
        hasEnabledModel: Effect.succeed(false),
        listModels: () => Effect.succeed([]),
        setModelEnabled: () => Effect.void,
      },
      {
        start: () =>
          Effect.succeed({
            deviceCode: "DEVICE-CODE",
            userCode: "WDJB-MJHT",
            verificationUri: "https://github.com/login/device",
            expiresIn: 900,
            interval: 5,
          }),
        poll: () =>
          Effect.succeed({
            accessToken: "gho_access",
            refreshToken: "ghr_refresh",
            expiresIn: 3600,
          }),
        openUrl: () => Effect.void,
      },
    );

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    await screen.findByRole("heading", { name: /github copilot/i });
    const copilotCard = screen
      .getByRole("heading", { name: /github copilot/i })
      .closest("article") as HTMLElement;
    const connectButton = copilotCard.querySelector(
      "button",
    ) as HTMLButtonElement;
    await user.click(connectButton);

    await waitFor(() => {
      expect(saved).toHaveLength(1);
    });
    expect(saved[0]?.type).toBe("copilot");
    expect(saved[0]?.tokens).toEqual({
      accessToken: "gho_access",
      refreshToken: "ghr_refresh",
      expiresIn: 3600,
    });

    const copilotCardAfter = (await screen.findByRole("heading", {
      name: /github copilot/i,
    })).closest("article") as HTMLElement;
    await waitFor(() => {
      expect(copilotCardAfter.textContent ?? "").toMatch(/connected/i);
    });

    cleanup();
  });

  it("disconnects a connected Copilot provider", async () => {
    const user = userEvent.setup();
    const removed: string[] = [];
    let providers: Provider[] = [
      {
        id: "01TEST00000000000000C0P1LT",
        type: "copilot",
        apiKey: "",
        createdAt: "2026-04-14T00:00:00Z",
      },
    ];

    const cleanup = installTestRuntime(
      {
        list: Effect.sync(() => providers),
        save: () => Effect.void,
        saveOAuth: () => Effect.void,
        remove: (id: string) =>
          Effect.sync(() => {
            removed.push(id);
            providers = providers.filter((p) => p.id !== id);
          }),
        hasEnabledModel: Effect.succeed(false),
        listModels: () => Effect.succeed([]),
        setModelEnabled: () => Effect.void,
      },
      {
        start: () => Effect.never,
        poll: () => Effect.never,
        openUrl: () => Effect.void,
      },
    );

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    const copilotCard = (await screen.findByRole("heading", {
      name: /github copilot/i,
    })).closest("article") as HTMLElement;

    expect(copilotCard.textContent ?? "").toMatch(/connected/i);

    const disconnectButton = Array.from(
      copilotCard.querySelectorAll("button"),
    ).find((b) => /disconnect/i.test(b.textContent ?? ""));
    expect(disconnectButton).toBeDefined();
    await user.click(disconnectButton!);

    expect(removed).toEqual(["01TEST00000000000000C0P1LT"]);

    const copilotCardAfter = (await screen.findByRole("heading", {
      name: /github copilot/i,
    })).closest("article") as HTMLElement;
    await waitFor(() => {
      const btns = Array.from(copilotCardAfter.querySelectorAll("button"));
      expect(btns.some((b) => /connect/i.test(b.textContent ?? ""))).toBe(true);
    });

    cleanup();
  });
});
