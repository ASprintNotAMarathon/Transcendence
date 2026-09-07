import type { ButtonHTMLAttributes } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

function PrimaryButton({ className = '', ...props }: PrimaryButtonProps) {
  return (
    <button
      className={`self-center btn btn-lg tracking-wide border-2 btn-outline-accent ${className}`}
      {...props}
    />
  )
}

export default PrimaryButton