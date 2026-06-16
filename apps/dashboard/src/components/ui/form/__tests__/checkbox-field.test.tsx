import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form } from "../form";
import { FormField, FormItem, FormControl, FormMessage } from "../form-field";
import { CheckboxField } from "../checkbox-field";

const schema = z.object({ agree: z.boolean() });

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { agree: false } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="agree"
        render={() => (
          <FormItem>
            <FormControl>
              <CheckboxField name="agree" label="I agree" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("CheckboxField", () => {
  it("renders a checkbox with label and toggles value", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const checkbox = screen.getByRole("checkbox", { name: "I agree" });
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });
});
