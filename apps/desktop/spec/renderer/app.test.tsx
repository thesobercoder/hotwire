import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";

import { createTestRouter } from "../../src/renderer/router";

describe("App", () => {
  it("renders the first-launch shell with a gated new-session action", async () => {
    const router = createTestRouter();

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: /hotwire/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/add a provider to get started/i),
    ).toBeInTheDocument();

    const newButton = screen.getByRole("button", { name: /^new$/i });
    expect(newButton).toBeDisabled();
    expect(
      screen.getByTitle(/add a provider to enable new sessions/i),
    ).toBeInTheDocument();
  });
});
