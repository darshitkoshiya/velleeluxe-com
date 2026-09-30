import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const fieldClasses =
  'block w-full rounded-sm border border-sand bg-linen px-3 font-sans text-sm text-ink placeholder:text-pebble ' +
  'transition-colors duration-150 focus:border-ink focus:bg-sand focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:text-pebble aria-[invalid=true]:border-persimmon';

export const labelClasses = 'mb-1.5 block font-sans text-[11px] font-medium uppercase tracking-[0.14em] text-ink';

interface FieldMetaProps {
  label?: string;
  error?: string;
  hint?: string;
  optional?: boolean;
}

function FieldMeta({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} className="mt-1.5 font-sans text-xs text-persimmon" role="alert">
        {error}
      </p>
    );
  }
  if (hint) {
    return (
      <p id={`${id}-hint`} className="mt-1.5 font-sans text-xs text-slateGrey">
        {hint}
      </p>
    );
  }
  return null;
}

function FieldLabel({ id, label, optional }: { id: string; label?: string; optional?: boolean }) {
  if (!label) return null;
  return (
    <label htmlFor={id} className={labelClasses}>
      {label}
      {optional ? <span className="ml-1 normal-case tracking-normal text-pebble">(optional)</span> : null}
    </label>
  );
}

export interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldMetaProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, optional, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <FieldLabel id={inputId} label={label} optional={optional} />
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClasses, 'h-11')}
        {...props}
      />
      <FieldMeta id={inputId} error={error} hint={hint} />
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldMetaProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, optional, id, className, rows = 5, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className={className}>
      <FieldLabel id={inputId} label={label} optional={optional} />
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(fieldClasses, 'py-3 leading-relaxed')}
        {...props}
      />
      <FieldMeta id={inputId} error={error} hint={hint} />
    </div>
  );
});

export default Input;
