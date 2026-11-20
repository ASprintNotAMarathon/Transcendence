import type { InputHTMLAttributes } from 'react'
import ErrorText from './ErrorText'

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

/*
  How every field looks: dark like the cards, with the same grey border as the
  other cards. The focus ring from index.css marks the field you are in.
*/
export const inputClass =
  'rounded-xl border-2 border-(--color-board-line) bg-(--color-base-100) px-3 py-2 ' +
  'text-(--color-base-content) placeholder:text-muted'

function FormField({ id, label, error, className, ...inputProps }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input id={id} className={className ?? inputClass} {...inputProps} />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}

export default FormField
