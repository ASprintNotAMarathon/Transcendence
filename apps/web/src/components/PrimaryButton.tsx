import type { ButtonHTMLAttributes } from 'react'

/*
  PrimaryButton. Generic outlined button, for actions (form submit),
  reused wherever needed, currently LoginPage and RegisterPage. 
  For navigation instead, see PrimaryLink.
 
    [ Log in ]   <- outlined pill shape
*/

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
