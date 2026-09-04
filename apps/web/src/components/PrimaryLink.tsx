import { Link, type LinkProps } from 'react-router'

function PrimaryLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`self-center btn btn-lg tracking-wide border-2 btn-outline-accent ${className}`}
      {...props}
    />
  )
}

export default PrimaryLink