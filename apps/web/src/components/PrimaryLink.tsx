import { Link, type LinkProps } from 'react-router'

/*
  PrimaryLink. Same look as PrimaryButton, but for navigation instead of
  actions (renders an <a>, no form submit). For example used by 
  LandingPage and NotFoundPage.
 
    [ Play now ]   <- outlined pill shape

  size: 'large' (default) for the main call-to-action, 'small' for
  tighter spots like the navbar in AppLayout.
*/

type PrimaryLinkProps = LinkProps & {
  size?: 'small' | 'large' // ? means optional field
}

function PrimaryLink({ className = '', size = 'large', ...props }: PrimaryLinkProps) {
  const sizeClass = size === 'small' ? 'btn-sm' : 'btn-lg'

  return (
    <Link
      className={`self-center btn ${sizeClass} tracking-wide border-2 btn-outline-accent ${className}`}
      {...props}
    />
  )
}

export default PrimaryLink

// Syntax notes:
//
// ===  equals the value 'size' exactly 
// (so as a string, not the equivalent integer value for example)
// recommended in Typescript: use === and !== instead of == and !=
