import { Link } from 'react-router'
import Avatar from './Avatar'
import Card from './Card'
import { useOnlinePlayers } from '../socket/useOnlineStatus'
import SectionHeading from './SectionHeading'

/*
  OnlinePlayersCard. Who is around right now, on the home page.

	PLAYERS ONLINE  [2]
	( c )o  charlie
	( d )o  dana

  The list updates by itself: the server sends everyone who is online when we
  ask, and tells us when someone arrives or leaves. A name opens that player's
  profile, where you can send a friend request or start a chat.
*/

function OnlinePlayersCard() {
	const players = useOnlinePlayers()

	return (
		<section aria-labelledby="online-heading" className="flex flex-col gap-3">
			<div className="flex items-center gap-2">
				<SectionHeading id="online-heading">Players online</SectionHeading>
				{players !== null && players.length > 0 && (
					<span className="rounded-full bg-(--color-primary) px-2 text-xs text-(--color-primary-content)">
						{players.length}
					</span>
				)}
			</div>

			<Card>
				{players === null && <p className="text-sm text-muted">Loading…</p>}

				{players !== null && players.length === 0 && (
						<p className="text-muted">No one else is online.</p>
				)}

				{players !== null && players.length > 0 && (
					<ul className="flex flex-col gap-2">
						{players.map((player) => (
							<li key={player.userId}>
								<Link
									to={`/profile/${encodeURIComponent(player.userId)}`}
									className="flex items-center gap-3 hover:underline"
								>
									<Avatar
										displayName={player.displayName}
										avatarUrl={player.avatarUrl}
										size="sm"
										online
									/>
									<span className="min-w-0 truncate">{player.displayName}</span>
								</Link>
							</li>
						))}
					</ul>
				)}
			</Card>
		</section>
	)
}

export default OnlinePlayersCard