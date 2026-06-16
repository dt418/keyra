import { useState, useRef, useEffect } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { CalendarIcon } from "lucide-react";
import dayjs from "dayjs";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type DateFieldProps = {
  name: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showTime?: boolean;
};

export const DateField = ({
  name,
  placeholder = "Pick a date",
  disabled,
  className,
  showTime = false,
}: DateFieldProps) => {
  const { control } = useFormContext();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        calendarRef.current && !calendarRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const raw = (field.value as string | undefined) ?? "";
        const date = raw ? dayjs(raw).toDate() : undefined;
        const display = date
          ? showTime
            ? dayjs(date).format("MMM D, YYYY HH:mm")
            : dayjs(date).format("MMM D, YYYY")
          : "";
        const timeValue = date ? dayjs(date).format("HH:mm") : "";

        const handleDateSelect = (d: Date | undefined) => {
          if (!d) {
            field.onChange("");
            setOpen(false);
            return;
          }
          const existing = date ? dayjs(date) : dayjs();
          const newDate = showTime
            ? dayjs(d).hour(existing.hour()).minute(existing.minute())
            : dayjs(d);
          field.onChange(newDate.toISOString());
          if (!showTime) setOpen(false);
        };

        const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
          if (!date) return;
          const [hours, minutes] = e.target.value.split(":").map(Number);
          if (Number.isNaN(hours) || Number.isNaN(minutes)) return;
          const newDate = dayjs(date).hour(hours).minute(minutes);
          field.onChange(newDate.toISOString());
        };

        return (
          <div className="space-y-2 relative" ref={containerRef}>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-invalid={!!fieldState.error}
              onClick={() => setOpen((v) => !v)}
              className={cn(
                "w-full justify-start text-left font-normal",
                !date && "text-muted-foreground",
                className
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {display || <span>{placeholder}</span>}
            </Button>
            {open && (
              <div
                ref={calendarRef}
                className="absolute left-0 top-full mt-1 z-[60] rounded-3xl border border-border bg-popover p-3 shadow-lg"
              >
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={handleDateSelect}
                />
              </div>
            )}
            {showTime && (
              <Input
                type="time"
                value={timeValue}
                onChange={handleTimeChange}
                disabled={disabled || !date}
                className="w-full"
              />
            )}
          </div>
        );
      }}
    />
  );
};
DateField.displayName = "DateField";
