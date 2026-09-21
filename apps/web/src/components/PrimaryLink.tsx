import { Link, type LinkProps } from 'react-router'

/*
  PrimaryLink. Same look as PrimaryButton, but for navigation instead of
  actions (renders an <a>, no form submit). For example used by 
  LandingPage and NotFoundPage.
 
    [ Play now ]   <- outlined pill shape
*/

function PrimaryLink({ className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`self-center btn btn-lg tracking-wide border-2 btn-outline-accent ${className}`}
      {...props}
    />
  )
}

export default PrimaryLink
