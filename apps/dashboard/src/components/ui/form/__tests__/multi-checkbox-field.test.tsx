import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form } from "../form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../form-field";
import { MultiCheckboxField } from "../multi-checkbox-field";

const schema = z.object({
  events: z.array(z.string()).min(1, "Pick at least one"),
});

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { events: [] as string[] } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="events"
        render={() => (
          <FormItem>
            <FormLabel>Events</FormLabel>
            <FormControl>
              <MultiCheckboxField
                name="events"
                options={[
                  { value: "a", label: "A" },
                  { value: "b", label: "B" },
                ]}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("MultiCheckboxField", () => {
  it("renders all options and toggles selection", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const a = screen.getByRole("checkbox", { name: "A" });
    const b = screen.getByRole("checkbox", { name: "B" });
    expect(a).not.toBeChecked();
    await user.click(a);
    expect(a).toBeChecked();
    await user.click(b);
    expect(b).toBeChecked();
  });
});
