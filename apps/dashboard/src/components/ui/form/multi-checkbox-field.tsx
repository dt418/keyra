import { useFormContext, Controller } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";

type Option = { value: string; label: string };

type MultiCheckboxFieldProps = {
  name: string;
  options: Option[];
};

export const MultiCheckboxField = ({ name, options }: MultiCheckboxFieldProps) => {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const selected = new Set((field.value as string[] | undefined) ?? []);
        return (
          <div className="grid gap-2" aria-invalid={!!fieldState.error}>
            {options.map((opt) => {
              const isChecked = selected.has(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked) next.add(opt.value);
                      else next.delete(opt.value);
                      field.onChange(Array.from(next));
                    }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        );
      }}
    />
  );
};
MultiCheckboxField.displayName = "MultiCheckboxField";
