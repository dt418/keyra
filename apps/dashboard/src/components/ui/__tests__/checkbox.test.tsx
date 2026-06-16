import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Checkbox } from "@/components/ui/checkbox";

describe("Checkbox", () => {
  it("renders with role checkbox and unchecked by default", () => {
    render(<Checkbox aria-label="accept" />);
    expect(screen.getByRole("checkbox", { name: "accept" })).not.toBeChecked();
  });

  it("toggles on click and fires onCheckedChange", async () => {
    const user = userEvent.setup();
    let last: boolean | "indeterminate" | undefined;
    render(
      <Checkbox
        aria-label="accept"
        onCheckedChange={(v) => {
          last = v;
        }}
      />,
    );
    await user.click(screen.getByRole("checkbox", { name: "accept" }));
    expect(last).toBe(true);
    expect(screen.getByRole("checkbox", { name: "accept" })).toBeChecked();
  });

  it("supports controlled checked=false", () => {
    render(<Checkbox aria-label="off" checked={false} />);
    expect(screen.getByRole("checkbox", { name: "off" })).not.toBeChecked();
  });

  it("reflects aria-invalid on the rendered element", () => {
    render(<Checkbox aria-label="x" aria-invalid />);
    expect(screen.getByRole("checkbox", { name: "x" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });
});
