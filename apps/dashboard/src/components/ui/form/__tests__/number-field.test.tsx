import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { useZodForm } from '../use-zod-form';
import { Form } from '../form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '../form-field';
import { NumberField } from '../number-field';

const schema = z.object({ qty: z.coerce.number().int().positive() });

function Demo() {
  const { form } = useZodForm({ schema, defaultValues: { qty: '' as unknown as number } });
  return (
    <Form {...form}>
      <FormField
        control={form.control}
        name="qty"
        render={() => (
          <FormItem>
            <FormLabel>Qty</FormLabel>
            <FormControl>
              <NumberField name="qty" placeholder="0" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </Form>
  );
}

describe('NumberField', () => {
  it('renders number input and updates form value', async () => {
    const user = userEvent.setup();
    render(<Demo />);
    const input = screen.getByPlaceholderText('0');
    expect(input).toHaveAttribute('type', 'number');
    await user.clear(input);
    await user.type(input, '5');
    expect(input).toHaveValue(5);
  });
});
