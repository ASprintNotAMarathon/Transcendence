import { Link } from 'react-router'

type Props = {
	userId: string
	displayName: string
	className?: string
}

/*
  PlayerLink. A player's name that opens their profile.

  Underlines on hover and on keyboard focus, and cuts off a long name
  instead of pushing the layout wider.
*/
function PlayerLink({ userId, displayName, className = '' }: Props) {
	return (
		<Link
			to={`/profile/${encodeURIComponent(userId)}`}
			className={`truncate underline-offset-4 hover:underline ${className}`}
		>
			{displayName}
		</Link>
	)
}

export default PlayerLink