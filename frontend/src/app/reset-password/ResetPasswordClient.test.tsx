import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const resetPassword = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
let searchParams = new URLSearchParams();

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

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplace }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { resetPassword },
}));

import { ResetPasswordClient } from "./ResetPasswordClient";

describe("ResetPasswordClient", () => {
  beforeEach(() => {
    searchParams = new URLSearchParams();
    resetPassword.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    cleanup();
    resetPassword.mockReset();
    routerReplace.mockReset();
    vi.restoreAllMocks();
  });

  it("directs users with an invalid link to request another one", () => {
    searchParams = new URLSearchParams("error=INVALID_TOKEN");
    render(<ResetPasswordClient />);

    expect(screen.getByText("This reset link has expired or is invalid.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe(
      "/forgot-password",
    );
  });

  it("validates that the new passwords match before calling the API", async () => {
    searchParams = new URLSearchParams("token=reset-token");
    render(<ResetPasswordClient />);
    fireEvent.change(screen.getByLabelText("New password *"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password *"), {
      target: { value: "Password456!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Passwords do not match.");
    });
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("resets the password using the link token and returns to sign in", async () => {
    searchParams = new URLSearchParams("token=reset-token");
    render(<ResetPasswordClient />);
    fireEvent.change(screen.getByLabelText("New password *"), {
      target: { value: "Password123!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password *"), {
      target: { value: "Password123!" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => {
      expect(resetPassword).toHaveBeenCalledWith({
        newPassword: "Password123!",
        token: "reset-token",
      });
    });
    expect(screen.getByText("Password updated")).toBeTruthy();
  });
});
