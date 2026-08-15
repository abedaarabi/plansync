import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const requestPasswordReset = vi.hoisted(() => vi.fn());

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { requestPasswordReset },
}));

import ForgotPasswordPage from "./page";

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    requestPasswordReset.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    requestPasswordReset.mockReset();
  });

  it("requests a reset link and shows the generic confirmation state", async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith({
        email: "user@example.com",
        redirectTo: `${window.location.origin}/reset-password`,
      });
    });

    expect(screen.getByText(/If an account exists for/i)).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("shows inline validation before sending a malformed email address", async () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Enter a valid email address.");
    });
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("shows an API error without changing the success state", async () => {
    requestPasswordReset.mockResolvedValue({
      error: { message: "Too many requests. Try again later." },
    });
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email *"), { target: { value: "user@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "Too many requests. Try again later.",
      );
    });
    expect(screen.queryByText(/If an account exists for/i)).toBeNull();
  });
});
