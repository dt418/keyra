import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form } from "../form";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../form-field";
import { TextareaField } from "../textarea-field";

const schema = z.object({ bio: z.string().max(10, "Too long") });

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { bio: "" } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="bio"
        render={() => (
          <FormItem>
            <FormLabel>Bio</FormLabel>
            <FormControl>
              <TextareaField name="bio" placeholder="Tell us" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe("TextareaField", () => {
  it("renders a textarea and updates on type", async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const ta = screen.getByPlaceholderText("Tell us");
    await user.type(ta, "hi");
    expect(ta).toHaveValue("hi");
  });
});
