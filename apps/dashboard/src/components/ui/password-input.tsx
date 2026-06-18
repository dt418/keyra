import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/cn";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "./input-group";

export interface PasswordInputProps
  extends Omit<React.ComponentProps<"input">, "type"> {
  inputClassName?: string;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, inputClassName, disabled, ...props }, ref) {
    const [visible, setVisible] = React.useState(false);

    return (
      <InputGroup className={cn("h-8 w-full", className)}>
        <InputGroupInput
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={inputClassName}
          {...props}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            variant="ghost"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            disabled={disabled}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? (
              <EyeOff className="pointer-events-none" />
            ) : (
              <Eye className="pointer-events-none" />
            )}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    );
  },
);

export { PasswordInput };
