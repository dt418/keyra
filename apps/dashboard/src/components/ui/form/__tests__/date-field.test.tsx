import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form } from "../form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "../form-field";
import { DateField } from "../date-field";

const schema = z.object({ when: z.string() });

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { when: "" } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="when"
        render={() => (
          <FormItem>
            <FormLabel>When</FormLabel>
            <FormControl>
              <DateField name="when" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("DateField", () => {
  it("renders a date input and updates value", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const input = screen.getByLabelText("When");
    expect(input).toHaveAttribute("type", "date");
    await user.type(input, "2026-12-31");
    expect(input).toHaveValue("2026-12-31");
  });
});
