import { useFormContext, Controller } from "react-hook-form";
import { CalendarIcon } from "lucide-react";
import dayjs from "dayjs";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type DateFieldProps = {
  name: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export const DateField = ({
  name,
  placeholder = "Pick a date",
  disabled,
  className,
}: DateFieldProps) => {
  const { control } = useFormContext();
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const raw = (field.value as string | undefined) ?? "";
        const date = raw ? dayjs(raw).toDate() : undefined;
        const display = date ? dayjs(date).format("MMM D, YYYY") : "";
        return (
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={disabled}
                  aria-invalid={!!fieldState.error}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground",
                    className
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {display || <span>{placeholder}</span>}
                </Button>
              }
            />
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  field.onChange(d ? dayjs(d).toISOString() : "");
                }}
              />
            </PopoverContent>
          </Popover>
        );
      }}
    />
  );
};
DateField.displayName = "DateField";
