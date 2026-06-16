import { useFormContext, Controller } from "react-hook-form";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";

type Option = { value: string; label: string };

type ComboboxFieldProps = {
  name: string;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
  multiple?: boolean;
  isLoading?: boolean;
};

export const ComboboxField = ({
  name,
  options,
  placeholder,
  disabled,
  className,
  emptyMessage = "No results found",
  multiple = false,
  isLoading = false,
}: ComboboxFieldProps) => {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const singleValue = (field.value as string | undefined) ?? "";
        const multiValue = Array.isArray(field.value) ? (field.value as string[]) : [];
        return (
          <Combobox
            value={multiple ? multiValue : singleValue}
            onValueChange={(value) => field.onChange(value)}
            multiple={multiple}
          >
            <ComboboxInput
              placeholder={placeholder}
              disabled={disabled}
              showTrigger
              showClear
              aria-invalid={!!fieldState.error}
              className={className}
            />
            <ComboboxContent>
              <ComboboxList>
                {isLoading ? (
                  <ComboboxEmpty>Loading...</ComboboxEmpty>
                ) : options.length === 0 ? (
                  <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
                ) : (
                  options.map((opt) => (
                    <ComboboxItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </ComboboxItem>
                  ))
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        );
      }}
    />
  );
};
ComboboxField.displayName = "ComboboxField";
