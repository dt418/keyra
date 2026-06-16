"use client"

import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { cn } from "@/lib/cn"

type CheckboxProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "checked" | "defaultChecked" | "onChange"
> & {
  checked?: boolean | "indeterminate"
  defaultChecked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean | "indeterminate") => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, defaultChecked, onCheckedChange, disabled, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    const isIndeterminate =
      checked === "indeterminate" || defaultChecked === "indeterminate"

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = isIndeterminate
      }
    }, [isIndeterminate])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const next: boolean | "indeterminate" = e.target.checked
        ? true
        : isIndeterminate
          ? "indeterminate"
          : false
      onCheckedChange?.(next)
    }

    const normalizedChecked =
      checked === "indeterminate" ? false : checked
    const normalizedDefault =
      defaultChecked === "indeterminate" ? false : defaultChecked

    return (
      <span className="relative inline-flex items-center justify-center">
        <input
          {...props}
          ref={inputRef}
          type="checkbox"
          checked={normalizedChecked}
          defaultChecked={normalizedDefault}
          onChange={handleChange}
          disabled={disabled}
          aria-invalid={props["aria-invalid"]}
          className={cn(
            "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input shadow-sm transition-colors",
            "checked:bg-primary checked:border-primary checked:text-primary-foreground",
            "indeterminate:bg-primary indeterminate:border-primary indeterminate:text-primary-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30",
            className
          )}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden items-center justify-center text-current peer-checked:flex peer-indeterminate:flex"
        >
          {isIndeterminate ? (
            <MinusIcon className="h-3 w-3" />
          ) : (
            <CheckIcon className="h-3 w-3" />
          )}
        </span>
      </span>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
