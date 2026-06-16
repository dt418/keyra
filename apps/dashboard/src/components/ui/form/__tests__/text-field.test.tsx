import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { useZodForm } from '../use-zod-form';
import { Form } from '../form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../form-field';
import { TextField } from '../text-field';

const schema = z.object({ name: z.string().min(1, 'Required') });

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { name: '' } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="name"
        render={() => (
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <TextField name="name" placeholder="Enter" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe('TextField', () => {
  it('renders an input with the slot marker', () => {
    render(<Demo />);
    const input = screen.getByPlaceholderText('Enter');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('data-slot', 'form-control');
  });

  it('updates form value on type', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const input = screen.getByPlaceholderText('Enter');
    await user.type(input, 'A');
    expect(input).toHaveValue('A');
  });
});
