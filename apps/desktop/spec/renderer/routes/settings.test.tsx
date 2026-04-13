import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { Provider } from "../../../src/shared/types";
import { createTestRouter } from "../../../src/renderer/router";

function stubHotwireApi(overrides: Partial<Window["hotwire"]> = {}) {
  window.hotwire = {
    providers: {
      list: async () => [],
      save: async () => {},
      remove: async () => {},
    },
    ...overrides,
  };
}

describe("Settings — Providers", () => {
  beforeEach(() => {
    stubHotwireApi();
  });

  it("renders a provider card with API key input on the settings route", async () => {
    const router = createTestRouter("/settings");

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: /anthropic/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
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

    stubHotwireApi({
      providers: {
        list: async () => providers,
        save: async () => {},
        remove: async (id) => {
          removed.push(id);
          providers = [];
        },
      },
    });

    const router = createTestRouter("/settings");
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/connected/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /disconnect/i }));

    expect(await screen.findByLabelText(/api key/i)).toBeInTheDocument();
    expect(removed).toEqual(["01TEST00000000000000000001"]);
  });

  it("saves an API key and shows the connected state", async () => {
    const user = userEvent.setup();
    const saved: Array<{ type: string; apiKey: string }> = [];
    let providers: Provider[] = [];

    stubHotwireApi({
      providers: {
        list: async () => providers,
        save: async (type, apiKey) => {
          saved.push({ type, apiKey });
          providers = [
            {
              id: "01TEST00000000000000000001",
              type,
              apiKey,
              createdAt: "2026-04-13T00:00:00Z",
            },
          ];
        },
        remove: async () => {},
      },
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
  });
});
