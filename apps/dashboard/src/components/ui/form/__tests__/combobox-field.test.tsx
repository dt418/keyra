import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form } from "../form";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from "../form-field";
import { ComboboxField } from "../combobox-field";

const schema = z.object({ product: z.string().min(1) });

function Demo({
  defaultValue = "",
  options = [
    { value: "alpha", label: "Alpha" },
    { value: "beta", label: "Beta" },
  ],
}: {
  defaultValue?: string;
  options?: { value: string; label: string }[];
}) {
  const { form } = useZodForm({ schema, defaultValues: { product: defaultValue } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="product"
        render={() => (
          <FormItem>
            <FormControl>
              <ComboboxField name="product" options={options} placeholder="Pick one" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("ComboboxField", () => {
  it("renders input with placeholder when empty", () => {
    render(<Demo />);
    const input = screen.getByPlaceholderText("Pick one");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("renders current value from form state", () => {
    render(<Demo defaultValue="alpha" />);
    const input = screen.getByPlaceholderText("Pick one");
    expect(input).toHaveValue("alpha");
  });

  it("renders without crashing when options empty", () => {
    render(<Demo options={[]} />);
    const input = screen.getByPlaceholderText("Pick one");
    expect(input).toBeInTheDocument();
  });

  it("renders trigger alongside input", () => {
    const { container } = render(<Demo />);
    const input = screen.getByPlaceholderText("Pick one");
    expect(input).toBeInTheDocument();
    expect(container.querySelector("button")).toBeInTheDocument();
  });
});
