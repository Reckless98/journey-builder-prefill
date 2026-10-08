import type { ComponentProps } from 'react';

const VARIANT_CLASSES = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
};

interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof VARIANT_CLASSES;
}

/** A text button. Defaults to `type="button"` so it never submits a form by accident. */
export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
