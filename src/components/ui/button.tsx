import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 leading-snug text-center',
          {
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow':
              variant === 'default',
            'border border-input bg-background hover:bg-accent hover:text-accent-foreground':
              variant === 'outline',
            'hover:bg-accent hover:text-accent-foreground': variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm':
              variant === 'destructive',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80':
              variant === 'secondary',
          },
          {
            'min-h-[2.5rem] h-auto px-4 py-2 text-sm': size === 'default',
            'min-h-[2rem] h-auto px-3 py-1.5 text-xs': size === 'sm',
            'min-h-[3rem] h-auto px-6 py-3 text-base': size === 'lg',
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
