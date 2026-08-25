import * as React from "react";
import { cn } from "../../lib/utils";
import { Eye, EyeOff } from "lucide-react";

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { label?: string, error?: string, isValid?: boolean }>(
  ({ className, type, label, error, isValid, value, required, ...props }, ref) => {
    const id = React.useId();
    const [showPassword, setShowPassword] = React.useState(false);
    const isPassword = type === "password";

    return (
      <div className="w-full min-w-0 space-y-1">
        {label && (
          <label htmlFor={id} className="block break-words text-[10px] font-bold sm:font-extrabold uppercase tracking-wide sm:tracking-widest text-slate-500 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 sm:text-[11px]">
            {label}
            {required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </label>
        )}
        <div className="relative min-w-0">
          <input
            suppressHydrationWarning
            id={id}
            type={isPassword ? (showPassword ? "text" : "password") : type}
            required={required}
            className={cn(
              "flex h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-100/50 px-3 py-1.5 text-xs ring-offset-white file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all sm:text-xs",
              isPassword && "pr-10",
              className,
              error && "border-red-500 focus-visible:ring-red-500 bg-red-50/30",
              isValid && !error && "border-green-500 focus-visible:ring-green-500 bg-green-50/30"
            )}
            ref={ref}
            value={value === null ? "" : value}
            {...props}
          />
          {isPassword && (
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </button>
          )}
        </div>
        {error && <p className="text-[10px] sm:text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, error?: string }>(
  ({ className, label, error, children, value, required, ...props }, ref) => {
    const id = React.useId();
    return (
      <div className="w-full min-w-0 space-y-1">
        {label && (
          <label htmlFor={id} className="block break-words text-[9px] font-extrabold uppercase tracking-widest text-slate-500 leading-none sm:text-[11px] sm:tracking-wide">
            {label}
            {required && <span className="text-red-500 ml-1 font-bold">*</span>}
          </label>
        )}
        <select
          suppressHydrationWarning
          id={id}
          required={required}
          className={cn(
            "h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-100/50 px-3 py-1 text-xs ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 transition-all sm:text-xs",
            className,
            error && "border-red-500 focus-visible:ring-red-500 bg-red-50/30"
          )}
          ref={ref}
          value={value === null ? "" : value}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-[10px] sm:text-xs text-red-500">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Input, Select };
