import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary' | 'ai' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 leading-snug text-center select-none active:scale-[0.99]',
          {
            'bg-ic-blue text-white hover:bg-ic-blue/90 shadow-sm border border-transparent':
              variant === 'default',
            'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900 shadow-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200':
              variant === 'outline',
            'hover:bg-slate-100 text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800':
              variant === 'ghost',
            'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-transparent':
              variant === 'destructive',
            'bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200':
              variant === 'secondary',
            'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm border border-indigo-500/30':
              variant === 'ai',
            'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-emerald-500/30':
              variant === 'success',
          },
          {
            'h-10 px-4 py-2 text-sm': size === 'default',
            'h-8 px-3 text-xs': size === 'sm',
            'h-12 px-6 text-base font-bold': size === 'lg',
            'h-10 w-10 p-0 shrink-0': size === 'icon',
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button };
