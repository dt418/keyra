import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";

type DateFieldProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "name" | "defaultValue" | "value" | "onChange" | "type"
> & { name: string };

export const DateField = React.forwardRef<HTMLInputElement, DateFieldProps>(
  ({ name, ...rest }, ref) => {
    const { control } = useFormContext();
    return (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <Input
            {...rest}
            ref={ref}
            type="date"
            value={(field.value as string | undefined)?.slice(0, 10) ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            aria-invalid={!!fieldState.error}
          />
        )}
      />
    );
  },
);
DateField.displayName = "DateField";
