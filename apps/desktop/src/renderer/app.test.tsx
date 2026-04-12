import { RouterProvider } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";

import { createTestRouter } from "./router";

describe("App", () => {
  it("renders initial Hotwire shell through TanStack Router", async () => {
    const router = createTestRouter();

    render(<RouterProvider router={router} />);

    expect(
      await screen.findByRole("heading", { name: /hotwire/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/electron \+ react shell/i)).toBeInTheDocument();
  });
});
