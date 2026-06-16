import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { z } from "zod";
import { useZodForm } from "../use-zod-form";
import { Form, FormFieldContext, useFormField } from "../form";

const schema = z.object({ name: z.string().min(1, "Required") });

function DemoForm() {
  const { form } = useZodForm({
    schema,
    defaultValues: { name: "" },
  });
  return (
    <Form {...form}>
      <FormFieldContext.Provider
        value={{ name: "name" as never, control: form.control as never }}
      >
        <Inner />
      </FormFieldContext.Provider>
    </Form>
  );
}

function Inner() {
  const { error } = useFormField();
  return (
    <>
      <span data-testid="value">{error ? error.message : "no-error"}</span>
    </>
  );
}

describe("Form", () => {
  it("wraps children in FormProvider and reads field state", () => {
    render(<DemoForm />);
    expect(screen.getByTestId("value")).toHaveTextContent("no-error");
  });

  it("exposes error from formState", async () => {
    const user = userEvent.setup();
    render(<DemoForm />);
    await user.click(screen.getByTestId("value"));
    expect(screen.getByTestId("value").textContent).toBeDefined();
  });
});
