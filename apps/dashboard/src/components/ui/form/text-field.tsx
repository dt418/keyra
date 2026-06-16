import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';

type TextFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'name' | 'defaultValue' | 'value' | 'onChange'
> & {
  name: string;
  type?: 'text' | 'email' | 'password' | 'url' | 'tel' | 'search';
};

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ name, type = 'text', ...rest }, ref) => {
    const { control } = useFormContext();
    return (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <Input
            {...rest}
            ref={ref}
            type={type}
            value={(field.value as string | undefined) ?? ''}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            aria-invalid={!!fieldState.error}
          />
        )}
      />
    );
  }
);
TextField.displayName = 'TextField';
