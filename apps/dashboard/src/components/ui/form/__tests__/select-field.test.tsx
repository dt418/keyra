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
import { SelectField } from "../select-field";

const schema = z.object({ type: z.enum(["a", "b"]) });

let lastFormValues: { type: "a" | "b" } | null = null;

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { type: "a" as const } });
  lastFormValues = form.watch();
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="type"
        render={() => (
          <FormItem>
            <FormLabel>Type</FormLabel>
            <FormControl>
              <SelectField
                name="type"
                options={[
                  { value: "a", label: "A" },
                  { value: "b", label: "B" },
                ]}
                placeholder="Pick one"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("SelectField", () => {
  it("renders trigger and updates form value", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent("A");
    expect(lastFormValues?.type).toBe("a");
    await user.click(trigger);
  });

  it("falls back to raw value when option not found", () => {
    function StaleDemo() {
      const { form } = useZodForm({ schema, defaultValues: { type: "b" as const } });
      return (
        <Form {...form}>
          <FormField
            control={form.control}
            name="type"
            render={() => (
              <FormItem>
                <FormControl>
                  <SelectField
                    name="type"
                    options={[{ value: "a", label: "A" }]}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </Form>
      );
    }
    render(<StaleDemo />);
    const trigger = screen.getByRole("combobox");
    expect(trigger).toHaveTextContent("b");
  });
});
