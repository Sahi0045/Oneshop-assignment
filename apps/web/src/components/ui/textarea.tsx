'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Show a character count below the textarea. Requires `maxLength` to be set. */
  showCount?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, showCount, maxLength, value, defaultValue, onChange, ...props }, ref) => {
    const [internalValue, setInternalValue] = React.useState<string>(
      (defaultValue as string) ?? '',
    );

    const isControlled = value !== undefined;
    const currentValue = isControlled ? (value as string) : internalValue;
    const charCount = currentValue?.length ?? 0;

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          maxLength={maxLength}
          value={isControlled ? value : undefined}
          defaultValue={!isControlled ? defaultValue : undefined}
          onChange={handleChange}
          className={cn(
            'flex min-h-[80px] w-full rounded-md border border-input bg-background',
            'px-3 py-2 text-sm ring-offset-background',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-colors duration-150',
            'resize-y',
            showCount && maxLength ? 'pb-7' : '',
            className,
          )}
          {...props}
        />

        {showCount && maxLength && (
          <span
            className={cn(
              'absolute bottom-2 right-3 text-xs tabular-nums',
              charCount >= maxLength
                ? 'text-destructive font-semibold'
                : charCount >= maxLength * 0.9
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-muted-foreground',
            )}
            aria-live="polite"
            aria-label={`${charCount} of ${maxLength} characters used`}
          >
            {charCount}/{maxLength}
          </span>
        )}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';

export { Textarea };
