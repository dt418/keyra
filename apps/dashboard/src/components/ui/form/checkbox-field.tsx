import * as React from 'react';
import { useFormContext, Controller } from 'react-hook-form';

type CheckboxFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'checked' | 'onChange' | 'name'
> & {
  name: string;
  label?: React.ReactNode;
};

export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ name, label, className, ...rest }, ref) => {
    const { control } = useFormContext();
    return (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <label className={`flex items-center gap-2 text-sm ${className ?? ''}`}>
            <input
              {...rest}
              ref={ref}
              type="checkbox"
              checked={!!field.value}
              onChange={(e) => field.onChange(e.target.checked)}
              name={field.name}
              aria-invalid={!!fieldState.error}
              className="h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {label && <span>{label}</span>}
          </label>
        )}
      />
    );
  }
);
CheckboxField.displayName = 'CheckboxField';
