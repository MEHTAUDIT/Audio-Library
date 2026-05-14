import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  glass?: boolean;
  variant?: 'default' | 'bordered' | 'elevated' | 'flat';
}

export function Card({
  className,
  hover = false,
  glass = false,
  variant = 'default',
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        // Base styles
        'rounded-2xl transition-all duration-300',

        // Variant styles
        {
          // Default - Subtle shadow and border
          'bg-white border border-slate-200/60 shadow-soft':
            variant === 'default' && !glass,

          // Bordered - More prominent border
          'bg-white border-2 border-slate-200 shadow-soft':
            variant === 'bordered' && !glass,

          // Elevated - Larger shadow, no border
          'bg-white shadow-large':
            variant === 'elevated' && !glass,

          // Flat - No shadow or border
          'bg-white':
            variant === 'flat' && !glass,
        },

        // Glass morphism
        glass && 'glass',

        // Hover effects
        hover && 'card-hover cursor-pointer',

        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex flex-col space-y-3 p-6 sm:p-8 pb-4 sm:pb-6', className)}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'text-xl sm:text-2xl font-semibold leading-tight tracking-tight text-slate-900',
        className
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn('text-sm sm:text-base leading-relaxed text-slate-600', className)}
      {...props}
    />
  );
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn('p-6 sm:p-8 pt-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 sm:gap-4 p-6 sm:p-8 pt-0', className)}
      {...props}
    />
  );
}

// New: Card with icon header
export interface CardIconHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  iconColor?: string;
  iconBg?: string;
}

export function CardIconHeader({
  icon,
  iconColor = 'text-primary-600',
  iconBg = 'bg-primary-100',
  className,
  children,
  ...props
}: CardIconHeaderProps) {
  return (
    <div className={cn('flex items-start gap-4 sm:gap-5 p-6 sm:p-8 pb-4 sm:pb-6', className)} {...props}>
      <div className={cn('flex-shrink-0 p-3 sm:p-4 rounded-xl', iconBg)}>
        <div className={cn('h-6 w-6 sm:h-7 sm:w-7', iconColor)}>{icon}</div>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// New: Stat card variant
export interface StatCardProps extends CardProps {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
}

export function StatCard({
  value,
  label,
  icon,
  trend,
  color = 'primary',
  className,
  ...props
}: StatCardProps) {
  const colorClasses = {
    primary: {
      bg: 'bg-gradient-to-br from-primary-500 to-primary-600',
      iconBg: 'bg-primary-100',
      iconText: 'text-primary-600',
    },
    success: {
      bg: 'bg-gradient-to-br from-success-500 to-success-600',
      iconBg: 'bg-success-100',
      iconText: 'text-success-600',
    },
    warning: {
      bg: 'bg-gradient-to-br from-warning-500 to-warning-600',
      iconBg: 'bg-warning-100',
      iconText: 'text-warning-600',
    },
    danger: {
      bg: 'bg-gradient-to-br from-danger-500 to-danger-600',
      iconBg: 'bg-danger-100',
      iconText: 'text-danger-600',
    },
    accent: {
      bg: 'bg-gradient-to-br from-accent-500 to-accent-600',
      iconBg: 'bg-accent-100',
      iconText: 'text-accent-600',
    },
  };

  const colors = colorClasses[color];

  return (
    <Card variant="elevated" className={cn('overflow-hidden', className)} {...props}>
      {/* Gradient top bar */}
      <div className={cn('h-1.5', colors.bg)} />

      <div className="p-6 sm:p-8">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <span className="text-sm sm:text-base font-medium text-slate-600">{label}</span>
          {icon && (
            <div className={cn('p-2.5 sm:p-3 rounded-lg sm:rounded-xl', colors.iconBg)}>
              <div className={cn('h-5 w-5 sm:h-6 sm:w-6', colors.iconText)}>{icon}</div>
            </div>
          )}
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="text-3xl sm:text-4xl font-bold text-slate-900">{value}</div>

          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 text-sm sm:text-base font-medium whitespace-nowrap',
                trend.isPositive ? 'text-success-600' : 'text-danger-600'
              )}
            >
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
