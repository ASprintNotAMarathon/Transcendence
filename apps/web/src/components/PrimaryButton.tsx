import type { ButtonHTMLAttributes } from 'react'

/*
    PrimaryButton. Our red outlined button, for actions (like form submit),
    used wherever needed, for example in LoginPage and RegisterPage. 
    For navigation instead, see PrimaryLink.
  
      [ Log in ]   <- outlined pill shape

    size: 'large' (default) for the main call-to-action, 'small' for
    tighter spots like the navbar in AppLayout.
*/

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'small' | 'large' // ? means optional field
}

function PrimaryButton({ className = '', size = 'large', ...props }: PrimaryButtonProps) {
  const sizeClass = size === 'small' ? 'btn-sm' : 'btn-lg'

  return (
    <button
      className={`self-center btn ${sizeClass} tracking-wide border-2 btn-outline-accent ${className}`}
      {...props}
    />
  )
}

export default PrimaryButton
