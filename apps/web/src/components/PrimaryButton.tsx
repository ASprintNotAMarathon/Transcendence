import type { ButtonHTMLAttributes } from 'react'

/*
    PrimaryButton. Our red outlined button, for actions (like form submit),
    used wherever needed, for example in LoginPage and RegisterPage. 
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
