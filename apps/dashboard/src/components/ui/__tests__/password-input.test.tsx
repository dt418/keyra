import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PasswordInput } from "@/components/ui/password-input";

describe("PasswordInput", () => {
  it('renders as type="password" by default', () => {
    render(<PasswordInput aria-label="password" />);
    const input = screen.getByLabelText("password");
    expect(input).toHaveAttribute("type", "password");
  });

  it('toggles to type="text" when the show button is clicked', async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="password" />);
    const toggle = screen.getByRole("button", { name: /show password/i });

    await user.click(toggle);
    expect(screen.getByLabelText("password")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: /hide password/i }));
    expect(screen.getByLabelText("password")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("forwards value changes", async () => {
    const user = userEvent.setup();
    render(<PasswordInput aria-label="password" />);
    const input = screen.getByLabelText("password");
    await user.type(input, "hunter2");
    expect(input).toHaveValue("hunter2");
  });
});
