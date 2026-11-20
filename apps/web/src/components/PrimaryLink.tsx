import { Link, type LinkProps } from 'react-router'
import { buttonClass, type ButtonLook } from './PrimaryButton'

/*
  PrimaryLink. Same look as PrimaryButton, but for navigation instead of
  actions (renders an <a>, no form submit). For example used by 
  LandingPage and NotFoundPage.
 
    [ Play now ]   <- outlined pill shape
*/

function PrimaryLink({ variant, size, block, className = '', ...props }: LinkProps & ButtonLook) {
  return (
    <Link
      className={`${buttonClass({ variant, size, block })} ${className}`}
      {...props}
    />
  )
}

export default PrimaryLink
