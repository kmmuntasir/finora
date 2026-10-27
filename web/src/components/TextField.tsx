import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  /** Content shown inside the field on the right, such as a show-password toggle. */
  trailing?: ReactNode;
}

export function TextField({ label, trailing, className, ...inputProps }: TextFieldProps) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-label-md text-on-surface">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={cn(
            "h-12 w-full rounded-md border border-border-strong bg-background px-3.5 text-body-md text-on-surface",
            "placeholder:text-on-surface-subtle transition-colors duration-[120ms]",
            "hover:border-on-surface-subtle focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/40",
            trailing ? "pr-12" : undefined,
          )}
          {...inputProps}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
    </div>
  );
}
