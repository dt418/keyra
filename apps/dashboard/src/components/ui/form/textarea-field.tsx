import * as React from "react";
import { useFormContext, Controller } from "react-hook-form";
import { cn } from "@/lib/cn";

type TextareaFieldProps = Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "name" | "defaultValue" | "value" | "onChange"
> & { name: string };

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ name, className, ...rest }, ref) => {
    const { control } = useFormContext();
    return (
      <Controller
        control={control}
        name={name}
        render={({ field, fieldState }) => (
          <textarea
            {...rest}
            ref={ref}
            className={cn(
              "flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/30",
              className
            )}
            value={(field.value as string | undefined) ?? ""}
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
TextareaField.displayName = "TextareaField";
