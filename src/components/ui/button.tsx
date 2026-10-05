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
          'inline-flex items-center justify-center rounded-2xl font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 leading-snug text-center select-none active:scale-[0.99]',
          {
            // Primary Button: #3468A1 fill with high-contrast white text
            'bg-[#3468A1] text-white hover:bg-[#2B5687] shadow-sm border border-transparent':
              variant === 'default',
            // Outline Button: White fill with warm border
            'border border-[#E5E2D9] bg-white text-[#131E20] hover:bg-[#F2EFE6] hover:text-[#131E20] shadow-xs':
              variant === 'outline',
            'hover:bg-[#F2EFE6] text-[#6E6B64] hover:text-[#131E20]':
              variant === 'ghost',
            'bg-rose-600 text-white hover:bg-rose-700 shadow-sm border border-transparent':
              variant === 'destructive',
            // Secondary / Mint Button
            'bg-[#C9DFDC] text-[#131E20] hover:bg-[#B9D4D0] shadow-xs border border-transparent font-semibold':
              variant === 'secondary',
            'bg-[#3468A1] text-white hover:bg-[#2B5687] shadow-sm border border-[#3468A1]/30':
              variant === 'ai',
            'bg-[#3B8F68] text-white hover:bg-[#2E7353] shadow-sm border border-transparent':
              variant === 'success',
          },
          {
            'h-11 px-4 md:h-10 py-2 text-base md:text-sm': size === 'default',
            'h-11 px-3 md:h-9 py-2 text-sm': size === 'sm',
            'h-12 px-8 md:h-11 text-base font-bold': size === 'lg',
            'h-11 w-11 md:h-10 md:w-10 p-0 shrink-0': size === 'icon',
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
