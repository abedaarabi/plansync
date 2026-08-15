import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { EnterpriseForm } from "./EnterpriseForm";
import { EnterpriseFormField } from "./EnterpriseFormField";
import { EnterpriseInput, EnterprisePasswordInput, EnterpriseSelect } from "./EnterpriseInputs";
import { useEnterpriseForm } from "./useEnterpriseForm";

const schema = z.object({
  email: z.string().min(1, "Enter your email address.").email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Enter your password.")
    .min(8, "Password must be at least 8 characters."),
  status: z.string().min(1, "Choose a status."),
  title: z.string().trim().min(1, "Enter a short issue title."),
});

afterEach(cleanup);

function TestForm({
  density = "mobile",
  onSubmit = vi.fn(),
}: {
  density?: "mobile" | "compact";
  onSubmit?: (values: z.infer<typeof schema>) => void;
}) {
  const form = useEnterpriseForm(schema, { email: "", password: "", status: "", title: "" });
  return (
    <EnterpriseForm form={form} onSubmit={onSubmit} density={density}>
      <EnterpriseFormField<z.infer<typeof schema>> name="email" label="Email" required>
        {({ describedBy, field, id, invalid }) => (
          <EnterpriseInput
            {...field}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </EnterpriseFormField>
      <EnterpriseFormField<z.infer<typeof schema>> name="password" label="Password" required>
        {({ describedBy, field, id, invalid }) => (
          <EnterprisePasswordInput
            {...field}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </EnterpriseFormField>
      <EnterpriseFormField<z.infer<typeof schema>> name="title" label="Title" required>
        {({ describedBy, field, id, invalid }) => (
          <EnterpriseInput
            {...field}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          />
        )}
      </EnterpriseFormField>
      <EnterpriseFormField<z.infer<typeof schema>> name="status" label="Status" required>
        {({ describedBy, field, id, invalid }) => (
          <EnterpriseSelect
            {...field}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
          >
            <option value="">Select status</option>
            <option value="OPEN">Open</option>
          </EnterpriseSelect>
        )}
      </EnterpriseFormField>
      <button type="submit">Submit</button>
    </EnterpriseForm>
  );
}

describe("EnterpriseForm", () => {
  it("connects labels and inline validation errors", async () => {
    render(<TestForm />);
    const email = screen.getByLabelText("Email *");

    fireEvent.blur(email);

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("Enter your email address.");
    });
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.className).toContain("enterprise-field-input--error");
    expect(email.getAttribute("aria-describedby")).toContain("-error");
  });

  it("shows Zod errors on every invalid input on submit", async () => {
    render(<TestForm />);
    const email = screen.getByLabelText("Email *") as HTMLInputElement;
    const password = screen.getByLabelText("Password *") as HTMLInputElement;
    const title = screen.getByLabelText("Title *") as HTMLInputElement;
    const status = screen.getByLabelText("Status *") as HTMLSelectElement;
    const form = email.closest("form");

    expect(email.required).toBe(false);
    expect(password.required).toBe(false);
    expect(title.required).toBe(false);
    expect(status.required).toBe(false);
    expect(form?.noValidate).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      const alerts = screen.getAllByRole("alert").map((el) => el.textContent ?? "");
      expect(alerts.some((text) => text.includes("Enter your email address."))).toBe(true);
      expect(alerts.some((text) => text.includes("Enter your password."))).toBe(true);
      expect(alerts.some((text) => text.includes("Enter a short issue title."))).toBe(true);
      expect(alerts.some((text) => text.includes("Choose a status."))).toBe(true);
    });

    expect(email.className).toContain("enterprise-field-input--error");
    expect(password.className).toContain("enterprise-field-input--error");
    expect(title.className).toContain("enterprise-field-input--error");
    expect(status.className).toContain("enterprise-field-input--error");
  });

  it("toggles password visibility", () => {
    render(<TestForm />);
    const password = screen.getByLabelText("Password *") as HTMLInputElement;

    expect(password.type).toBe("password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.type).toBe("text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeTruthy();
  });

  it("uses compact density classes when requested", () => {
    render(<TestForm density="compact" />);

    expect(screen.getByLabelText("Email *").className).toContain("min-h-9");
  });

  it("uses a consistent native dropdown affordance", () => {
    render(<TestForm />);

    expect(screen.getByLabelText("Status *").className).toContain("appearance-none");
    expect(screen.getByTestId("enterprise-select-chevron")).toBeTruthy();
  });
});
