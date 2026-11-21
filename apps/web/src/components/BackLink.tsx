import { Link, type LinkProps } from 'react-router'
import Icon from './Icon'

/*
  BackLink. One way back to where you came from: a quiet link with the arrow
  from our icon set. Used on the legal pages and while watching a match.

  A page whose only action is going back uses PrimaryLink instead, like the
  404, because there it is the one thing to do.

    <BackLink to="/home">Back to lobby</BackLink>
*/

function BackLink({ children, className = '', ...props }: LinkProps) {
  return (
    <Link
      className={`inline-flex items-center gap-1.5 text-sm text-muted underline underline-offset-4 hover:text-(--color-base-content) ${className}`}
      {...props}
    >
      <Icon name="back" size={14} />
      {children}
    </Link>
  )
}

export default BackLink