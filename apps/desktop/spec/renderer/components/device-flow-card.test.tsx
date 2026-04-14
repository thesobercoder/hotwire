import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Context, Effect, Layer, ManagedRuntime } from "effect";

import { DeviceFlowCard } from "../../../src/renderer/components/device-flow-card";
import { deviceFlowRuntime } from "../../../src/renderer/runtime";
import { DeviceFlowClient } from "../../../src/renderer/services/device-flow-client";

function installTestRuntime(
  client: Context.Tag.Service<DeviceFlowClient>,
): () => void {
  const TestLayer = Layer.succeed(DeviceFlowClient, client);
  const testRuntime = ManagedRuntime.make(TestLayer);

  const original = deviceFlowRuntime.runPromise.bind(deviceFlowRuntime);
  (
    deviceFlowRuntime as {
      runPromise: typeof deviceFlowRuntime.runPromise;
    }
  ).runPromise = ((effect: Effect.Effect<unknown, unknown, DeviceFlowClient>) =>
    testRuntime.runPromise(effect)) as typeof deviceFlowRuntime.runPromise;

  return () => {
    (
      deviceFlowRuntime as {
        runPromise: typeof deviceFlowRuntime.runPromise;
      }
    ).runPromise = original;
  };
}

const config = {
  clientId: "test-client",
  deviceAuthUrl: "https://example.com/device/code",
  tokenUrl: "https://example.com/token",
  scopes: ["read:user"],
};

describe("DeviceFlowCard", () => {
  it("renders the user code and verification URL after start", async () => {
    const user = userEvent.setup();

    const cleanup = installTestRuntime({
      start: () =>
        Effect.succeed({
          deviceCode: "DEVICE-CODE",
          userCode: "WDJB-MJHT",
          verificationUri: "https://example.com/device",
          expiresIn: 900,
          interval: 5,
        }),
      poll: () =>
        Effect.succeed({
          accessToken: "A",
          refreshToken: "R",
          expiresIn: 3600,
        }),
      openUrl: () => Effect.void,
    });

    render(
      <DeviceFlowCard
        providerType="copilot"
        config={config}
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /connect/i }));

    expect(await screen.findByText("WDJB-MJHT")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /example\.com\/device/i }),
    ).toHaveAttribute("href", "https://example.com/device");

    cleanup();
  });

  it("opens the verification URL in the system browser when clicked", async () => {
    const user = userEvent.setup();
    const openCalls: string[] = [];

    const cleanup = installTestRuntime({
      start: () =>
        Effect.succeed({
          deviceCode: "DEVICE-CODE",
          userCode: "WDJB-MJHT",
          verificationUri: "https://example.com/device",
          expiresIn: 900,
          interval: 5,
        }),
      poll: () => Effect.never,
      openUrl: (url) =>
        Effect.sync(() => {
          openCalls.push(url);
        }),
    });

    render(
      <DeviceFlowCard
        providerType="copilot"
        config={config}
        onComplete={() => {}}
      />,
    );

    await user.click(screen.getByRole("button", { name: /connect/i }));
    const link = await screen.findByRole("link", {
      name: /example\.com\/device/i,
    });
    await user.click(link);

    expect(openCalls).toEqual(["https://example.com/device"]);

    cleanup();
  });

  it("fires onComplete with tokens after polling resolves", async () => {
    const user = userEvent.setup();
    const completions: Array<{
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    }> = [];

    const cleanup = installTestRuntime({
      start: () =>
        Effect.succeed({
          deviceCode: "DEVICE-CODE",
          userCode: "WDJB-MJHT",
          verificationUri: "https://example.com/device",
          expiresIn: 900,
          interval: 5,
        }),
      poll: () =>
        Effect.succeed({
          accessToken: "ACCESS",
          refreshToken: "REFRESH",
          expiresIn: 3600,
        }),
      openUrl: () => Effect.void,
    });

    render(
      <DeviceFlowCard
        providerType="copilot"
        config={config}
        onComplete={(tokens) => completions.push(tokens)}
      />,
    );

    await user.click(screen.getByRole("button", { name: /connect/i }));

    await screen.findByText("WDJB-MJHT");

    // Allow the pending poll Effect to resolve.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(completions).toEqual([
      { accessToken: "ACCESS", refreshToken: "REFRESH", expiresIn: 3600 },
    ]);

    cleanup();
  });
});
