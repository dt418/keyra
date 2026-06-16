import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useZodForm } from '../use-zod-form';

const schema = z.object({
  name: z.string().min(1, 'Required'),
  age: z.coerce.number().int().positive(),
});

describe('useZodForm', () => {
  it('returns a typed useForm instance with zodResolver', () => {
    const { result } = renderHook(() =>
      useZodForm({
        schema,
        defaultValues: { name: '', age: 0 },
      })
    );

    expect(result.current.form).toBeDefined();
    expect(result.current.form.control).toBeDefined();
  });

  it('populates form with defaultValues', () => {
    const { result } = renderHook(() =>
      useZodForm({
        schema,
        defaultValues: { name: 'A', age: 5 },
      })
    );
    expect(result.current.form.getValues()).toEqual({ name: 'A', age: 5 });
  });

  it('reports invalid on bad values', async () => {
    const { result } = renderHook(() =>
      useZodForm({
        schema,
        defaultValues: { name: '', age: 0 },
      })
    );

    await act(async () => {
      await result.current.form.trigger();
    });

    expect(result.current.form.formState.isValid).toBe(false);
  });
});
