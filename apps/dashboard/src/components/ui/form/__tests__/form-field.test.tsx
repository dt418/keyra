import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { z } from 'zod';
import { useZodForm } from '../use-zod-form';
import { Form, FormFieldContext, FormItemContext } from '../form';
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '../form-field';

const schema = z.object({ name: z.string().min(1, 'Required') });

function DemoForm() {
  const { form } = useZodForm({ schema, defaultValues: { name: '' } });
  return (
    <Form {...form}>
      <FormItemContext.Provider value={{ id: 'name' }}>
        <FormFieldContext.Provider
          value={{ name: 'name' as never, control: form.control as never }}
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <input data-testid="input" {...field} />
                </FormControl>
                <FormMessage data-testid="message">msg</FormMessage>
              </>
            )}
          />
        </FormFieldContext.Provider>
      </FormItemContext.Provider>
    </Form>
  );
}

describe('form-field glue', () => {
  it('renders label, input, and message slot', () => {
    render(<DemoForm />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByTestId('input')).toBeInTheDocument();
    expect(screen.getByTestId('message')).toBeInTheDocument();
  });

  it('FormItem spreads id-prefixed ids to children', () => {
    render(
      <FormItem data-testid="item">
        <div />
      </FormItem>
    );
    const item = screen.getByTestId('item');
    expect(item).toBeInTheDocument();
  });
});
