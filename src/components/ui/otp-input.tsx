'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  idPrefix?: string;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled = false,
  idPrefix,
}: OtpInputProps) {
  const inputsRef = React.useRef<(HTMLInputElement | null)[]>([]);

  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const val = e.target.value;
    const cleaned = val.replace(/\D/g, '');
    if (val !== '' && !cleaned) return;

    if (cleaned.length >= length) {
      const autofilled = cleaned.slice(0, length);
      onChange(autofilled);
      inputsRef.current[length - 1]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned ? cleaned.slice(-1) : '';
    const newValue = newDigits.join('');
    onChange(newValue);

    if (cleaned && index < length - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputsRef.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedDigits = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length);
    if (pastedDigits) {
      onChange(pastedDigits);
      const nextIndex = Math.min(pastedDigits.length, length - 1);
      inputsRef.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 max-w-full py-1">
      {Array.from({ length }).map((_, index) => (
        <input
          key={index}
          id={idPrefix ? `${idPrefix}-${index}` : undefined}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          pattern="\d*"
          maxLength={1}
          value={digits[index] || ''}
          onChange={(e) => handleChange(e, index)}
          onKeyDown={(e) => handleKeyDown(e, index)}
          onPaste={handlePaste}
          disabled={disabled}
          className={cn(
            'h-11 w-10 min-w-[40px] sm:h-12 sm:w-12 shrink-0 rounded-lg border border-[#CBD5E1] bg-white text-center text-lg sm:text-xl font-bold text-[#0F2747] shadow-xs focus:border-[#1769AA] focus:outline-none focus:ring-2 focus:ring-[#1769AA]/25 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 transition-colors',
          )}
          aria-label={`Digit ${index + 1} of ${length}`}
        />
      ))}
    </div>
  );
}
