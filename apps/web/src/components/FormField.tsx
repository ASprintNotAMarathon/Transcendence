import type { InputHTMLAttributes } from 'react'

/*
	Lay out for a form field,
	used by every field in LoginPage and RegisterPage.

	┌──────────────────────────┐
	│ [ you@example.com      ] │  <- input, label is screen-reader only
	│ Enter a valid email      │  <- error, only when `error` is set
	└──────────────────────────┘
*/
type FormFieldProps = {
  id: string
  label: string
  error?: string
} & InputHTMLAttributes<HTMLInputElement>

function FormField({ id, label, error, className, ...inputProps }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        className={
          className ?? 'rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-(--color-primary-content)'
        }
        {...inputProps}
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}

export default FormField
