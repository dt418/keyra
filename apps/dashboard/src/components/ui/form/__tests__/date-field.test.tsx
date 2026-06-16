import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form } from "../form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../form-field";
import { DateField } from "../date-field";

const schema = z.object({ when: z.string().optional() });

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
              <DateField name="when" placeholder="Pick a date" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("DateField", () => {
  it("renders trigger button with placeholder text", () => {
    render(<Demo />);
    expect(screen.getByRole("button", { name: /pick a date/i })).toBeInTheDocument();
  });

  it("opens calendar on trigger click", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    await user.click(screen.getByRole("button", { name: /pick a date/i }));
    expect(screen.getByText("Su")).toBeInTheDocument();
  });

  it("displays formatted date when value is set", () => {
    function Filled() {
      const { form } = useZodForm({
        schema,
        defaultValues: { when: "2026-12-31T00:00:00.000Z" },
      });
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
              </FormItem>
            )}
          />
        </Form>
      );
    }
    render(<Filled />);
    expect(screen.getByRole("button", { name: /Dec 31, 2026/i })).toBeInTheDocument();
  });
});
