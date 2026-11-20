import type { ButtonHTMLAttributes } from 'react'

/*
    PrimaryButton. Our red outlined button, for actions (like form submit),
    used wherever needed, for example in LoginPage and RegisterPage. 
    For navigation instead, see PrimaryLink.
  
      [ Log in ]   <- outlined pill shape
      <PrimaryButton>                  outlined pill, the default
      <PrimaryButton variant="solid">  filled red, the main action on a screen
      <PrimaryButton size="sm">        smaller, for a secondary action
      <PrimaryButton block>            full width inside its card
*/

// Full class names on purpose, so Tailwind can find them.
const VARIANT = {
  solid: 'btn-primary border-(--color-primary)',
  outline: 'btn-outline-accent',
}

const SIZE = {
  sm: 'btn-sm',
  lg: 'btn-lg',
}

export type ButtonLook = {
  variant?: 'solid' | 'outline'
  size?: 'sm' | 'lg'
  block?: boolean
}

// One source for how a button looks, shared with PrimaryLink.
export function buttonClass({ variant = 'outline', size = 'lg', block = false }: ButtonLook) {
  return `btn tracking-wide border-2 ${VARIANT[variant]} ${SIZE[size]} ${block ? 'w-full' : ''}`
}

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook

function PrimaryButton({ variant, size, block, className = '', ...props }: PrimaryButtonProps) {
  return (
    <button
      className={`${buttonClass({ variant, size, block })} ${className}`}
      {...props}
    />
  )
}

export default PrimaryButton
