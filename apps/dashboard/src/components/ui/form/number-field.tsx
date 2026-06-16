import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';

type NumberFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'name' | 'defaultValue' | 'value' | 'onChange' | 'type'
> & {
  name: string;
  min?: number;
  max?: number;
  step?: number;
};

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  ({ name, min, max, step, ...rest }, ref) => {
    const { control } = useFormContext();
    return (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <Input
            {...rest}
            ref={ref}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            value={field.value === undefined || field.value === null ? '' : String(field.value)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                field.onChange(undefined);
                return;
              }
              const parsed = Number(raw);
              field.onChange(Number.isNaN(parsed) ? raw : parsed);
            }}
            onBlur={field.onBlur}
            name={field.name}
            aria-invalid={!!fieldState.error}
          />
        )}
      />
    );
  }
);
NumberField.displayName = 'NumberField';
