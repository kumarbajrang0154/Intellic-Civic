import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-11 md:h-10 w-full rounded-2xl border border-[#E5E2D9] bg-white px-3.5 py-2 text-base md:text-sm text-[#131E20] placeholder:text-[#6E6B64] shadow-xs transition-colors focus:border-[#3468A1] focus:outline-none focus:ring-2 focus:ring-[#3468A1]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#6E6B64]',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
