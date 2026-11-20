import type { ReactNode } from 'react'

type Props = {
	id?: string
	children: ReactNode
}

/*
  SectionHeading. The small label above a block: PLAY, FRIENDS,
  LIVE MATCHES, PLAYERS ONLINE etc

  Give it an id and point the section at it with aria-labelledby, so a
  screen reader reads the block as "Friends, region".
*/
function SectionHeading({ id, children }: Props) {
	return (
		<h2 id={id} className="text-xs font-semibold uppercase tracking-widest text-muted">
			{children}
		</h2>
	)
}

export default SectionHeading