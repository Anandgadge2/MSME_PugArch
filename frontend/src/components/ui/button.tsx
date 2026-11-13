import * as React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "./loader";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  loadingText?: React.ReactNode;
  debounceMs?: number;
  showSpinner?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      showSpinner = true,
      children,
      disabled,
      onClick,
      debounceMs = 350,
      ...props
    },
    ref
  ) => {
    const isExecutingRef = React.useRef(false);
    const [internalLoading, setInternalLoading] = React.useState(false);

    const variants = {
      primary: 'bg-brand-navy text-white hover:bg-brand-deep shadow-[0_8px_18px_rgba(11,36,71,0.18)]',
      secondary: 'bg-brand-navy text-white hover:bg-brand-deep shadow-[0_8px_18px_rgba(11,36,71,0.18)]',
      outline: 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-[0_6px_16px_rgba(15,23,42,0.05)]',
      danger: 'bg-red-600 text-white hover:bg-red-700 shadow-[0_8px_18px_rgba(220,38,38,0.16)]',
      ghost: 'bg-transparent hover:bg-slate-100 text-slate-600',
    };

    const sizes = {
      sm: 'min-h-[36px] h-9 px-3 text-xs sm:min-h-0 sm:h-8 sm:px-3 sm:text-xs',
      md: 'min-h-[44px] h-11 px-4 py-2 text-xs sm:min-h-0 sm:h-10 sm:px-4 sm:py-2 sm:text-sm',
      lg: 'min-h-[48px] h-12 px-6 text-sm sm:min-h-0 sm:h-12 sm:px-8 sm:text-base',
      icon: 'min-h-[44px] min-w-[44px] h-11 w-11 p-0 sm:min-h-0 sm:min-w-0 sm:h-10 sm:w-10',
    };

    const isBusy = isLoading || internalLoading;
    const isDisabled = disabled || isBusy;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isDisabled || isExecutingRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Synchronous ref lock protects against rapid microtask / double clicks
      isExecutingRef.current = true;

      if (!onClick) {
        if (props.type === 'submit') {
          setTimeout(() => {
            isExecutingRef.current = false;
          }, Math.max(debounceMs, 800));
        } else {
          isExecutingRef.current = false;
        }
        return;
      }

      try {
        const result: unknown = onClick(e);

        if (result != null && typeof (result as Record<string, unknown>).then === 'function') {
          setInternalLoading(true);
          Promise.resolve(result)
            .finally(() => {
              setTimeout(() => {
                isExecutingRef.current = false;
                setInternalLoading(false);
              }, 150);
            });
        } else {
          // Synchronous click debounce cooldown
          setTimeout(() => {
            isExecutingRef.current = false;
          }, props.type === 'submit' ? Math.max(debounceMs, 800) : debounceMs);
        }
      } catch (err) {
        isExecutingRef.current = false;
        setInternalLoading(false);
        throw err;
      }
    };

    return (
      <button
        suppressHydrationWarning
        ref={ref}
        disabled={isDisabled}
        aria-busy={isBusy}
        aria-disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50 active:scale-95 active:translate-y-px hover:-translate-y-0.5 disabled:hover:translate-y-0",
          "rounded-full",
          "focus-visible:ring-brand-navy",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {isBusy ? (
          <>
            {showSpinner && (
              <Loader2 className="h-4 w-4 animate-spin text-current" forceGold={false} />
            )}
            <span className="sr-only">Processing, please wait...</span>
            {loadingText !== undefined ? loadingText : children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
