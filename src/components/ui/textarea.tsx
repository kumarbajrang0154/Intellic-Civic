import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[96px] w-full rounded-2xl md:rounded-md border border-[#E5E2D9] bg-white px-3.5 py-2 text-base md:text-sm text-[#131E20] placeholder:text-[#6E6B64] shadow-xs focus:border-[#3468A1] focus:outline-none focus:ring-2 focus:ring-[#3468A1]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-[#6E6B64]',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = 'Textarea';

export { Textarea };
