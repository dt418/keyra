import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Option = { value: string; label: string };

type SelectFieldProps = Omit<
  React.ComponentProps<typeof Select>,
  "value" | "onValueChange" | "defaultValue" | "name"
> & {
  name: string;
  options: Option[];
  placeholder?: string;
  triggerClassName?: string;
};

export const SelectField = ({
  name,
  options,
  placeholder,
  triggerClassName,
  ...rest
}: SelectFieldProps) => {
  const { control } = useFormContext();
  const optionMap = React.useMemo(
    () => new Map(options.map((opt) => [opt.value, opt.label])),
    [options],
  );
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const current = (field.value as string | undefined) ?? "";
        const display = current
          ? (optionMap.get(current) ?? current)
          : placeholder;
        return (
          <Select
            {...rest}
            value={current}
            onValueChange={(value) => field.onChange(value)}
            name={field.name}
          >
            <SelectTrigger
              className={triggerClassName}
              aria-invalid={!!fieldState.error}
            >
              <SelectValue>{display}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }}
    />
  );
};
SelectField.displayName = "SelectField";
