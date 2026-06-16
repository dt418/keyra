import { useForm, type UseFormProps, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';

export type UseZodFormOptions<TSchema extends z.ZodTypeAny> = Omit<
  UseFormProps<z.infer<TSchema>>,
  'resolver'
> & {
  schema: TSchema;
};

export function useZodForm<TSchema extends z.ZodTypeAny>(
  options: UseZodFormOptions<TSchema>
): { form: UseFormReturn<z.infer<TSchema>> } {
  const { schema, ...rest } = options;
  const form = useForm<z.infer<TSchema>>({
    ...rest,
    resolver: zodResolver(schema),
  });
  return { form };
}
