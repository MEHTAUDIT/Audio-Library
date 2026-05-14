import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'default' | 'lg' | 'xl';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'default',
    size = 'default',
    loading = false,
    icon,
    iconPosition = 'left',
    children,
    disabled,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading;

    // Map 'default' to 'primary' for backward compatibility
    const effectiveVariant = variant === 'default' ? 'primary' : variant;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center gap-2 rounded-xl font-medium",
          "transition-all duration-200 ease-out",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          "ring-offset-white select-none",

          // Variant styles
          {
            // Primary (and default for backward compatibility)
            'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-soft':
              effectiveVariant === 'primary',
            'hover:from-primary-700 hover:to-primary-600 hover:shadow-medium hover:-translate-y-0.5':
              effectiveVariant === 'primary' && !isDisabled,
            'active:translate-y-0': effectiveVariant === 'primary' && !isDisabled,

            // Secondary
            'bg-gradient-to-r from-accent-100 to-primary-100 text-primary-700 shadow-soft':
              effectiveVariant === 'secondary',
            'hover:from-accent-200 hover:to-primary-200 hover:shadow-medium':
              effectiveVariant === 'secondary' && !isDisabled,

            // Outline
            'border-2 border-slate-200 bg-white text-slate-700 shadow-soft':
              effectiveVariant === 'outline',
            'hover:border-primary-300 hover:bg-primary-50 hover:text-primary-700 hover:shadow-medium':
              effectiveVariant === 'outline' && !isDisabled,

            // Ghost
            'text-slate-700 hover:bg-slate-100':
              effectiveVariant === 'ghost',

            // Danger
            'bg-gradient-to-r from-danger-600 to-danger-500 text-white shadow-soft':
              effectiveVariant === 'danger',
            'hover:from-danger-700 hover:to-danger-600 hover:shadow-medium hover:-translate-y-0.5':
              effectiveVariant === 'danger' && !isDisabled,

            // Success
            'bg-gradient-to-r from-success-600 to-success-500 text-white shadow-soft':
              effectiveVariant === 'success',
            'hover:from-success-700 hover:to-success-600 hover:shadow-medium hover:-translate-y-0.5':
              effectiveVariant === 'success' && !isDisabled,
          },

          // Size styles
          {
            'h-9 px-3 sm:px-4 text-xs sm:text-sm': size === 'sm',
            'h-11 px-4 sm:px-5 text-sm sm:text-base': size === 'default',
            'h-12 px-6 sm:px-7 text-base sm:text-lg': size === 'lg',
            'h-14 px-8 sm:px-10 text-lg sm:text-xl': size === 'xl',
          },

          className
        )}
        {...props}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}

        {!loading && icon && iconPosition === 'left' && (
          <span className="flex-shrink-0">{icon}</span>
        )}

        {children && <span>{children}</span>}

        {!loading && icon && iconPosition === 'right' && (
          <span className="flex-shrink-0">{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
