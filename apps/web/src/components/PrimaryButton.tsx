import type { ButtonHTMLAttributes } from 'react'

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>

function PrimaryButton({ className = '', ...props }: PrimaryButtonProps) {
  return (
    <button
      className={`self-center cursor-pointer rounded-full border-2 border-[#B23A2E] bg-transparent px-6 py-3 font-medium tracking-wide text-[#ECE7DE] transition-colors duration-300 hover:bg-[#B23A2E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B23A2E] ${className}`}
      {...props}
    />
  )
}

export default PrimaryButton