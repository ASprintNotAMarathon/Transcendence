/*
  Avatar. A round picture of a person, used wherever a person appears
  (header, profile page, later chat and friends).

    ( A )     <- no picture: first letter of the name
    (photo)   <- picture, cropped to fill the circle
    ( A )o    <- online dot, only when `online` is passed

  Sizes: sm 32px (chat, lists), md 40px (header, friends), lg 96px (profile).
*/

type AvatarProps = {
    displayName: string
    avatarUrl?: string | null
    size?: 'sm' | 'md' | 'lg'
    // true = online dot, false = grey dot, left out = no dot
    online?: boolean
  }
  
  // Full class names on purpose: Tailwind only finds classes it can read
  // as complete words in the source, so we never build them with `size-${n}`.
  const SIZE_CLASSES = {
    sm: 'size-8 text-sm',
    md: 'size-10 text-lg',
    lg: 'size-24 text-5xl',
  }
  
  const DOT_CLASSES = {
    sm: 'size-2.5 right-0 bottom-0',
    md: 'size-3 right-0 bottom-0',
    lg: 'size-5 right-1 bottom-1',
  }
  
  function Avatar({ displayName, avatarUrl, size = 'md', online }: AvatarProps) {
    // Array.from takes a whole character, also for emoji. '?' if the name is empty.
    const letter = Array.from(displayName.trim())[0]?.toUpperCase() ?? '?'
  
    return (
      <span className="relative inline-block shrink-0">
        {avatarUrl ? (
          // alt="" because the name is always shown next to the picture
          <img
            src={avatarUrl}
            alt=""
            className={`${SIZE_CLASSES[size]} rounded-full object-cover`}
          />
        ) : (
          <span
            aria-hidden="true"
            className={`${SIZE_CLASSES[size]} flex items-center justify-center rounded-full bg-(--color-primary) font-semibold text-(--color-primary-content)`}
          >
            {letter}
          </span>
        )}
  
        {online !== undefined && (
          <>
            <span
              aria-hidden="true"
              className={`${DOT_CLASSES[size]} absolute right-0 bottom-0 rounded-full border-2 border-(--color-base-100) ${
                online ? 'bg-(--color-secondary)' : 'bg-(--color-board-line)'
              }`}
            />
            {/* Colour alone is not enough, so screen readers get words */}
            <span className="sr-only">{online ? 'Online' : 'Offline'}</span>
          </>
        )}
      </span>
    )
  }
  
  export default Avatar