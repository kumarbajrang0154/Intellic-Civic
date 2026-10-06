import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          'flex h-11 md:h-10 w-full rounded-2xl md:rounded-md border border-[#E5E2D9] bg-white pl-3.5 pr-10 py-2 text-base md:text-sm text-[#131E20] shadow-xs focus:border-[#3468A1] focus:outline-none focus:ring-2 focus:ring-[#3468A1]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#6E6B64]',
          className,
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  },
);
Select.displayName = 'Select';

export { Select };
