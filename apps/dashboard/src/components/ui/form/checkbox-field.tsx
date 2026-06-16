import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";

type CheckboxFieldProps = Omit<
  React.ComponentProps<typeof Checkbox>,
  "checked" | "onCheckedChange" | "name"
> & {
  name: string;
  label?: React.ReactNode;
};

export const CheckboxField = ({ name, label, ...rest }: CheckboxFieldProps) => {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <label className="flex items-center gap-2 text-sm leading-none">
          <Checkbox
            {...rest}
            checked={!!field.value}
            onCheckedChange={(checked) => {
              field.onChange(!!checked);
            }}
            name={field.name}
            aria-invalid={!!fieldState.error}
          />
          {label && <span>{label}</span>}
        </label>
      )}
    />
  );
};
CheckboxField.displayName = "CheckboxField";
